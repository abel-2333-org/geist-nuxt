import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import postcss from 'postcss'
import { checkTextContrastFile } from '../scripts/check-text-contrast.mjs'
import { readBrowserEvidence, validateBrowserResults } from '../scripts/verify-contrast-mutations.mjs'
import {
  assertTextContrast, checkTextContrast, composite, contrastRatio,
  neutralBackgroundTokens, normalTextTokens, parseColor,
} from '../scripts/lib/text-contrast.mjs'

const sourcePath = fileURLToPath(new URL('../foundation/assets/css/main.css', import.meta.url))
const sourceCss = await readFile(sourcePath, 'utf8')
const scriptPath = fileURLToPath(new URL('../scripts/check-text-contrast.mjs', import.meta.url))

function changeDeclarations(transform) {
  const root = postcss.parse(sourceCss)
  root.walkDecls(transform)
  return root.toString()
}

function replaceLightText(value) {
  return changeDeclarations(declaration => {
    if (declaration.prop === '--ui-text-muted' && declaration.parent.selector.includes('.light')) declaration.value = value
  })
}

function oldTokenCss() {
  return changeDeclarations(declaration => {
    if (!['--ui-text-muted', '--ui-text-dimmed'].includes(declaration.prop)) return
    const dark = declaration.parent.selector === '.dark'
    declaration.value = declaration.prop === '--ui-text-muted' ? '#8f8f8f' : dark ? '#878787' : '#a8a8a8'
  })
}

test('actual production CSS covers every normal-text/background/theme pair at raw 4.5:1', async () => {
  const result = await checkTextContrastFile(sourcePath)
  assert.equal(result.pairs.length, 40)
  assert.equal(result.failures.length, 0)
  for (const theme of ['light', 'dark']) {
    for (const textToken of normalTextTokens) {
      for (const backgroundToken of neutralBackgroundTokens) {
        const matches = result.pairs.filter(pair => pair.theme === theme && pair.textToken === textToken && pair.backgroundToken === backgroundToken)
        assert.equal(matches.length, 1)
        assert.ok(matches[0].ratio >= 4.5)
      }
    }
  }
})

test('restoring the old muted/dimmed tokens catches all ten known failing pairs', () => {
  const result = checkTextContrast(oldTokenCss())
  assert.equal(result.pairs.length, 40)
  assert.equal(result.failures.length, 10)
  assert.equal(result.failures.filter(pair => pair.theme === 'light').length, 8)
  assert.equal(result.failures.filter(pair => pair.theme === 'dark').length, 2)
  assert.throws(() => assertTextContrast(oldTokenCss()), /Normal text contrast failed \(10\/40/)
})

test('the CLI reads its requested CSS and exits nonzero for the old production mapping', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'geist-text-contrast-'))
  try {
    const cssPath = path.join(directory, 'main.css')
    await writeFile(cssPath, oldTokenCss())
    const old = spawnSync(process.execPath, [scriptPath, cssPath], { encoding: 'utf8' })
    assert.equal(old.status, 1)
    assert.match(old.stderr, /Normal text contrast failed \(10\/40/)
    assert.match(execFileSync(process.execPath, [scriptPath, sourcePath], { encoding: 'utf8' }), /40\/40/)
  }
  finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('a ratio that rounds to 4.50 still fails the raw threshold', () => {
  const ratio = contrastRatio(parseColor('#8f8f8f'), parseColor('#292929'))
  assert.ok(Math.abs(ratio - 4.498542831521961) < 1e-12)
  assert.equal(ratio.toFixed(2), '4.50')
  const result = checkTextContrast(oldTokenCss())
  assert.ok(result.failures.some(pair => pair.theme === 'dark' && pair.textToken === '--ui-text-muted' && pair.backgroundToken === '--ui-bg-accented' && pair.ratio === ratio))
})

test('accepts supported hex and numeric sRGB forms without losing alpha', () => {
  assert.deepEqual(parseColor('#abc'), [170, 187, 204, 1])
  assert.deepEqual(parseColor('#abcd'), [170, 187, 204, 221 / 255])
  assert.deepEqual(parseColor('#AABBCCDD'), [170, 187, 204, 221 / 255])
  assert.deepEqual(parseColor('rgb(1.5, 2, 255)'), [1.5, 2, 255, 1])
  assert.deepEqual(parseColor('rgba(1, 2, 3, 0.5)'), [1, 2, 3, 0.5])
  assert.deepEqual(parseColor('rgb(1 2 3 / .5)'), [1, 2, 3, 0.5])
})

test('color parsing rejects negative, out-of-range, and unsupported values rather than clamping', () => {
  for (const color of [
    'rgb(-1 0 0)', 'rgb(256 0 0)', 'rgba(0, 0, 0, -0.1)', 'rgba(0, 0, 0, 1.01)',
    'rgb(1e2 0 0)', 'rgb(NaN 0 0)', 'rgb(10% 0% 0%)', 'rgb(1 2 3 / 50%)',
    'hsl(0 0% 0%)', 'oklch(.5 0 0)', 'color(display-p3 1 0 0)', 'black', 'transparent',
    '#fffff', '#gggggg', 'rgb(1 2)', 'rgb(1, 2, 3 / .5)', 'rgb(1 2 3 /)', 'rgb(1 2 3 / .5 / .5)',
  ]) assert.throws(() => parseColor(color), undefined, color)
})

test('composites alpha before contrast and rejects unresolved/non-finite inputs', () => {
  assert.deepEqual(composite([0, 0, 0, 0.5], [255, 255, 255, 1]), [127.5, 127.5, 127.5, 1])
  assert.deepEqual(composite([1, 2, 3, 0], [4, 5, 6, 0]), [0, 0, 0, 0])
  assert.equal(contrastRatio(parseColor('#000'), parseColor('#fff')), 21)
  assert.equal(contrastRatio(parseColor('#fff'), parseColor('#000')), 21)
  assert.throws(() => contrastRatio([0, 0, 0, 0.5], [255, 255, 255, 1]), /opaque/)
  for (const color of [[NaN, 0, 0, 1], [-1, 0, 0, 1], [256, 0, 0, 1], [0, 0, 0, 2], [0, 0, 0], new Array(4)]) {
    assert.throws(() => composite(color, [0, 0, 0, 1]), /finite RGB/)
    assert.throws(() => contrastRatio(color, [0, 0, 0, 1]), /finite RGB/)
  }
})

test('resolves full var aliases and applies equal-specificity root declarations in source order', () => {
  const direct = checkTextContrast(sourceCss)
  const aliases = checkTextContrast(sourceCss + '\n:root { --text-alias: #000; } .light { --ui-text-muted: var(--text-alias); } .dark { --text-alias: #fff; --ui-text-muted: var(--text-alias); }')
  for (const pair of aliases.pairs.filter(pair => pair.textToken === '--ui-text-muted')) {
    assert.deepEqual(pair.foreground, pair.theme === 'light' ? [0, 0, 0, 1] : [255, 255, 255, 1])
  }
  assert.equal(aliases.pairs.length, direct.pairs.length)
  const finalRoot = checkTextContrast(sourceCss + '\n:root { --ui-text-muted: #fff; }')
  assert.ok(finalRoot.pairs.filter(pair => pair.textToken === '--ui-text-muted').every(pair => pair.foreground[0] === 255))
})

test('missing tokens, missing theme aliases, cycles and var fallbacks fail closed', () => {
  const missing = changeDeclarations(declaration => {
    if (declaration.prop === '--ui-text-muted') declaration.remove()
  })
  assert.throws(() => checkTextContrast(missing), /Missing token: --ui-text-muted/)
  assert.throws(() => checkTextContrast(replaceLightText('var(--missing)')), /Missing token: --missing/)
  assert.throws(() => checkTextContrast(sourceCss + '\n.light { --ui-text-muted: var(--dark-only); } .dark { --dark-only: #fff; }'), /Missing token in light: --dark-only/)
  assert.throws(() => checkTextContrast(replaceLightText('var(--ui-text-muted)')), /Circular token reference/)
  assert.throws(() => checkTextContrast(sourceCss + '\n:root { --loop-a: var(--loop-b); --loop-b: var(--loop-a); } .light { --ui-text-muted: var(--loop-a); }'), /Circular token reference/)
  assert.throws(() => checkTextContrast(replaceLightText('var(--ui-text, #000)')), /Unsupported color format/)
})

test('related conditional, nested, selector, important, and registered-property overrides fail closed', () => {
  for (const override of [
    '@media (min-width: 1px) { :root { --ui-text-muted: #000; } }',
    '@supports (color: red) { .dark { --ui-text-muted: #fff; } }',
    '@layer theme { :root { --ui-text-muted: #000; } }',
    '@theme static { --ui-text-muted: #000; }',
    '@keyframes fade { to { --ui-text-muted: #000; } }',
    '.component { --ui-text-muted: #000; }',
    'html.dark { --ui-text-muted: #fff; }',
    ':root, .unknown { --ui-text-muted: #000; }',
    ':root { .light { --ui-text-muted: #000; } }',
    '.light { --ui-text-muted: #000 !important; }',
    '@property --ui-text-muted { syntax: "<color>"; inherits: true; initial-value: #000; }',
    ':root { --ui-text-muted: var(--related); --related: #000; } @media print { :root { --related: #fff; } }',
  ]) assert.throws(() => checkTextContrast(sourceCss + '\n' + override), undefined, override)
})

test('invalid values in shadowed declarations cannot be silently skipped', () => {
  for (const value of ['var(--missing, #000)', 'var(--ui-text-muted)', 'rgb(-1 0 0)', 'rgb(256 0 0)', 'oklch(.5 0 0)', 'rgba(0, 0, 0, .7)']) {
    assert.throws(() => checkTextContrast(sourceCss + `\n.light { --ui-text-muted: ${value}; --ui-text-muted: #000; }`), undefined, value)
  }
})

test('unknown, conditional, late, nested imports and escaped token names are rejected', () => {
  for (const css of [
    '@import "other.css";\n' + sourceCss,
    '@IMPORT "other.css";\n' + sourceCss,
    '@import "@nuxt/ui" screen;\n' + sourceCss,
    sourceCss + '\n@import "@nuxt/ui";',
    sourceCss + '\n@media print { @import "@nuxt/ui"; }',
    sourceCss + '\n:root { --ui\\2d text: #000; }',
    sourceCss + '\n:root { \\2d-ui-text: #000; }',
    sourceCss + '\n:root { @apply unknown-token-utility; }',
    sourceCss + '\n@PROPERTY --ui-text-muted { syntax: "<color>"; inherits: true; initial-value: #000; }',
  ]) assert.throws(() => checkTextContrast(css))
})

test('non-ASCII whitespace cannot turn an unrelated selector or invalid color into a passing token', () => {
  for (const whitespace of ['\u00a0', '\u2003', '\u2028', '\ufeff']) {
    const misleading = oldTokenCss() + `\n.light${whitespace} { --ui-text-muted: #000; --ui-text-dimmed: #000; } .dark${whitespace} { --ui-text-muted: #fff; --ui-text-dimmed: #fff; }`
    assert.throws(() => checkTextContrast(misleading), /Unsupported token selector/)
    for (const color of [`rgb(0${whitespace}0${whitespace}0)`, `${whitespace}#000`, `#000${whitespace}`, `rgb(${whitespace}0,0,0)`, `rgb(0 0 0 /${whitespace}1)`]) {
      assert.throws(() => parseColor(color), undefined, JSON.stringify(color))
    }
    assert.throws(() => checkTextContrast(replaceLightText(`var(${whitespace}--ui-text)`)), /Unsupported color format/)
  }
  assert.deepEqual(parseColor('\t\r\n\f rgb(0\t0\n0 /\r 1) '), [0, 0, 0, 1])
})

const browserSource = { sha: 'a'.repeat(40), digest: 'b'.repeat(64) }
const blackOnWhite = () => ({ text: 'actual text', effectiveForeground: [0, 0, 0, 1], effectiveBackground: [255, 255, 255, 1], ratio: 21 })
const lowContrast = () => ({ ...blackOnWhite(), effectiveForeground: [255, 255, 255, 1], ratio: 1 })
async function browserArtifacts(run) {
  const directory = await mkdtemp(path.join(tmpdir(), 'geist-browser-evidence-'))
  const put = async (file, report) => {
    await mkdir(path.dirname(path.join(directory, file)), { recursive: true })
    await writeFile(path.join(directory, file), JSON.stringify(report))
  }
  try { await run(directory, put) }
  finally { await rm(directory, { recursive: true, force: true }) }
}
async function ordinaryPair(put) {
  for (const theme of ['light', 'dark']) await put(`${theme}-matrix.json`, { source: browserSource, records: [{ theme, id: 'normal text', ...blackOnWhite() }] })
}

test('mutation reader retains direct, nested motion, functional and detector evidence with source identity', async () => {
  await browserArtifacts(async (directory, put) => {
    await ordinaryPair(put)
    for (const theme of ['light', 'dark']) {
      await put(`${theme}-optional-trigger-motion.json`, { source: browserSource, theme, records: [{ state: 'hover', motion: 'reduce', expected: {}, computed: {}, readinessFailure: null, rejection: null, measurement: blackOnWhite() }] })
      await put(`functional/${theme}-390-api-default.json`, { source: browserSource, theme, pageErrors: [], summary: { pass: 1, fail: 0, unresolved: 0, unverified: 0 }, records: [{ theme, component: 'FieldItem', status: 'pass', ...blackOnWhite() }], evidence: [] })
      await put(`${theme}-generated-paint.json`, { source: browserSource, theme, evidence: [
        { source: browserSource, theme, state: 'normal', classification: 'positive detector control', measurement: blackOnWhite() },
        { source: browserSource, theme, state: 'low', classification: 'numeric negative control', measurement: lowContrast() },
        { source: browserSource, theme, state: 'outline', classification: 'negative detector control', measurement: null, rejection: 'unresolved: overlapping outline' },
      ] })
    }
    const result = await readBrowserEvidence(directory, browserSource)
    assert.equal(result.files.length, 8)
    assert.equal(result.reports.flatMap(report => report.records).length, 8)
    assert.equal(result.controls.length, 4)
    assert.ok(result.reports.flatMap(report => report.records).every(row => row.ratio === 21))
    assert.equal(result.reports.find(report => report.file === 'dark-optional-trigger-motion.json').records[0].theme, 'dark')
    assert.deepEqual((await readBrowserEvidence(directory, browserSource, result.manifest)).manifest, result.manifest)
    await rm(path.join(directory, 'functional/light-390-api-default.json'))
    await assert.rejects(readBrowserEvidence(directory, browserSource, result.manifest), /Missing other-theme|scenario set/)
  })
})

test('mutation reader rejects malformed, unresolved and falsely classified measurements', async () => {
  const invalid = [
    ['source SHA', { source: { ...browserSource, sha: 'c'.repeat(40) }, records: [blackOnWhite()] }],
    ['source digest', { source: { ...browserSource, digest: 'c'.repeat(64) }, records: [blackOnWhite()] }],
    ['missing source', { source: undefined, records: [blackOnWhite()] }],
    ['raw ratio', { records: [{ ...blackOnWhite(), ratio: 20 }] }],
    ['alpha is not opaque', { records: [{ ...blackOnWhite(), effectiveForeground: [0, 0, 0, .5] }] }],
    ['unresolved', { records: [{ status: 'unresolved', reason: 'unsupported paint' }] }],
    ['unverified', { records: [{ status: 'unverified' }] }],
    ['false pass', { records: [{ ...lowContrast(), status: 'pass' }] }],
    ['unknown record', { records: [{ checkpoint: blackOnWhite() }] }],
    ['unknown sibling container', { records: [{ ...blackOnWhite(), measurements: [lowContrast()] }] }],
    ['empty records', { records: [] }],
    ['page error', { pageErrors: ['runtime error'], records: [blackOnWhite()] }],
    ['infra error', { infrastructureError: 'assertion failed', records: [blackOnWhite()] }],
    ['motion readiness', { records: [{ state: 'idle', readinessFailure: 'not ready', rejection: null, measurement: blackOnWhite() }] }],
    ['nested motion page error', { records: [{ state: 'idle', computed: { pageErrors: ['runtime error'] }, readinessFailure: null, rejection: null, measurement: blackOnWhite() }] }],
    ['motion rejection', { records: [{ state: 'idle', readinessFailure: null, rejection: 'unresolved: paint', measurement: blackOnWhite() }] }],
    ['missing nested measurement', { records: [{ state: 'idle', readinessFailure: null, rejection: null, measurement: null }] }],
    ['unexpected positive rejection', { state: 'idle', classification: 'positive detector control', measurement: blackOnWhite(), rejection: 'unresolved: paint' }],
    ['positive mixes direct and nested measurement', { classification: 'positive detector control', measurement: blackOnWhite(), ...lowContrast() }],
    ['negative returned measurement', { classification: 'negative detector control', measurement: blackOnWhite(), rejection: 'unresolved: paint' }],
    ['rejection hides direct measurement', { classification: 'negative detector control', measurement: null, rejection: 'unresolved: paint', ...lowContrast() }],
    ['negative infrastructure error', { classification: 'negative detector control', measurement: null, rejection: 'TimeoutError' }],
    ['numeric negative actually passes', { classification: 'numeric negative control', measurement: blackOnWhite() }],
    ['false alpha outcome', { classification: 'original alpha diagnostic; actual outcome retained, not a positive suite red run', outcome: 'pass', ...lowContrast() }],
    ['alpha hides nested measurement', { classification: 'original alpha diagnostic; actual outcome retained, not a positive suite red run', outcome: 'pass', ...blackOnWhite(), measurement: lowContrast() }],
    ['disabled hides nested measurement', { classification: 'native disabled exception; not normal-text acceptance', ...blackOnWhite(), measurements: [lowContrast()] }],
    ['numeric negative mixes nested shapes', { classification: 'numeric negative control', measurement: lowContrast(), measurements: [blackOnWhite()] }],
    ['unknown report', { observation: { sample: blackOnWhite() } }],
    ['unknown classification', { classification: 'probably fine', measurement: blackOnWhite() }],
    ['motion proof failed', { records: [blackOnWhite()], evidence: [{ classification: 'motion proof violations', violations: ['color changed'] }] }],
    ['non-numeric assertion', { records: [lowContrast()], failure: 'AssertionError: expected label to exist < 4.5' }],
  ]
  for (const [name, report] of invalid) await browserArtifacts(async (directory, put) => {
    await ordinaryPair(put)
    await put('light-invalid.json', { source: browserSource, ...report })
    await put('dark-invalid.json', { source: browserSource, ...report })
    await assert.rejects(readBrowserEvidence(directory, browserSource), undefined, name)
  })
})

test('mutation reader keeps numeric failures and notices missing samples between complete phases', async () => {
  await browserArtifacts(async (directory, put) => {
    await ordinaryPair(put)
    const accepted = await readBrowserEvidence(directory, browserSource)
    for (const theme of ['light', 'dark']) await put(`${theme}-matrix.json`, { source: browserSource,
      failure: 'AssertionError: ordinary text contrast: one or more raw ratios < 4.5: expected [ … ] to deeply equal []',
      records: [{ theme, id: 'normal text', ...lowContrast() }] })
    const mutated = await readBrowserEvidence(directory, browserSource, accepted.manifest)
    assert.deepEqual(mutated.reports.flatMap(report => report.records).map(row => row.ratio), [1, 1])
    await put('light-matrix.json', { source: browserSource, records: [{ theme: 'light', id: 'different sample', ...lowContrast() }] })
    await assert.rejects(readBrowserEvidence(directory, browserSource, accepted.manifest), /measurement identity changed/)
  })
})

function vitestResult(status = 'passed', messages = []) {
  return { numTotalTestSuites: 1, numPassedTestSuites: status === 'passed' ? 1 : 0, numFailedTestSuites: status === 'failed' ? 1 : 0, numTotalTests: 1, numPassedTests: status === 'passed' ? 1 : 0, numFailedTests: status === 'failed' ? 1 : 0, numPendingTests: 0, numTodoTests: 0, numPendingTestSuites: 0, success: status === 'passed',
    testResults: [{ name: '/snapshot/tests/browser/functional-colors.spec.ts', status, message: '', assertionResults: [{ fullName: 'light: actual labels', title: 'light: actual labels', ancestorTitles: [], status, failureMessages: messages }] }] }
}
const numericFailure = 'AssertionError: all ordinary text must resolve at >= 4.5 without rounding: expected [ … ] to deeply equal []\n    at scenario (/snapshot/tests/browser/functional-support.ts:149:132)'
const numericEvidence = { reports: [{ records: [{ ...lowContrast(), theme: 'light' }] }] }
test('mutation verifier accepts only complete Vitest cases with individually proven numeric failures', () => {
  const passing = validateBrowserResults(vitestResult(), { reports: [] }, '/snapshot')
  const failing = validateBrowserResults(vitestResult('failed', [numericFailure]), numericEvidence, '/snapshot', passing.cases)
  assert.equal(failing.failures.length, 1)
  for (const result of [
    vitestResult('failed', [numericFailure, 'AssertionError: keyboard focus < 4.5 is not the expected element']),
    vitestResult('failed', ['Error: all ordinary text must resolve at >= 4.5 without rounding: expected [ … ] to deeply equal []']),
    vitestResult('failed', [numericFailure.replace('/snapshot/tests/browser/functional-support.ts', '/elsewhere/tests/browser/functional-support.ts')]),
    vitestResult('failed', [numericFailure.replace('all ordinary text must resolve at >= 4.5 without rounding', 'page must expose a label < 4.5')]),
    vitestResult('passed', [numericFailure]),
    vitestResult('failed', []),
    { ...vitestResult(), numTotalTests: 2 },
    { ...vitestResult(), numFailedTestSuites: 1 },
    { ...vitestResult(), numTotalTestSuites: 2 },
    { ...vitestResult(), numPendingTests: 1 },
    { ...vitestResult(), numTodoTests: 1 },
    { ...vitestResult(), success: false },
  ]) assert.throws(() => validateBrowserResults(result, numericEvidence, '/snapshot'))
  const hookFailure = vitestResult('failed', [numericFailure]); hookFailure.testResults[0].message = 'beforeAll crashed'
  assert.throws(() => validateBrowserResults(hookFailure, numericEvidence, '/snapshot'), /Invalid Vitest suite/)
  const skipped = vitestResult(); skipped.testResults[0].assertionResults[0].status = 'skipped'
  assert.throws(() => validateBrowserResults(skipped, numericEvidence, '/snapshot'), /Incomplete Vitest test/)
  const renamed = vitestResult(); renamed.testResults[0].assertionResults[0].fullName = renamed.testResults[0].assertionResults[0].title = 'new unexpected test'
  assert.throws(() => validateBrowserResults(renamed, numericEvidence, '/snapshot', passing.cases), /case identity changed/)
  assert.throws(() => validateBrowserResults(vitestResult('failed', [numericFailure]), { reports: [] }, '/snapshot'), /no measured failing ratio/)
})
