#!/usr/bin/env node
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const publicRoot = path.join(repoRoot, '.output/public')

async function readCssTree(directory) {
  const chunks = []

  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name)
      if (entry.isDirectory()) await visit(target)
      else if (entry.isFile() && entry.name.endsWith('.css')) chunks.push(await readFile(target, 'utf8'))
    }
  }

  await visit(directory)
  return chunks.join('\n')
}

const requiredMarkers = [
  { marker: '--breakpoint-sm:401px', source: 'foundation/assets/css/main.css' },
  { marker: '.text-code{', source: 'foundation/assets/css/main.css' },
  { marker: '--ui-container:100%', source: 'foundation/assets/css/main.css' },
  { marker: 'max-w-28', source: 'kits/api-docs/components/ScenarioTags.vue' },
  { marker: 'touch-manipulation', source: 'kits/api-docs/components/ScenarioTags.vue' },
  { marker: '100dvh-4rem', source: 'kits/api-docs/components/SidebarNav.vue' },
  { marker: 'scroll-mt-24', source: 'kits/api-docs/composables/useFieldAnchor.ts' },
]

try {
  const builtCss = await readCssTree(publicRoot)
  const missing = requiredMarkers.filter(({ marker }) => !builtCss.includes(marker))

  if (missing.length > 0) {
    const details = missing.map(({ marker, source }) => `${marker} (${source})`).join(', ')
    throw new Error(`Root gallery CSS is missing source-owned markers: ${details}`)
  }

  console.log(`Root gallery CSS source check passed: ${requiredMarkers.length} markers`)
}
catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
