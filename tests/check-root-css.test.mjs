import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { checkRootCss, checkSubtreeCss, requiredMarkers, resolvePublicRoot } from '../scripts/check-root-css.mjs'

const baseCss = '.subtree{border-inline-start-style:solid;border-inline-start-width:1px;border-inline-start-color:var(--ui-border);padding-inline-start:calc(var(--spacing)*3)}'
const stepCss = '.subtree{padding-inline-start:calc(var(--spacing)*4)}'
const galleryCss = `
:root{--breakpoint-sm:401px;--ui-container:100%;--api-docs-nav-w:15rem}
.text-code{font-size:var(--text-code);line-height:var(--tw-leading,var(--text-code--line-height))}
.max-w-28{max-width:7rem}
.touch-manipulation{touch-action:manipulation}
.max-sm\\:px-1\\.5{padding-inline:.375rem}
.scroll-mt-24{scroll-margin-top:6rem}
${baseCss}
`

async function buildFixture(relativePublicRoot, responsiveCss = `@container field (min-width:24rem){${stepCss}}`) {
  const root = await mkdtemp(path.join(tmpdir(), 'geist-root-css-'))
  const publicRoot = path.join(root, relativePublicRoot)
  await mkdir(publicRoot, { recursive: true })
  await writeFile(path.join(publicRoot, 'entry.css'), galleryCss + responsiveCss)
  return { root, publicRoot }
}

test('checks the default Nitro public output', async () => {
  const { root, publicRoot } = await buildFixture('.output/public')
  assert.equal(await resolvePublicRoot({ root, isVercel: false }), publicRoot)
  assert.deepEqual(await checkRootCss({ root, isVercel: false }), {
    publicRoot,
    markerCount: requiredMarkers.length + 1,
  })
})

test('checks the Vercel Nitro static output', async () => {
  const { root, publicRoot } = await buildFixture('.vercel/output/static')
  assert.equal(await resolvePublicRoot({ root, isVercel: true }), publicRoot)
  assert.deepEqual(await checkRootCss({ root, isVercel: true }), {
    publicRoot,
    markerCount: requiredMarkers.length + 1,
  })
})

test('fails when Nitro produced no public output', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'geist-root-css-missing-'))
  await assert.rejects(
    resolvePublicRoot({ root, isVercel: true }),
    /No Nitro public output directory found/,
  )
})

for (const condition of ['min-width:24rem', 'width>=24rem', '24rem <= width']) {
  test(`shared subtree check accepts field (${condition})`, () => {
    assert.doesNotThrow(() => checkSubtreeCss(`${baseCss}@layer utilities{@container field (${condition}){${stepCss}}}`))
  })
}

const invalidSteps = {
  'viewport media query': `@media (min-width:24rem){${stepCss}}`,
  'wrong container': `@container other (min-width:24rem){${stepCss}}`,
  'unnamed container': `@container (min-width:24rem){${stepCss}}`,
  'maximum width': `@container field (max-width:24rem){${stepCss}}`,
  'reverse range': `@container field (width<=24rem){${stepCss}}`,
  'reverse operand range': `@container field (24rem>=width){${stepCss}}`,
  'exclusive range': `@container field (width>24rem){${stepCss}}`,
  'wrong threshold': `@container field (width>=28rem){${stepCss}}`,
  'missing step': '',
  'unrelated selector': '@container field (min-width:24rem){.other{padding-inline-start:calc(var(--spacing)*4)}}',
  'wrong indent': '@container field (min-width:24rem){.subtree{padding-inline-start:calc(var(--spacing)*5)}}',
  'commented query': `/* @container field (min-width:24rem){${stepCss}} */`,
  'extra media constraint': `@media (min-width:60rem){@container field (min-width:24rem){${stepCss}}}`,
}

for (const [label, responsiveCss] of Object.entries(invalidSteps)) {
  test(`root and shared consumer check reject ${label}`, async () => {
    assert.throws(() => checkSubtreeCss(baseCss + responsiveCss), /subtree indent step/)
    const { root } = await buildFixture('.output/public', responsiveCss)
    await assert.rejects(checkRootCss({ root, isVercel: false }), /subtree indent step/)
  })
}

test('shared consumer check rejects a missing subtree base rule', () => {
  assert.throws(() => checkSubtreeCss(`@container field (width>=24rem){${stepCss}}`), /subtree base/)
})
