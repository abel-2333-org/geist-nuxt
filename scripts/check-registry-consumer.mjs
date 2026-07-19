#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { cp, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ElementTypes, parse as parseTemplate } from '@vue/compiler-dom'
import { parse as parseSfc } from '@vue/compiler-sfc'
import {
  checkConsumer,
  loadRegistry,
  parseArgs,
  printRegistryError,
  resolveSourceSha,
  sha256,
  validateRegistry,
} from './lib/registry.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fixtureRoot = path.join(repoRoot, 'tests/fixtures/consumer')
const BUILT_IN_COMPONENTS = new Set([
  'ClientOnly',
  'Component',
  'KeepAlive',
  'NuxtLayout',
  'NuxtLink',
  'NuxtPage',
  'Suspense',
  'Teleport',
  'Transition',
  'TransitionGroup',
])

function run(command, args, cwd, env = process.env) {
  console.log(`> ${command} ${args.join(' ')}`)
  execFileSync(command, args, { cwd, stdio: 'inherit', env })
}

async function protectedHashes(consumerRoot) {
  const protectedFiles = [
    'nuxt.config.ts',
    'app/app.config.ts',
    'app/app.vue',
  ]
  return Object.fromEntries(await Promise.all(protectedFiles.map(async (file) => {
    const content = await readFile(path.join(consumerRoot, file))
    return [file, sha256(content)]
  })))
}

async function readTreeText(directory, extension = '.mjs') {
  const chunks = []
  const visit = async (current) => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name)
      if (entry.isDirectory()) await visit(target)
      else if (entry.isFile() && entry.name.endsWith(extension)) chunks.push(await readFile(target, 'utf8'))
    }
  }
  await visit(directory)
  return chunks.join('\n')
}

function templateComponentTags(source, filename) {
  const { descriptor, errors } = parseSfc(source, { filename })
  if (errors.length > 0) throw new Error(`${filename}: failed to parse Vue SFC template`)
  if (!descriptor.template) return []
  const tags = new Set()
  const visit = (node) => {
    if (node.type === 1 && node.tagType === ElementTypes.COMPONENT) tags.add(node.tag)
    for (const child of node.children ?? []) visit(child)
    for (const branch of node.branches ?? []) visit(branch)
  }
  visit(parseTemplate(descriptor.template.content, { comments: false }))
  return [...tags]
}

function pascalizeComponent(tag) {
  return tag
    .split(/[-_]/)
    .filter(Boolean)
    .map(segment => `${segment[0]?.toUpperCase() ?? ''}${segment.slice(1)}`)
    .join('')
}

async function assertResolvedComponents(consumerRoot, lock) {
  const declarations = await readFile(path.join(consumerRoot, '.nuxt/components.d.ts'), 'utf8')
  const declared = new Set([...declarations.matchAll(/^export const ([A-Za-z_$][\w$]*):/gm)].map(match => match[1]))
  const unresolved = []
  for (const record of Object.values(lock.files)) {
    if (!record.target.endsWith('.vue')) continue
    const source = await readFile(path.join(consumerRoot, record.target), 'utf8')
    for (const tag of templateComponentTags(source, record.target)) {
      const name = pascalizeComponent(tag)
      if (!name || BUILT_IN_COMPONENTS.has(name) || declared.has(name)) continue
      unresolved.push(`${record.target} -> <${tag}>`)
    }
  }
  if (unresolved.length > 0) {
    throw new Error(`consumer dependency closure has unresolved component auto-imports:\n- ${unresolved.join('\n- ')}`)
  }
}

function packageJson(registry) {
  return {
    name: 'geist-registry-consumer-smoke',
    private: true,
    type: 'module',
    scripts: {
      postinstall: 'nuxt prepare',
      typecheck: 'nuxt typecheck',
      build: 'nuxt build',
    },
    dependencies: registry.externalRequirements.packages,
    devDependencies: {
      typescript: '~5.9.0',
      'vue-tsc': '^3.3.6',
    },
  }
}

const runtimeScenarios = [
  { label: 'all-items', all: true, build: true, cssMarker: 'scroll-mt-24' },
  {
    label: 'foundation-split-pane',
    item: 'foundation-split-pane',
    build: true,
    cssMarker: 'cursor-col-resize',
    page: `<template>\n  <SplitPane><template #start>Start</template><template #end>End</template></SplitPane>\n</template>\n`,
  },
  {
    label: 'api-docs-field-item',
    item: 'api-docs-field-item',
    build: true,
    cssMarker: 'scroll-mt-24',
    page: `<template>\n  <ApiDocsFieldItem name="amount" type="string" />\n</template>\n`,
  },
  {
    label: 'api-docs-sidebar-nav',
    item: 'api-docs-sidebar-nav',
    build: true,
    cssMarker: 'h-full{height:100%}',
    page: `<script setup lang="ts">\nconst sections = [{ label: 'Resources', kind: 'endpoints' as const, items: [{ label: 'Create resource', method: 'POST', scenarios: ['Batch'] }] }]\n</script>\n<template>\n  <ApiDocsSidebarNav :sections="sections" :resizable="false" />\n</template>\n`,
  },
  {
    label: 'api-docs-site-search',
    item: 'api-docs-site-search',
    build: true,
    cssMarker: 'max-sm\\:hidden',
    page: `<script setup lang="ts">\nconst groups = [{ id: 'guides', label: 'Guides', items: [{ label: 'Quickstart', to: '#quickstart', icon: 'i-lucide-rocket' }] }]\n</script>\n<template>\n  <ApiDocsSiteSearch :groups="groups" trigger-label="Search docs" modal-title="Search documentation" placeholder="Search documentation" empty-label="No matching pages" />\n</template>\n`,
  },
]

function componentName(item) {
  const componentFile = item.files.find(file => file.target.startsWith('app/components/') && file.target.endsWith('.vue'))
  if (!componentFile) throw new Error(`rendering item has no Vue component target: ${item.name}`)
  return componentFile.target
    .slice('app/components/'.length, -'.vue'.length)
    .split('/')
    .map(segment => segment.replace(/(^|[-_])(\w)/g, (_, __, letter) => letter.toUpperCase()))
    .join('')
}

function isolatedPage(item) {
  const name = componentName(item)
  return `<script setup lang="ts">\nconst props = {} as any\n</script>\n<template>\n  <${name} v-bind="props" />\n</template>\n`
}

function closureScenarios(registry, selectedLabel) {
  const isolatedRenderingItems = registry.items
    .filter(item => ['registry:component', 'registry:block'].includes(item.type))
    .map(item => ({
      label: `isolated-${item.name}`,
      item: item.name,
      page: isolatedPage(item),
    }))
  const scenarios = [...runtimeScenarios, ...isolatedRenderingItems]
  if (!selectedLabel) return scenarios
  const selected = scenarios.find(scenario => scenario.label === selectedLabel)
  if (!selected) throw new Error(`unknown consumer smoke scenario: ${selectedLabel}`)
  return [selected]
}

try {
  const options = parseArgs(process.argv.slice(2))
  const registryPath = path.resolve(options.registry ?? path.join(repoRoot, 'registry.json'))
  const registry = await loadRegistry(registryPath)
  await validateRegistry(registry, { repoRoot, checkFiles: true })

  if (options.target || options.consumer) {
    const consumerRoot = path.resolve(options.target ?? options.consumer)
    const lock = await checkConsumer({ registry, repoRoot, consumerRoot })
    console.log(`Consumer lock valid: ${Object.keys(lock.items).length} items, ${Object.keys(lock.files).length} files`)
  }
  else {
    const sourceSha = resolveSourceSha(repoRoot, options.sha ?? options.to, { allowDirty: true })
    const kept = []
    const dependencyRoot = options.skip_install
      ? undefined
      : await mkdtemp(path.join(tmpdir(), 'geist-consumer-dependencies-'))
    const dependencyNodeModules = dependencyRoot
      ? path.join(dependencyRoot, 'node_modules')
      : path.join(repoRoot, 'node_modules')
    try {
      if (dependencyRoot) {
        await writeFile(path.join(dependencyRoot, 'package.json'), `${JSON.stringify(packageJson(registry), null, 2)}\n`)
        run('pnpm', ['install', '--ignore-workspace', '--ignore-scripts'], dependencyRoot)
      }

      for (const scenario of closureScenarios(registry, options.scenario)) {
        const consumerRoot = await mkdtemp(path.join(tmpdir(), `geist-consumer-${scenario.label}-`))
        try {
          await cp(fixtureRoot, consumerRoot, { recursive: true })
          if (scenario.page) await writeFile(path.join(consumerRoot, 'app/pages/index.vue'), scenario.page)
          const before = await protectedHashes(consumerRoot)
          await writeFile(path.join(consumerRoot, 'package.json'), `${JSON.stringify(packageJson(registry), null, 2)}\n`)
          await symlink(dependencyNodeModules, path.join(consumerRoot, 'node_modules'), 'dir')

          const copyArgs = [path.join(repoRoot, 'scripts/copy-registry.mjs')]
          if (scenario.all) copyArgs.push('--all')
          else copyArgs.push(scenario.item)
          copyArgs.push('--target', consumerRoot, '--sha', sourceSha, '--write')
          run(process.execPath, copyArgs, repoRoot, {
            ...process.env,
            GEIST_REGISTRY_TEST_ALLOW_DIRTY: '1',
          })

          const after = await protectedHashes(consumerRoot)
          if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error(`${scenario.label}: copy-in modified a protected consumer file`)
          const lock = await checkConsumer({ registry, repoRoot, consumerRoot })
          if (!scenario.all && JSON.stringify(lock.requestedItems) !== JSON.stringify([scenario.item])) {
            throw new Error(`${scenario.label}: lock did not preserve the requested leaf item`)
          }

          run('pnpm', ['exec', 'nuxt', 'prepare'], consumerRoot)
          const generatedAppConfig = await readFile(path.join(consumerRoot, '.nuxt/app.config.mjs'), 'utf8')
          if (!generatedAppConfig.includes('/app/app.config.ts')) {
            throw new Error(`${scenario.label}: Nuxt did not discover consumer app/app.config.ts`)
          }
          await assertResolvedComponents(consumerRoot, lock)
          run('pnpm', ['run', 'typecheck'], consumerRoot)
          if (scenario.build) {
            run('pnpm', ['run', 'build'], consumerRoot)
            const builtRuntime = await readTreeText(path.join(consumerRoot, '.output/server/chunks'))
            if (!/primary\s*:\s*["']violet["']/.test(builtRuntime) || !/neutral\s*:\s*["']neutral["']/.test(builtRuntime)) {
              throw new Error(`${scenario.label}: built Nuxt app config did not contain Geist primary/neutral colors`)
            }
            if (scenario.all && !builtRuntime.includes('data-highlight-token')) {
              throw new Error(`${scenario.label}: built runtime did not preserve the trusted highlightedHtml branch`)
            }
            const builtCss = await readTreeText(path.join(consumerRoot, '.output/public'), '.css')
            if (!builtCss.includes('--breakpoint-sm:401px')) {
              throw new Error(`${scenario.label}: built output did not compile the Geist @theme tokens from main.css`)
            }
            if (scenario.cssMarker && !builtCss.includes(scenario.cssMarker)) {
              throw new Error(`${scenario.label}: built output did not contain copied-source CSS marker ${scenario.cssMarker}`)
            }
          }
          console.log(`Consumer closure smoke passed (${scenario.label}): ${consumerRoot}`)
        }
        finally {
          if (options.keep_temp) kept.push(consumerRoot)
          else await rm(consumerRoot, { recursive: true, force: true })
        }
      }
    }
    finally {
      if (dependencyRoot && !options.keep_temp) await rm(dependencyRoot, { recursive: true, force: true })
    }
    if (dependencyRoot && options.keep_temp) console.log(`Kept shared dependency fixture: ${dependencyRoot}`)
    for (const consumerRoot of kept) console.log(`Kept consumer fixture: ${consumerRoot}`)
  }
}
catch (error) {
  printRegistryError(error)
  process.exitCode = 1
}
