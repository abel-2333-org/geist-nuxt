// Guard for the 13px type tier (`text-code`, foundation/assets/css/main.css).
//
// `.text-code` carries its own line-height, so Tailwind emits it BEFORE the
// stock size tiers (`.text-sm`, `.text-xs`, …). On bare markup — plain Vue class
// concatenation, no tailwind-merge — pairing `text-code` with a stock size in
// the same class list silently renders the stock size (and an `!important`
// size always wins). Through a component's class prop tailwind-merge resolves
// the pair, but authoring both is still a contradiction.
// references/foundations/typography.md states the rule; this test enforces it
// across every source tree the root app compiles.
//
// What counts as one class list:
//  - a static class attribute (`class`, `trigger-class`, `contentClass`) as a whole;
//  - each string literal inside a bound class attribute (`:class`, `:ui`,
//    `:trigger-class`) and in script / .ts code;
//  - inside a bound class attribute only: the plain members of an innermost
//    array, joined — `['text-code', { on }, 'text-sm']`. Object members and
//    `${}` interpolations are dropped first: they contribute conditional keys
//    or another slot's classes, not this list. An array whose remaining
//    members use a conditional operator, or keep an unpaired brace, is skipped.
// Arrays in script code are never joined: there they are overwhelmingly data
// (type-scale tables, menu items), and joining them would flag a gallery table
// that lists `text-code` next to `text-sm` as two separate rows.
// Deliberately allowed: variant-prefixed sizes (`md:text-sm` is a responsive
// switch) and literals separated by `?:`, `&&` or `||` — exclusive branches
// must not be flagged.
// Known misses, accepted for a regex-level guard: pairings assembled from
// conditional array members or object-syntax keys, a whole array skipped
// because one sibling member is conditional, nested arrays,
// `+` concatenation, class arrays in script code, CSS /
// `@apply` (the repo has none), a `/*` or `</script>` inside a string literal.
// Non-class attributes and template prose are out of scope by design.
// Known cost: a single string literal that contains both tiers is always
// flagged, even when it is documentation (an anti-pattern sample, pre-rendered
// HTML). Show the anti-pattern in template prose or split the string instead
// of weakening the guard.
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE_ROOTS = ['app', 'foundation', 'kits', 'playground']
const SOURCE_EXTENSIONS = new Set(['.vue', '.ts'])
// Tailwind v4 writes important as a trailing `!`; the v3 leading form still parses.
const CODE_TIER = /^!?text-code!?$/
const STOCK_SIZE = /^!?text-(?:xs|sm|base|lg|xl|[2-9]xl)!?$/
const CLASS_ATTRIBUTE = /(?:^|-)class$|Class$|^ui$/
const CONDITIONAL = /\?|&&|\|\|/

/**
 * Comments go first so prose apostrophes cannot open a bogus string literal.
 * Known limit: a `/*` inside a string literal is treated as a comment opener.
 */
function stripScriptComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    // Line comments only after line start / whitespace, so `https://…` survives.
    .replace(/(^|\s)\/\/[^\n]*/g, '$1')
}

function stringLiterals(code) {
  return [...code.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)].map(match => match[2])
}

/** Drops `{…}` object members and `${…}` interpolations, innermost first. */
function withoutBracedFragments(code) {
  let previous
  do {
    previous = code
    code = code.replace(/\$?\{[^{}]*\}/g, ' ')
  } while (code !== previous)
  return code
}

/** The plain members of an innermost array are one class list. */
function joinedPlainArrays(expression) {
  return [...expression.matchAll(/\[([^[\]]*)\]/g)]
    .map(match => withoutBracedFragments(match[1]))
    // A leftover brace means a string member held an unpaired `{` / `}` and the
    // fragments above may have swallowed member separators: do not guess.
    .filter(members => !CONDITIONAL.test(members) && !/[{}]/.test(members))
    .map(members => stringLiterals(members).join(' '))
}

function boundAttributeSegments(expression) {
  return [...stringLiterals(expression), ...joinedPlainArrays(expression)]
}

export function classStrings(source, { vue = true } = {}) {
  if (!vue) return stringLiterals(stripScriptComments(source))

  const segments = []
  const template = source
    .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/g, (_, code) => {
      segments.push(...stringLiterals(stripScriptComments(code)))
      return ' '
    })
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')

  for (const [, rawName, , value] of template.matchAll(/([:@#]?[\w.:-]+)\s*=\s*(["'])((?:(?!\2)[^])*)\2/g)) {
    const bound = rawName.startsWith(':') || rawName.startsWith('v-bind:')
    const name = rawName.replace(/^(?::|v-bind:)/, '')
    if (rawName.startsWith('@') || rawName.startsWith('#') || !CLASS_ATTRIBUTE.test(name)) continue
    segments.push(...(bound ? boundAttributeSegments(value) : [value]))
  }
  return segments
}

/** Class lists that pair an unprefixed `text-code` with an unprefixed stock size. */
export function findPairings(source, options) {
  const pairings = classStrings(source, options).filter((segment) => {
    const tokens = segment.split(/\s+/)
    return tokens.some(token => CODE_TIER.test(token)) && tokens.some(token => STOCK_SIZE.test(token))
  })
  return [...new Set(pairings)]
}

async function sourceFiles(directory) {
  const files = []
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  }
  catch (error) {
    if (error.code === 'ENOENT') return files
    throw error
  }
  for (const entry of entries) {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await sourceFiles(target))
    else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) files.push(target)
  }
  return files
}

const inTemplate = markup => `<template>${markup}</template>`

test('flags text-code paired with a stock size in a static class attribute', () => {
  assert.deepEqual(
    findPairings(inTemplate('<code class="font-mono text-code text-sm">x</code>')),
    ['font-mono text-code text-sm'],
  )
  assert.deepEqual(
    findPairings(inTemplate('<code class="font-mono text-code\n    text-sm">x</code>')),
    ['font-mono text-code\n    text-sm'],
  )
  assert.deepEqual(
    findPairings(inTemplate('<AnnotationPopover trigger-class="text-xs text-code" />')),
    ['text-xs text-code'],
  )
  assert.deepEqual(
    findPairings(inTemplate('<FieldAnnotation triggerClass="text-code text-base" />')),
    ['text-code text-base'],
  )
  assert.deepEqual(findPairings(inTemplate('<code class=\'text-code text-lg\'>x</code>')), ['text-code text-lg'])
})

test('flags important modifiers on either tier', () => {
  for (const value of ['text-code !text-sm', 'text-code text-sm!', '!text-sm text-code', 'text-code! text-xs']) {
    assert.deepEqual(findPairings(inTemplate(`<code class="${value}">x</code>`)), [value], value)
  }
})

test('flags pairings inside bound class attributes', () => {
  assert.deepEqual(
    findPairings(inTemplate(`<p :class="dense ? 'text-code text-xs' : 'text-sm'" />`)),
    ['text-code text-xs'],
  )
  assert.deepEqual(findPairings(inTemplate(`<p :class="{ 'text-code text-sm': on }" />`)), ['text-code text-sm'])
  assert.deepEqual(findPairings(inTemplate('<p :class="`text-code ${tone} text-sm`" />')), ['text-code ${tone} text-sm'])
  assert.deepEqual(findPairings(inTemplate(`<p :class="['font-mono', 'text-code', 'text-sm']" />`)), ['font-mono text-code text-sm'])
  assert.deepEqual(findPairings(inTemplate(`<UBadge :ui="{ base: 'text-code text-xs' }" />`)), ['text-code text-xs'])
  assert.deepEqual(findPairings(inTemplate(`<UBadge :ui="{ base: ['text-code', 'text-xs'] }" />`)), ['text-code text-xs'])
})

test('joins the plain members of arrays that also hold objects or interpolations', () => {
  assert.deepEqual(
    findPairings(inTemplate(`<p :class="['text-code', { 'font-bold': strong && loud }, 'text-sm']" />`)),
    ['text-code text-sm'],
  )
  assert.deepEqual(
    findPairings(inTemplate(`<p :class="[base, 'text-code', 'text-sm', { on }]" />`)),
    ['text-code text-sm'],
  )
  // The interpolation is dropped; assert the one report names both tiers, not its spacing.
  const interpolated = findPairings(inTemplate('<p :class="[\'text-code\', `gap-${n}`, \'text-sm\']" />'))
  assert.equal(interpolated.length, 1)
  assert.match(interpolated[0], /(?:^|\s)text-code(?:\s|$)/)
  assert.match(interpolated[0], /(?:^|\s)text-sm(?:\s|$)/)
  assert.deepEqual(
    findPairings(inTemplate(`<p :class="['text-code', { nested: { deep: true } }, 'text-xs!']" />`)),
    ['text-code text-xs!'],
  )
})

test('flags pairings in script and .ts string literals', () => {
  assert.deepEqual(
    findPairings(`export default { ui: { badge: { base: 'text-base text-code' } } }`, { vue: false }),
    ['text-base text-code'],
  )
  assert.deepEqual(
    findPairings(`export const theme = { base: "px-1 text-code text-sm" }`, { vue: false }),
    ['px-1 text-code text-sm'],
  )
  assert.deepEqual(
    findPairings(`<script setup lang="ts">\nconst chip = 'text-code text-xs'\n</script>\n<template><i /></template>`),
    ['text-code text-xs'],
  )
})

test('allows single tiers, exclusive branches and responsive switches', () => {
  const allowed = [
    '<code class="font-mono text-code text-toned">x</code>',
    `<p :class="dense ? 'text-code' : 'text-sm'" />`,
    `<p :class="[dense ? 'text-code' : 'text-sm', 'font-mono']" />`,
    `<p :class="['font-mono', dense && 'text-code', 'text-sm']" />`,
    `<p :class="[{ 'text-code': mono }, { 'text-sm': !mono }]" />`,
    '<code class="text-code md:text-sm dark:text-xs">x</code>',
    '<code class="font-mono text-[13px] text-sm">x</code>',
    '<InlineCode class="text-xs">x</InlineCode><code class="text-code">y</code>',
  ]
  for (const markup of allowed) assert.deepEqual(findPairings(inTemplate(markup)), [], markup)
  assert.deepEqual(findPairings(inTemplate('<code class="text-code md:text-sm text-xs">x</code>')), ['text-code md:text-sm text-xs'])
})

test('documents accepted misses so tightening the guard is a deliberate change', () => {
  // Real or possible pairings the regex-level guard does not report (see the
  // header). They are pinned here as misses, not as correct "allowed" input.
  const misses = [
    `<p :class="['text-code', { 'text-sm': dense }]" />`,
    `<p :class="[dense ? { a } : { b }, 'text-code', 'text-sm']" />`,
    `<p :class="[['text-code'], ['text-sm']]" />`,
  ]
  for (const markup of misses) assert.deepEqual(findPairings(inTemplate(markup)), [], markup)
})

test('skips an array when a string member keeps an unpaired brace', () => {
  const markup = `<p :class="['text-code', { k: 'text-sm{' }, { k: 'text-sm{' }]" />`
  assert.deepEqual(findPairings(inTemplate(markup)), [])
})

test('never joins data arrays or separate slots into one class list', () => {
  const typeScale = [
    '<script setup lang="ts">',
    'const typeScale = [',
    "  { label: 'Code', class: 'text-code', sample: '13px inline code' },",
    "  { label: 'Body', class: 'text-sm', sample: 'Default body' },",
    ']',
    "const TIERS = ['text-code', 'text-sm', 'text-base']",
    '</script>',
    '<template><i /></template>',
  ].join('\n')
  assert.deepEqual(findPairings(typeScale), [])
  assert.deepEqual(
    findPairings(`export const rows = [{ label: 'a', class: 'text-code' }, { label: 'b', class: 'text-sm' }]`, { vue: false }),
    [],
  )
  const slots = [
    `<UBadge :ui="{ slots: [{ base: 'text-code' }, { base: 'text-sm' }] }" />`,
    `<UBadge :ui="{ base: 'text-code', label: 'text-sm' + gap }" />`,
  ]
  for (const markup of slots) assert.deepEqual(findPairings(inTemplate(markup)), [], markup)
})

test('ignores non-class attributes, handlers and template prose', () => {
  const ignored = [
    '<span title="text-code 与 text-sm 冲突">x</span>',
    '<button aria-label="text-code text-sm">x</button>',
    '<img alt="text-code text-sm demo">',
    `<li v-for="k in ['text-code text-sm demo']" :key="k" />`,
    `<button @click="set('text-code text-sm')">x</button>`,
    `<p>Don't write text-code next to text-sm on a bare element; it's silently lost</p>`,
    '<p>"text-code text-sm 不能并写"</p>',
  ]
  for (const markup of ignored) assert.deepEqual(findPairings(inTemplate(markup)), [], markup)
})

test('ignores comments without letting them hide a real pairing', () => {
  const commented = [
    '<script setup lang="ts">',
    '// the primitive\'s text-sm gives way to the atom\'s text-code text-sm pairing',
    '/* text-code text-sm */',
    'const docs = "https://example.com/text-code"',
    '</script>',
    '<template><!-- text-code text-sm --><code class="text-code">x</code></template>',
  ].join('\n')
  assert.deepEqual(findPairings(commented), [])
  assert.deepEqual(
    findPairings(inTemplate('<p>a // b <code class="text-code text-sm">x</code></p>')),
    ['text-code text-sm'],
  )
})

test('no source file pairs text-code with a stock size tier', async () => {
  const violations = []
  for (const root of SOURCE_ROOTS) {
    for (const file of await sourceFiles(path.join(repoRoot, root))) {
      const pairings = findPairings(await readFile(file, 'utf8'), { vue: file.endsWith('.vue') })
      for (const pairing of pairings) violations.push(`${path.relative(repoRoot, file)}: "${pairing}"`)
    }
  }
  assert.deepEqual(
    violations,
    [],
    'text-code already sets font-size + line-height; drop the stock size tier (see references/foundations/typography.md)',
  )
})
