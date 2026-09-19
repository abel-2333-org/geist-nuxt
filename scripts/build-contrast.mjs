import { buildNuxt, loadNuxt } from '@nuxt/kit'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { contrastSource } from './lib/contrast-build.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const output = path.join(root, '.output/contrast')
const source = await contrastSource(root)
await rm(output, { recursive: true, force: true })
const nuxt = await loadNuxt({
  cwd: root,
  dev: false,
  overrides: {
    buildDir: path.join(root, '.nuxt/contrast'),
    nitro: { output: { dir: output } },
    hooks: {
      'pages:extend'(pages) {
        pages.push({ name: 'contrast-verification', path: '/__contrast', file: path.join(root, 'tests/fixtures/contrast/index.vue') })
      },
    },
  },
})
// The same production CSS/config/components, with a test-only scan entry and
// route. Neither the normal gallery build nor registry contains this route.
nuxt.options.css = [path.join(root, 'tests/fixtures/contrast/main.css')]
try {
  await buildNuxt(nuxt)
  const after = await contrastSource(root)
  if (after.digest !== source.digest || after.sha !== source.sha) throw new Error('Contrast source changed during build; rebuild before testing')
  await mkdir(output, { recursive: true })
  await writeFile(path.join(output, 'source.json'), JSON.stringify({ ...source, builtAt: new Date().toISOString() }, null, 2))
}
finally {
  await nuxt.close()
}
