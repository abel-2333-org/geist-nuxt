#!/usr/bin/env node
import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptPath = fileURLToPath(import.meta.url)
const repoRoot = path.resolve(path.dirname(scriptPath), '..')

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

export const requiredMarkers = [
  { marker: '--breakpoint-sm:401px', source: 'foundation/assets/css/main.css' },
  { marker: '.text-code{', source: 'foundation/assets/css/main.css' },
  { marker: '--ui-container:100%', source: 'foundation/assets/css/main.css' },
  { marker: 'max-w-28', source: 'kits/api-docs/components/ScenarioTags.vue' },
  { marker: 'touch-manipulation', source: 'kits/api-docs/components/ScenarioTags.vue' },
  { marker: 'h-full{height:100%}', source: 'kits/api-docs/components/SidebarNav.vue' },
  { marker: 'max-sm\\:hidden', source: 'kits/api-docs/components/SiteSearch.vue' },
  { marker: 'scroll-mt-24', source: 'kits/api-docs/composables/useFieldAnchor.ts' },
]

export async function resolvePublicRoot({ root = repoRoot, isVercel = Boolean(process.env.VERCEL) } = {}) {
  const localRoot = path.join(root, '.output/public')
  const vercelRoot = path.join(root, '.vercel/output/static')
  const candidates = isVercel ? [vercelRoot, localRoot] : [localRoot, vercelRoot]

  for (const candidate of candidates) {
    try {
      if ((await stat(candidate)).isDirectory()) return candidate
    }
    catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
  }

  throw new Error(`No Nitro public output directory found. Checked: ${candidates.join(', ')}`)
}

export async function checkRootCss(options) {
  const publicRoot = await resolvePublicRoot(options)
  const builtCss = await readCssTree(publicRoot)
  const missing = requiredMarkers.filter(({ marker }) => !builtCss.includes(marker))

  if (missing.length > 0) {
    const details = missing.map(({ marker, source }) => `${marker} (${source})`).join(', ')
    throw new Error(`Root gallery CSS is missing source-owned markers: ${details}`)
  }

  return { publicRoot, markerCount: requiredMarkers.length }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  try {
    const result = await checkRootCss()
    console.log(`Root gallery CSS source check passed: ${result.markerCount} markers (${result.publicRoot})`)
  }
  catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
