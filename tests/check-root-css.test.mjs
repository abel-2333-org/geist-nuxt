import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { checkRootCss, requiredMarkers, resolvePublicRoot } from '../scripts/check-root-css.mjs'

async function buildFixture(relativePublicRoot) {
  const root = await mkdtemp(path.join(tmpdir(), 'geist-root-css-'))
  const publicRoot = path.join(root, relativePublicRoot)
  await mkdir(publicRoot, { recursive: true })
  await writeFile(path.join(publicRoot, 'entry.css'), requiredMarkers.map(({ marker }) => marker).join('\n'))
  return { root, publicRoot }
}

test('checks the default Nitro public output', async () => {
  const { root, publicRoot } = await buildFixture('.output/public')
  assert.equal(await resolvePublicRoot({ root, isVercel: false }), publicRoot)
  assert.deepEqual(await checkRootCss({ root, isVercel: false }), {
    publicRoot,
    markerCount: requiredMarkers.length,
  })
})

test('checks the Vercel Nitro static output', async () => {
  const { root, publicRoot } = await buildFixture('.vercel/output/static')
  assert.equal(await resolvePublicRoot({ root, isVercel: true }), publicRoot)
  assert.deepEqual(await checkRootCss({ root, isVercel: true }), {
    publicRoot,
    markerCount: requiredMarkers.length,
  })
})

test('fails when Nitro produced no public output', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'geist-root-css-missing-'))
  await assert.rejects(
    resolvePublicRoot({ root, isVercel: true }),
    /No Nitro public output directory found/,
  )
})
