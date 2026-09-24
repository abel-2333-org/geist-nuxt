#!/usr/bin/env node
import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import postcss from 'postcss'

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

/** Shared base marker and responsive check for gallery and consumer builds. */
export const subtreeCssMarkers = [
  '.subtree{border-inline-start-style:solid;border-inline-start-width:1px;border-inline-start-color:var(--ui-border);padding-inline-start:calc(var(--spacing)*3)}',
]

export function checkSubtreeCss(builtCss) {
  if (!subtreeCssMarkers.every(marker => builtCss.includes(marker))) {
    throw new Error('Built CSS is missing the subtree base line and indent')
  }

  let hasContainerStep = false
  postcss.parse(builtCss).walkAtRules('container', (query) => {
    // Match the complete positive condition, in either compiler output syntax.
    // A suffix match would also accept @media, max-width or another container.
    if (!/^field\s*\(\s*(?:min-width\s*:\s*24rem|width\s*>=\s*24rem|24rem\s*<=\s*width)\s*\)$/.test(query.params)) return
    // A media/supports/second container wrapper would restrict this contract.
    for (let parent = query.parent; parent?.type !== 'root'; parent = parent.parent) {
      if (parent.type !== 'atrule' || parent.name !== 'layer') return
    }
    for (const rule of query.nodes ?? []) {
      if (rule.type !== 'rule' || !rule.selectors.includes('.subtree')) continue
      const indent = rule.nodes.filter(node => node.type === 'decl' && node.prop === 'padding-inline-start').at(-1)
      if (indent?.value.replace(/\s+/g, '') === 'calc(var(--spacing)*4)') hasContainerStep = true
    }
  })

  if (!hasContainerStep) {
    throw new Error('Built CSS is missing the subtree indent step in @container field (width >= 24rem)')
  }
}

export const requiredMarkers = [
  { marker: '--breakpoint-sm:401px', source: 'foundation/assets/css/main.css' },
  { marker: '.text-code{font-size:var(--text-code);line-height:var(--tw-leading,var(--text-code--line-height))}', source: 'foundation/assets/css/main.css' },
  ...subtreeCssMarkers.map(marker => ({ marker, source: 'foundation/assets/css/main.css' })),
  { marker: '--ui-container:100%', source: 'foundation/assets/css/main.css' },
  { marker: 'max-w-28', source: 'kits/api-docs/internal/SidebarScenarioTags.vue' },
  { marker: 'touch-manipulation', source: 'kits/api-docs/internal/SidebarScenarioTags.vue' },
  { marker: '--api-docs-nav-w', source: 'kits/api-docs/components/SidebarNav.vue' },
  { marker: 'max-sm\\:px-1\\.5', source: 'kits/api-docs/components/SiteSearch.vue' },
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

  checkSubtreeCss(builtCss)

  return { publicRoot, markerCount: requiredMarkers.length + 1 }
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
