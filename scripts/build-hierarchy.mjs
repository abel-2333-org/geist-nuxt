import { buildNuxt, loadNuxt } from '@nuxt/kit'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { contrastSource } from './lib/contrast-build.mjs'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

async function hierarchySource(root) {
  const base = await contrastSource(root)
  const hash = createHash('sha256').update(base.digest)
  for (const file of ['tests/fixtures/hierarchy/index.vue', 'tests/fixtures/hierarchy/main.css', 'scripts/build-hierarchy.mjs']) {
    hash.update(file).update(await readFile(path.join(root, file)))
  }
  return { ...base, digest: hash.digest('hex') }
}

const root = fileURLToPath(new URL('..', import.meta.url))
const output = path.join(root, '.output/hierarchy')
const source = await hierarchySource(root)
await rm(output, { recursive: true, force: true })
const nuxt = await loadNuxt({
  cwd: root,
  dev: false,
  overrides: {
    buildDir: path.join(root, '.nuxt/hierarchy'),
    nitro: { output: { dir: output } },
    hooks: {
      'pages:extend'(pages) {
        pages.push({ name: 'hierarchy-verification', path: '/__hierarchy', file: path.join(root, 'tests/fixtures/hierarchy/index.vue') })
      },
    },
  },
})
// The same production CSS/config/components, with a test-only scan entry and
// route. Neither the normal gallery build nor registry contains this route.
nuxt.options.css = [path.join(root, 'tests/fixtures/hierarchy/main.css')]
try {
  await buildNuxt(nuxt)
  const after = await hierarchySource(root)
  if (after.digest !== source.digest || after.sha !== source.sha) throw new Error('Hierarchy source changed during build; rebuild before testing')
  await mkdir(output, { recursive: true })
  await writeFile(path.join(output, 'source.json'), JSON.stringify({ ...source, builtAt: new Date().toISOString() }, null, 2))
}
finally {
  await nuxt.close()
}
