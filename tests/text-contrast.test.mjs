import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import postcss from 'postcss'
import { checkTextContrastFile } from '../scripts/check-text-contrast.mjs'
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
