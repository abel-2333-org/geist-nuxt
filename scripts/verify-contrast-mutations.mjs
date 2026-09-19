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
      timeout: 20 * 60_000,
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

async function readBrowserEvidence(directory, source, expectedFiles) {
  const reports = []
  for (const file of (await readdir(directory)).filter(file => file.endsWith('.json')).sort()) {
    const report = JSON.parse(await readFile(path.join(directory, file), 'utf8'))
    if (!Array.isArray(report.records)) continue // e.g. the arrival animation timeline
    if (report.source?.sha !== source.sha || report.source?.digest !== source.digest) throw new Error(`Mismatched browser source: ${file}`)
    for (const record of report.records) {
      const ratio = contrastRatio(record.effectiveForeground, record.effectiveBackground)
      if (!Number.isFinite(record.ratio) || Math.abs(ratio - record.ratio) > 1e-10) throw new Error(`Unresolved or invalid contrast record: ${file}`)
    }
    reports.push({ file, ...report })
  }
  const files = reports.map(report => report.file)
  if (!files.length || !['light', 'dark'].every(theme => reports.some(report => report.records.some(record => record.theme === theme)))) throw new Error('Browser evidence must include both themes and nonempty measurements')
  if (expectedFiles && JSON.stringify(files) !== JSON.stringify(expectedFiles)) throw new Error('Browser scenario set changed or some scenarios did not produce evidence')
  return { files, reports }
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
    let expectedBrowserFiles
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
      const browser = await runCommand(snapshot, 'pnpm', ['test:browser'], path.join(phaseDirectory, 'browser.log'), { GEIST_CONTRAST_ARTIFACTS: browserDirectory })
      record.commands.push(browser)
      await saveSummary()
      const evidence = await readBrowserEvidence(browserDirectory, source, expectedBrowserFiles)
      if (!phase.file) {
        requireSuccess(browser)
        if (evidence.reports.some(report => report.failure || !report.records.length || report.records.some(record => record.ratio < 4.5))) throw new Error('Green run contains a failed or empty scenario')
        if (acceptedDigest && source.digest !== acceptedDigest) throw new Error('Restored A source differs from initial A')
        acceptedDigest = source.digest
        expectedBrowserFiles = evidence.files
      }
      else {
        if (browser.exitCode !== 1 || browser.signal || browser.error) throw new Error(`Mutation did not produce an ordinary failing test exit: ${phase.id}`)
        const log = await readFile(browser.logFile, 'utf8')
        if (/unresolved:|Unhandled Errors|Unhandled Rejection|Hook timed out|Test timed out|TimeoutError|browserType\.launch:|Failed to load/i.test(log)) throw new Error(`Infrastructure or unresolved failure invalidates ${phase.id}; see browser.log`)
        for (const report of evidence.reports.filter(report => report.failure)) {
          if (!/<\s*4\.5/.test(report.failure) || !report.records.some(record => record.ratio < 4.5)) throw new Error(`Non-contrast failure invalidates ${phase.id}: ${report.file}`)
        }
        const targets = evidence.reports.filter(report => report.failure && /<\s*4\.5/.test(report.failure)).flatMap(report => report.records).filter(record => phase.target(record) && record.ratio < 4.5)
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

try {
  const artifacts = artifactOption()
  if (artifacts) await main(artifacts)
}
catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
