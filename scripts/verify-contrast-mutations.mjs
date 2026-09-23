#!/usr/bin/env node
// First-implementation evidence, deliberately separate from routine CI.
// Requires a committed, clean checkout and an external artifacts directory.
// Runs the SAME complete browser command for A, five separate old-source
// mutations, then restored A. Each phase gets a fresh prepare/build and raw
// browser records; infrastructure/unresolved failures never prove a mutation.
import { spawn, execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { copyFile, mkdir, mkdtemp, readFile, readdir, realpath, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import postcss from 'postcss'
import { checkTextContrast, contrastRatio, neutralBackgroundTokens, normalTextTokens } from './lib/text-contrast.mjs'

const root = await realpath(fileURLToPath(new URL('..', import.meta.url)))
const baselineSha = '52e7f1dfcf6c6f25057417606e85bdccf90772d2'
const cssFile = 'foundation/assets/css/main.css'
const fieldFile = 'kits/api-docs/components/FieldItem.vue'
const enumFile = 'kits/api-docs/components/EnumTable.vue'
const structureFile = 'kits/api-docs/internal/FieldValueStructure.vue'
const sourceFiles = [cssFile, fieldFile, enumFile, structureFile]
const sha256 = value => createHash('sha256').update(value).digest('hex')
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
const within = (parent, child) => child === parent || child.startsWith(parent + path.sep)

function artifactOption() {
  const args = process.argv.slice(2)
  if (args.length === 1 && args[0] === '--help') {
    console.log('Usage: node scripts/verify-contrast-mutations.mjs --artifacts /absolute/external/directory\nAlternatively set GEIST_CONTRAST_MUTATION_ARTIFACTS. Requires committed clean HEAD and installed node_modules. Leaves the isolated source clone and complete logs for inspection.')
    return null
  }
  if (args.length && (args.length !== 2 || args[0] !== '--artifacts')) throw new Error('Expected --artifacts /absolute/external/directory')
  const directory = args[1] || process.env.GEIST_CONTRAST_MUTATION_ARTIFACTS
  if (!directory || !path.isAbsolute(directory)) throw new Error('An absolute external artifacts directory is required')
  return directory
}

function replaceOnce(source, before, after) {
  if (source.split(before).length !== 2) throw new Error(`Mutation requires exactly one current source anchor: ${before}`)
  return source.replace(before, after)
}

// Copy the nine audited neutral roles from the exact historical source. Keep
// the accepted inverted-role/config/slot repairs when testing the token axis.
function restoreOldNeutralRoles(current, baseline) {
  const roles = new Set([...normalTextTokens, ...neutralBackgroundTokens])
  const values = new Map()
  const themeOf = selector => selector === '.dark' ? 'dark' : selector?.split(',').map(value => value.replace(/^[\t\n\f\r ]+|[\t\n\f\r ]+$/g, '')).includes('.light') ? 'light' : null
  postcss.parse(baseline).walkDecls(declaration => {
    const theme = themeOf(declaration.parent.selector)
    if (theme && roles.has(declaration.prop)) values.set(`${theme}/${declaration.prop}`, declaration.value)
  })
  if (values.size !== roles.size * 2) throw new Error('Historical source does not contain the complete audited neutral mapping')
  const parsed = postcss.parse(current)
  const changed = new Set()
  parsed.walkDecls(declaration => {
    const key = `${themeOf(declaration.parent.selector)}/${declaration.prop}`
    if (!values.has(key)) return
    declaration.value = values.get(key)
    changed.add(key)
  })
  if (changed.size !== values.size) throw new Error('Current source does not contain the complete audited neutral mapping')
  const css = parsed.toString()
  if (checkTextContrast(css).failures.length !== 10) throw new Error('Historical neutral mapping no longer reproduces the expected 10/40 failures')
  return css
}

async function runCommand(cwd, command, args, logFile, environment = {}) {
  const startedAt = new Date().toISOString()
  const log = createWriteStream(logFile)
  log.write(JSON.stringify({ command: [command, ...args], cwd, environment, startedAt }) + '\n')
  const result = await new Promise(resolve => {
    const child = spawn(command, args, {
      cwd, env: { ...process.env, ...environment }, stdio: ['ignore', 'pipe', 'pipe'],
      // Each mutation runs the full neutral + functional browser matrix.
      // Preserve every case and its own timeout as the matrix grows.
      timeout: command === 'pnpm' && args[0] === 'test:browser' ? 60 * 60_000 : 20 * 60_000,
    })
    child.stdout.pipe(log, { end: false })
    child.stderr.pipe(log, { end: false })
    let error
    child.on('error', failure => { error = failure.message })
    child.on('close', (exitCode, signal) => resolve({ exitCode, signal, error }))
  })
  await new Promise((resolve, reject) => {
    log.on('error', reject)
    log.end(resolve)
  })
  return { command: [command, ...args], cwd, environment, logFile, startedAt, endedAt: new Date().toISOString(), ...result }
}

function requireSuccess(result) {
  if (result.exitCode !== 0 || result.signal || result.error) throw new Error(`Command did not succeed: ${result.command.join(' ')}; see ${result.logFile}`)
}

async function verifySourceIsolation(snapshot) {
  const declarationPath = path.join(snapshot, '.nuxt/contrast/components.d.ts')
  const declarations = await readFile(declarationPath, 'utf8')
  const components = {}
  for (const [name, relative] of [['FieldItem', fieldFile], ['EnumTable', enumFile]]) {
    const match = declarations.match(new RegExp(`export const ${name}: typeof import\\(["']([^"']+)["']\\)`))
    if (!match) throw new Error(`Missing generated component reference for ${name}`)
    const resolved = await realpath(path.resolve(path.dirname(declarationPath), match[1]))
    if (resolved !== path.join(snapshot, relative)) throw new Error(`${name} resolves outside isolated source: ${resolved}`)
    components[name] = resolved
  }
  for (const file of [...sourceFiles, 'tests/fixtures/contrast/index.vue', 'nuxt.config.ts']) {
    if (await realpath(path.join(snapshot, file)) !== path.join(snapshot, file)) throw new Error(`Source must not be symlinked: ${file}`)
  }
  const forbidden = ['foundation', 'kits', 'app', 'playground', 'tests/fixtures'].map(directory => path.join(root, directory))
  async function inspect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name)
      if (entry.isDirectory()) await inspect(target)
      else if (entry.isFile() && /\.(?:[cm]?js|json|ts|vue)$/.test(entry.name)) {
        const text = await readFile(target, 'utf8')
        if (forbidden.some(prefix => text.includes(prefix))) throw new Error(`Generated source references original checkout: ${target}`)
      }
    }
  }
  await inspect(path.join(snapshot, '.nuxt/contrast'))
  return { components, sourceFilesAreIndependent: true, originalCheckoutReferences: 0 }
}

const measurementKeys = 'text textBounds rawForeground foreground layers excludedPaint engine rect pseudo generatedText generatedConsistency fontFamily fontSize ownOpacity snapshotConsistency effectiveForeground effectiveBackground ratio'.split(' ')
const metadataKeys = 'id owner route theme state index surface component role slot variant width triggerSurface routeState scenario selectedStatus selectedBody compact motion computed actual host link result status reason destination'.split(' ')
const detailKeys = 'source theme route state classification computed kind id surface outcome expected motion readinessFailure measurement measurements rejection injected errorMovedForGeometry originalErrorBounds fallbackBounds projected normalBounds shifted'.split(' ')
const positiveClassifications = new Set(['positive detector control', 'positive glyph measurement', 'generated glyph geometry control', 'actual trigger endpoint and composed contrast'])
const rejectionClassifications = new Set(['negative detector control', 'expected detector rejection; not a positive suite red run'])
const numericMessage = 'ordinary text contrast: one or more raw ratios < 4.5'
const functionalNumericMessage = 'all ordinary text must resolve at >= 4.5 without rounding'

function object(value, location) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Unknown evidence structure: ${location}`)
}
function onlyKeys(value, keys, location) {
  object(value, location)
  const unknown = Object.keys(value).filter(key => !keys.includes(key))
  if (unknown.length) throw new Error(`Unknown evidence fields at ${location}: ${unknown.join(', ')}`)
}
function noFaults(value, location) {
  for (const key of ['readinessFailure', 'rejection', 'infrastructureError', 'pageError']) {
    if (value[key] != null) throw new Error(`Unresolved ${key}: ${location}`)
  }
  for (const key of ['pageErrors', 'violations']) {
    if (key in value && (!Array.isArray(value[key]) || value[key].length)) throw new Error(`Unresolved ${key}: ${location}`)
  }
  if ('status' in value && !['pass', 'fail'].includes(value.status)) throw new Error(`Unresolved status: ${location}`)
}
function noNestedFaults(value, location) {
  if (!value || typeof value !== 'object') return
  if (!Array.isArray(value)) {
    const { status: _status, ...fields } = value
    noFaults(fields, location)
  }
  for (const [key, child] of Object.entries(value)) noNestedFaults(child, `${location}.${key}`)
}
function sourceMatches(value, source, location) {
  if (value?.sha !== source.sha || value?.digest !== source.digest) throw new Error(`Mismatched browser source: ${location}`)
}
function recompute(value, location) {
  noFaults(value, location)
  const ratio = contrastRatio(value.effectiveForeground, value.effectiveBackground)
  if (!Number.isFinite(value.ratio) || Math.abs(ratio - value.ratio) > 1e-10) throw new Error(`Invalid contrast ratio: ${location}`)
  if ('status' in value && (value.status === 'pass') !== (ratio >= 4.5)) throw new Error(`Mismatched contrast status: ${location}`)
}

// Do not search arbitrary objects for a ratio: every measurement container and
// every intentional negative control has an explicit schema. Sidecars stay in
// the inventory even when they are diagnostic rather than ordinary acceptance.
export async function readBrowserEvidence(directory, source, expectedManifest) {
  const files = []
  async function visit(relative = '') {
    for (const entry of await readdir(path.join(directory, relative), { withFileTypes: true })) {
      const file = path.posix.join(relative, entry.name)
      if (entry.isDirectory()) await visit(file)
      else if (entry.isSymbolicLink()) throw new Error(`Symlinked browser evidence: ${file}`)
      else if (entry.isFile() && file.endsWith('.json')) files.push(file)
    }
  }
  await visit()
  files.sort()
  const reports = [], controls = [], auxiliary = [], identities = []
  for (const file of files) {
    const report = JSON.parse(await readFile(path.join(directory, file), 'utf8'))
    object(report, file)
    sourceMatches(report.source, source, file)
    noFaults(rejectionClassifications.has(report.classification) ? { ...report, rejection: null } : report, file)
    const { records: _records, evidence: _evidence, rejections: _rejections, rejection: _rejection, ...reportMetadata } = report
    noNestedFaults(reportMetadata, file)
    const theme = /^(light|dark)-/.exec(path.basename(file))?.[1]
    if (!theme || (report.theme !== undefined && report.theme !== theme)) throw new Error(`Unknown or inconsistent browser theme: ${file}`)
    const rows = []
    const context = (value, location) => {
      if ('source' in value) sourceMatches(value.source, source, location)
      if ('theme' in value && value.theme !== theme) throw new Error(`Mismatched record theme: ${location}`)
    }
    const ordinary = (value, location, metadata = {}) => {
      onlyKeys(value, [...measurementKeys, ...metadataKeys], location)
      context(value, location)
      noNestedFaults(value, `${file}/${location}`)
      recompute(value, location)
      const row = { theme, ...metadata, ...value }
      rows.push(row)
      identities.push({ file, location, ...Object.fromEntries(['theme', 'id', 'owner', 'state', 'index', 'surface', 'component', 'role', 'slot', 'variant', 'width', 'motion', 'route', 'routeState', 'scenario', 'selectedStatus', 'selectedBody', 'compact', 'destination'].filter(key => row[key] !== undefined).map(key => [key, row[key]])) })
    }
    const reject = (value, location, classification) => {
      if (value.measurement != null || value.measurements !== undefined || typeof value.rejection !== 'string' || !value.rejection.includes('unresolved:')) throw new Error(`Invalid expected detector rejection: ${location}`)
      noFaults({ ...value, rejection: null }, location)
      noNestedFaults({ ...value, rejection: null }, `${file}/${location}`)
      controls.push({ file, location, theme, state: value.state, classification, rejection: value.rejection })
    }
    const detail = (value, location) => {
      const directDiagnostic = ['original alpha diagnostic; actual outcome retained, not a positive suite red run', 'native disabled exception; not normal-text acceptance'].includes(value.classification)
      onlyKeys(value, directDiagnostic ? [...detailKeys.filter(key => !['measurement', 'measurements'].includes(key)), ...measurementKeys] : detailKeys, location)
      context(value, location)
      const classification = value.classification
      if (rejectionClassifications.has(classification)) {
        reject(value, location, classification)
      }
      else if (positiveClassifications.has(classification)) {
        noFaults(value, location)
        noNestedFaults(value, `${file}/${location}`)
        if ('measurement' in value && !('measurements' in value)) ordinary(value.measurement, `${location}.measurement`, { state: value.state, motion: value.motion })
        else if (Array.isArray(value.measurements) && value.measurements.length && !('measurement' in value)) value.measurements.forEach((row, index) => ordinary(row, `${location}.measurements[${index}]`))
        else throw new Error(`Missing positive measurement: ${location}`)
      }
      else if (['numeric negative control', 'original alpha diagnostic; actual outcome retained, not a positive suite red run', 'native disabled exception; not normal-text acceptance'].includes(classification)) {
        noFaults(value, location)
        if (classification === 'numeric negative control' && 'measurements' in value) throw new Error(`Mixed numeric control measurement shapes: ${location}`)
        const measurement = classification === 'numeric negative control' ? value.measurement : Object.fromEntries(measurementKeys.filter(key => key in value).map(key => [key, value[key]]))
        onlyKeys(measurement, measurementKeys, location)
        recompute(measurement, location)
        if (classification === 'numeric negative control' && measurement.ratio >= 4.5) throw new Error(`Numeric negative control did not fail: ${location}`)
        if (classification.startsWith('original alpha') && value.outcome !== (measurement.ratio >= 4.5 ? 'pass' : 'fail')) throw new Error(`Mismatched alpha diagnostic outcome: ${location}`)
        controls.push({ file, location, theme, state: value.state, classification, ratio: measurement.ratio })
      }
      else throw new Error(`Unknown measurement classification: ${location}`)
    }
    if ('records' in report) {
      onlyKeys(report, 'source browser theme width route fonts platformFonts failure infrastructureError pageErrors summary records evidence actions observation rejections'.split(' '), file)
      if (!Array.isArray(report.records) || !report.records.length) throw new Error(`Empty browser scenario: ${file}`)
      report.records.forEach((record, index) => {
        const location = `records[${index}]`
        object(record, `${file}/${location}`)
        if ('measurement' in record) {
          onlyKeys(record, 'state motion expected computed readinessFailure measurement rejection'.split(' '), `${file}/${location}`)
          noFaults(record, `${file}/${location}`)
          noNestedFaults(record, `${file}/${location}`)
          ordinary(record.measurement, `${location}.measurement`, { state: record.state, motion: record.motion })
        }
        else ordinary(record, location)
      })
      if (report.summary) {
        onlyKeys(report.summary, ['pass', 'fail', 'unresolved', 'unverified'], `${file}/summary`)
        for (const status of ['pass', 'fail', 'unresolved', 'unverified']) if (report.summary[status] !== report.records.filter(row => row.status === status).length) throw new Error(`Mismatched record summary: ${file}`)
      }
      if (report.rejections) {
        if (!Array.isArray(report.rejections)) throw new Error(`Unknown rejection list: ${file}`)
        report.rejections.forEach((value, index) => {
          onlyKeys(value, ['state', 'measurement', 'rejection'], `${file}/rejections[${index}]`)
          reject(value, `rejections[${index}]`, 'expected detector rejection; not a positive suite red run')
        })
      }
      if (report.evidence) {
        if (!Array.isArray(report.evidence)) throw new Error(`Unknown functional evidence: ${file}`)
        report.evidence.forEach((value, index) => {
          const location = `${file}/evidence[${index}]`
          noFaults(value, location)
          noNestedFaults(value, location)
          if (value.classification === 'motion proof violations') onlyKeys(value, ['classification', 'violations'], location)
          else if ('observation' in value) onlyKeys(value, ['component', 'role', 'variant', 'motion', 'observation'], location)
          else if ('applicability' in value) onlyKeys(value, ['id', 'route', 'applicability', 'matched', 'history'], location)
          else if ('measuredHighlightedMethodRows' in value) onlyKeys(value, ['component', 'route', 'measuredHighlightedMethodRows'], location)
          else onlyKeys(value, ['id', 'component', 'state', 'scenario', 'selectedStatus', 'selectedBody', 'compact', 'actualStatus', 'announcement'], location)
        })
      }
      if (report.failure && !(report.failure.startsWith(`AssertionError: ${numericMessage}:`) && rows.some(row => row.ratio < 4.5))) throw new Error(`Non-numeric browser failure: ${file}`)
    }
    else if ('evidence' in report) {
      onlyKeys(report, ['source', 'theme', 'evidence'], file)
      if (!Array.isArray(report.evidence) || !report.evidence.length) throw new Error(`Empty detector evidence: ${file}`)
      report.evidence.forEach((value, index) => detail(value, `evidence[${index}]`))
    }
    else if (report.classification === 'Tooltip state readiness; not a contrast measurement') {
      onlyKeys(report, ['source', 'classification', 'label', 'triggerState', 'tooltipState', 'computed'], file)
      const computed = report.computed
      if (!report.label || !/^(delayed|instant)-open$/.test(report.triggerState) || !/^(delayed|instant)-open$/.test(report.tooltipState) || computed?.pendingAnimations !== 0 || computed?.triggerPendingAnimations !== 0 || computed?.opacity !== '1' || computed?.transform !== 'none') throw new Error(`Unready Tooltip sidecar: ${file}`)
      auxiliary.push({ file, kind: 'tooltip readiness' })
    }
    else if (/^(light|dark)-arrival-animation\.json$/.test(file)) {
      onlyKeys(report, ['source', 'frames', 'timing', 'progress', 'time', 'opacity'], file)
      if (!Array.isArray(report.frames) || !report.frames.length || !Number.isFinite(report.progress) || !Number.isFinite(report.time) || Math.abs(Number(report.opacity) - 1) > 1e-5) throw new Error(`Invalid arrival animation sidecar: ${file}`)
      auxiliary.push({ file, kind: 'arrival animation' })
    }
    else if (/^(light|dark)-tabs-(pill|link)-\d+\.json$/.test(file)) {
      onlyKeys(report, ['source', 'box', 'label', 'color', 'normalizedColor', 'alpha', 'opacity', 'overlaps'], file)
      if (report.alpha !== 1 || report.opacity !== 1 || report.box?.width <= 0 || report.box?.height <= 0 || report.overlaps !== file.includes('-pill-')) throw new Error(`Invalid Tabs sidecar: ${file}`)
      auxiliary.push({ file, kind: 'tabs indicator' })
    }
    else detail(report, 'detail')
    if (rows.length) reports.push({ file, failure: report.failure, records: rows })
  }
  if (!files.length || !['light', 'dark'].every(theme => reports.some(report => report.records.some(record => record.theme === theme)))) throw new Error('Browser evidence must include both themes and nonempty measurements')
  for (const file of files) {
    const counterpart = path.posix.join(path.posix.dirname(file), path.posix.basename(file).replace(/^(light|dark)-/, theme => theme === 'light-' ? 'dark-' : 'light-'))
    if (!files.includes(counterpart)) throw new Error(`Missing other-theme report: ${file}`)
  }
  const manifest = { files, measurements: identities, controls: controls.map(({ file, location, theme, state, classification }) => ({ file, location, theme, state, classification })), auxiliary }
  if (expectedManifest && JSON.stringify(manifest) !== JSON.stringify(expectedManifest)) throw new Error('Browser scenario set or measurement identity changed between phases')
  return { files, reports, controls, auxiliary, manifest }
}

// The JSON reporter exposes each error separately. A numeric substring in one
// error must not hide an unrelated hook, runtime error, or second assertion.
export function validateBrowserResults(result, evidence, snapshot, expectedCases) {
  if (!Array.isArray(result.testResults) || !result.testResults.length) throw new Error('Missing Vitest test results')
  const cases = [], failures = [], suites = new Map()
  for (const suite of result.testResults) {
    const file = path.relative(snapshot, suite.name).split(path.sep).join('/')
    if (!/^tests\/browser\/[^/]+\.spec\.ts$/.test(file) || suite.message || !Array.isArray(suite.assertionResults) || !suite.assertionResults.length) throw new Error(`Invalid Vitest suite: ${suite.name}`)
    for (const test of suite.assertionResults) {
      if (!['passed', 'failed'].includes(test.status) || typeof test.title !== 'string' || !test.title || !Array.isArray(test.ancestorTitles) || test.ancestorTitles.some(title => typeof title !== 'string' || !title) || test.fullName !== [...test.ancestorTitles, test.title].join(' ') || !Array.isArray(test.failureMessages)) throw new Error(`Incomplete Vitest test: ${file}`)
      cases.push(`${file}::${test.fullName}`)
      for (let depth = 0; depth <= test.ancestorTitles.length; depth++) {
        const identity = JSON.stringify([file, ...test.ancestorTitles.slice(0, depth)])
        suites.set(identity, suites.get(identity) === 'failed' || test.status === 'failed' ? 'failed' : 'passed')
      }
      if (test.status === 'passed' && test.failureMessages.length) throw new Error(`Passed test contains failures: ${test.fullName}`)
      if (test.status === 'failed') {
        if (!test.failureMessages.length) throw new Error(`Failed test has no assertion evidence: ${test.fullName}`)
        for (const message of test.failureMessages) {
          const firstLine = message.split('\n')[0]
          const label = file === 'tests/browser/text-contrast.spec.ts' ? numericMessage
            : ['tests/browser/functional-colors.spec.ts', 'tests/browser/functional-consumers.spec.ts', 'tests/browser/functional-motion.spec.ts'].includes(file) ? functionalNumericMessage : null
          const assertionFile = file === 'tests/browser/text-contrast.spec.ts' ? file : 'tests/browser/functional-support.ts'
          if (!label || !firstLine.startsWith(`AssertionError: ${label}: expected `) || !firstLine.endsWith(' to deeply equal []') || !message.split('\n').some(line => /^\s+at /.test(line) && line.includes(`${path.join(snapshot, assertionFile)}:`))) throw new Error(`Non-numeric Vitest failure: ${test.fullName}`)
        }
        failures.push({ file, name: test.fullName, messages: test.failureMessages })
      }
    }
    if (suite.status !== (suite.assertionResults.some(test => test.status === 'failed') ? 'failed' : 'passed')) throw new Error(`Inconsistent Vitest suite status: ${file}`)
  }
  cases.sort()
  if (new Set(cases).size !== cases.length || (expectedCases && JSON.stringify(cases) !== JSON.stringify(expectedCases))) throw new Error('Vitest case identity changed between phases')
  const failedSuites = [...suites.values()].filter(status => status === 'failed').length
  if (result.numTotalTestSuites !== suites.size || result.numFailedTestSuites !== failedSuites || result.numPassedTestSuites !== suites.size - failedSuites || result.numTotalTests !== cases.length || result.numFailedTests !== failures.length || result.numPassedTests !== cases.length - failures.length || result.numPendingTests !== 0 || result.numTodoTests !== 0 || result.numPendingTestSuites !== 0 || result.success !== (failures.length === 0)) throw new Error('Incomplete or inconsistent Vitest result counts')
  if (failures.length && !evidence.reports.some(report => report.records.some(row => row.ratio < 4.5))) throw new Error('Vitest numeric failure has no measured failing ratio')
  return { cases, failures }
}

async function main(artifactsBase) {
  if (git(root, 'status', '--porcelain=v1', '--untracked-files=all')) throw new Error('Commit the implementation first: mutation verification requires a completely clean checkout')
  const sourceSha = git(root, 'rev-parse', 'HEAD').trimEnd()
  const baseline = git(root, 'show', `${baselineSha}:${cssFile}`)
  const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
  if (!packageJson.scripts?.['build:contrast'] || !packageJson.scripts?.['test:browser']) throw new Error('Committed HEAD must include build:contrast and test:browser')
  if (within(root, path.resolve(artifactsBase))) throw new Error('Artifacts must be outside the source checkout')
  await mkdir(artifactsBase, { recursive: true })
  artifactsBase = await realpath(artifactsBase)
  if (within(root, artifactsBase)) throw new Error('Artifacts symlink resolves inside the source checkout')
  const artifacts = await mkdtemp(path.join(artifactsBase, 'geist-contrast-mutations-'))
  const temporary = await mkdtemp(path.join(await realpath(tmpdir()), 'geist-contrast-source-'))
  const snapshot = path.join(temporary, 'source')
  const summary = { sourceSha, baselineSha, artifacts, snapshot, startedAt: new Date().toISOString(), phases: [], status: 'running' }
  const saveSummary = () => writeFile(path.join(artifacts, 'summary.json'), JSON.stringify(summary, null, 2))
  await saveSummary()
  console.log(`Contrast mutation evidence: ${artifacts}`)
  console.log(`Isolated source clone: ${snapshot}`)
  try {
    // A local shared clone keeps the original SHA available to contrastSource()
    // without registering worktrees or modifying the author's Git metadata.
    // Source files are ordinary independent files; only dependencies are shared.
    requireSuccess(await runCommand(root, 'git', ['clone', '--shared', '--no-checkout', '--quiet', root, snapshot], path.join(artifacts, 'clone.log')))
    requireSuccess(await runCommand(snapshot, 'git', ['checkout', '--detach', sourceSha], path.join(artifacts, 'checkout.log')))
    await symlink(await realpath(path.join(root, 'node_modules')), path.join(snapshot, 'node_modules'), 'dir')
    const originals = new Map(await Promise.all(sourceFiles.map(async file => [file, await readFile(path.join(snapshot, file), 'utf8')])))
    const { contrastSource } = await import(pathToFileURL(path.join(snapshot, 'scripts/lib/contrast-build.mjs')).href)
    const hoverBefore = 'text-primary underline-offset-4 hover:underline'
    const hoverAfter = 'text-primary transition-colors hover:text-primary/75'
    const phases = [
      { id: '00-green-A' },
      { id: '01-old-tokens', file: cssFile, transform: source => restoreOldNeutralRoles(source, baseline), target: record => record.owner === cssFile && record.id === '5×4 neutral pairs' },
      { id: '02-field-count-alpha', file: fieldFile, transform: source => replaceOnce(source, '<span class="text-dimmed">({{ constraints.length }})</span>', '<span class="text-dimmed/70">({{ constraints.length }})</span>'), target: record => record.owner === fieldFile && record.id === 'FieldItem count' },
      { id: '03-enum-count-alpha', file: enumFile, transform: source => replaceOnce(source, '<span v-if="totalCount" class="text-dimmed">({{ totalCount }})</span>', '<span v-if="totalCount" class="text-dimmed/70">({{ totalCount }})</span>'), target: record => record.owner === enumFile && record.id === 'EnumTable count' },
      { id: '04-field-hover-alpha', file: fieldFile, transform: source => replaceOnce(source, hoverBefore, hoverAfter), target: record => record.owner === fieldFile && record.id === 'field-expand/verb' && record.state === 'hover' },
      { id: '05-value-hover-alpha', file: structureFile, transform: source => replaceOnce(source, hoverBefore, hoverAfter), target: record => record.owner === structureFile && record.id === 'value-expand/verb' && record.state === 'hover' },
      { id: '06-green-restored-A' },
    ]
    let expectedBrowserManifest
    let expectedBrowserCases
    let acceptedDigest
    for (const phase of phases) {
      const phaseDirectory = path.join(artifacts, phase.id)
      const browserDirectory = path.join(phaseDirectory, 'browser')
      await mkdir(browserDirectory, { recursive: true })
      for (const [file, text] of originals) await writeFile(path.join(snapshot, file), text)
      if (phase.file) await writeFile(path.join(snapshot, phase.file), phase.transform(originals.get(phase.file)))
      const modifiedFiles = git(snapshot, 'diff', '--name-only', 'HEAD').split('\n').filter(Boolean)
      if (JSON.stringify(modifiedFiles) !== JSON.stringify(phase.file ? [phase.file] : [])) throw new Error(`Unexpected mutation scope in ${phase.id}`)
      const diff = git(snapshot, 'diff', '--binary', '--no-ext-diff', 'HEAD', '--', ...sourceFiles)
      await writeFile(path.join(phaseDirectory, 'source.patch'), diff)
      if (phase.file) await copyFile(path.join(snapshot, phase.file), path.join(phaseDirectory, 'mutated-source' + path.extname(phase.file)))
      const source = await contrastSource(snapshot)
      const record = { id: phase.id, kind: phase.file ? 'source-mutation' : 'accepted-source', sourceSha, sourceDigest: source.digest, diffSha256: sha256(diff), modifiedFiles, commands: [], status: 'running' }
      summary.phases.push(record)
      await saveSummary()
      console.log(`${phase.id}: preparing and rebuilding independent source`)
      for (const args of [['exec', 'nuxt', 'prepare'], ['build:contrast']]) {
        const result = await runCommand(snapshot, 'pnpm', args, path.join(phaseDirectory, args[0] === 'exec' ? 'prepare.log' : 'build.log'))
        record.commands.push(result)
        await saveSummary()
        requireSuccess(result)
      }
      record.isolation = await verifySourceIsolation(snapshot)
      const built = JSON.parse(await readFile(path.join(snapshot, '.output/contrast/source.json'), 'utf8'))
      if (built.sha !== sourceSha || built.digest !== source.digest) throw new Error(`Build does not identify this source mutation: ${phase.id}`)
      await writeFile(path.join(phaseDirectory, 'build-source.json'), JSON.stringify(built, null, 2))
      if (!phase.file || phase.file === cssFile) {
        const node = await runCommand(snapshot, process.execPath, ['--test', 'tests/text-contrast.test.mjs'], path.join(phaseDirectory, 'node-test.log'))
        record.commands.push(node)
        const nodeLog = await readFile(node.logFile, 'utf8')
        if (phase.file === cssFile) {
          if (node.exitCode !== 1 || node.signal || node.error || !nodeLog.includes('Normal text contrast failed (10/40')) throw new Error('Old-token Node run did not fail for the expected contrast regression')
        }
        else requireSuccess(node)
      }
      const resultsFile = path.join(phaseDirectory, 'vitest-results.json')
      const browser = await runCommand(snapshot, 'pnpm', ['test:browser', '--reporter=default', '--reporter=json', `--outputFile=${resultsFile}`], path.join(phaseDirectory, 'browser.log'), { GEIST_CONTRAST_ARTIFACTS: browserDirectory })
      record.commands.push(browser)
      await saveSummary()
      const evidence = await readBrowserEvidence(browserDirectory, source, expectedBrowserManifest)
      const resultsText = await readFile(resultsFile, 'utf8')
      const results = validateBrowserResults(JSON.parse(resultsText), evidence, snapshot, expectedBrowserCases)
      record.browserResults = { file: resultsFile, sha256: sha256(resultsText), source, cases: results.cases, failedCases: results.failures.map(({ file, name }) => ({ file, name })) }
      await writeFile(path.join(phaseDirectory, 'browser-evidence.json'), JSON.stringify({ source, manifest: evidence.manifest, controls: evidence.controls, results: record.browserResults }, null, 2))
      if (!phase.file) {
        requireSuccess(browser)
        if (evidence.reports.some(report => report.failure || !report.records.length || report.records.some(record => record.ratio < 4.5))) throw new Error('Green run contains a failed or empty scenario')
        if (acceptedDigest && source.digest !== acceptedDigest) throw new Error('Restored A source differs from initial A')
        acceptedDigest = source.digest
        expectedBrowserManifest = evidence.manifest
        expectedBrowserCases = results.cases
      }
      else {
        if (browser.exitCode !== 1 || browser.signal || browser.error) throw new Error(`Mutation did not produce an ordinary failing test exit: ${phase.id}`)
        const log = await readFile(browser.logFile, 'utf8')
        if (/unresolved:|Unhandled Errors|Unhandled Rejection|Hook timed out|Test timed out|TimeoutError|browserType\.launch:|Failed to load/i.test(log)) throw new Error(`Infrastructure or unresolved failure invalidates ${phase.id}; see browser.log`)
        const targets = evidence.reports.flatMap(report => report.records).filter(record => phase.target(record) && record.ratio < 4.5)
        if (!['light', 'dark'].every(theme => targets.some(record => record.theme === theme))) throw new Error(`Both themes must fail at the intended target: ${phase.id}`)
        record.detected = targets.map(({ id, owner, state, theme, ratio, rawForeground, effectiveForeground, effectiveBackground }) => ({ id, owner, state, theme, ratio, rawForeground, effectiveForeground, effectiveBackground }))
      }
      const after = await contrastSource(snapshot)
      if (after.sha !== source.sha || after.digest !== source.digest) throw new Error(`Source changed during ${phase.id}`)
      record.status = phase.file ? 'expected-contrast-failure' : 'passed'
      record.browserReports = evidence.files
      await saveSummary()
      console.log(`${phase.id}: ${record.status}`)
    }
    summary.status = 'passed'
  }
  catch (error) {
    summary.status = 'failed'
    summary.error = error instanceof Error ? error.message : String(error)
    const active = summary.phases.find(phase => phase.status === 'running')
    if (active) active.status = 'failed'
    throw error
  }
  finally {
    summary.endedAt = new Date().toISOString()
    await saveSummary()
    console.log(`Retained evidence and isolated source: ${artifacts} ; ${snapshot}`)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const artifacts = artifactOption()
    if (artifacts) await main(artifacts)
  }
  catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
