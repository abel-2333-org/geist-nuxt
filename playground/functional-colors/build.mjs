import { buildNuxt, loadNuxt } from '@nuxt/kit'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { contrastSource } from '../../scripts/lib/contrast-build.mjs'
const root = fileURLToPath(new URL('../..', import.meta.url))
const output = path.join(root, '.output/functional-colors')
const source = await contrastSource(root)
const nuxt = await loadNuxt({ cwd: root, dev: false, overrides: {
  buildDir: path.join(root, '.nuxt/functional-colors'),
  nitro: { output: { dir: output } },
  hooks: { 'pages:extend'(pages) {
    pages.push({ name: 'functional-colors-stage1', path: '/__functional-colors', file: path.join(root, 'playground/functional-colors/Matrix.vue') })
  } },
} })
nuxt.options.plugins.push({ src: path.join(root, 'playground/functional-colors/preview-plugin.ts') })
nuxt.options.css = [path.join(root, 'playground/functional-colors/main.css')]
try {
  await buildNuxt(nuxt)
  const after = await contrastSource(root)
  if (after.digest !== source.digest || after.sha !== source.sha) throw new Error('Source changed during build')
  await mkdir(output, { recursive: true })
  await writeFile(path.join(output, 'source.json'), JSON.stringify({ ...source, builtAt: new Date().toISOString(), purpose: 'Issue 147 stage 1 only; production sources unchanged' }, null, 2))
} finally { await nuxt.close() }
