#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
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

function run(command, args, cwd, env = process.env) {
  console.log(`> ${command} ${args.join(' ')}`)
  execFileSync(command, args, { cwd, stdio: 'inherit', env })
}

async function protectedHashes(consumerRoot) {
  const protectedFiles = [
    'nuxt.config.ts',
    'app/app.config.ts',
    'app/app.vue',
    'app/assets/css/main.css',
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

const closureScenarios = [
  { label: 'all-items', all: true, cssMarker: 'scroll-mt-24' },
  {
    label: 'foundation-split-pane',
    item: 'foundation-split-pane',
    cssMarker: 'cursor-col-resize',
    page: `<template>\n  <SplitPane><template #start>Start</template><template #end>End</template></SplitPane>\n</template>\n`,
  },
  {
    label: 'api-docs-field-item',
    item: 'api-docs-field-item',
    cssMarker: 'scroll-mt-24',
    page: `<template>\n  <ApiDocsFieldItem name="amount" type="string" />\n</template>\n`,
  },
  {
    label: 'api-docs-sidebar-nav',
    item: 'api-docs-sidebar-nav',
    cssMarker: '100dvh-4rem',
    page: `<script setup lang="ts">\nconst sections = [{ label: 'Resources', kind: 'endpoints' as const, items: [{ label: 'Create resource', method: 'POST', scenarios: ['Batch'] }] }]\n</script>\n<template>\n  <ApiDocsSidebarNav :sections="sections" :resizable="false" />\n</template>\n`,
  },
]

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
    for (const [index, scenario] of closureScenarios.entries()) {
      const consumerRoot = await mkdtemp(path.join(tmpdir(), `geist-consumer-${scenario.label}-`))
      try {
        await cp(fixtureRoot, consumerRoot, { recursive: true })
        if (scenario.page) await writeFile(path.join(consumerRoot, 'app/pages/index.vue'), scenario.page)
        const before = await protectedHashes(consumerRoot)
        await writeFile(path.join(consumerRoot, 'package.json'), `${JSON.stringify(packageJson(registry), null, 2)}\n`)

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

        const installArgs = ['install', '--ignore-workspace']
        if (index > 0) installArgs.push('--offline')
        run('pnpm', installArgs, consumerRoot)
        const generatedAppConfig = await readFile(path.join(consumerRoot, '.nuxt/app.config.mjs'), 'utf8')
        if (!generatedAppConfig.includes('/app/app.config.ts')) {
          throw new Error(`${scenario.label}: Nuxt did not discover consumer app/app.config.ts`)
        }
        run('pnpm', ['run', 'typecheck'], consumerRoot)
        run('pnpm', ['run', 'build'], consumerRoot)
        const builtRuntime = await readTreeText(path.join(consumerRoot, '.output/server/chunks/build'))
        if (!/primary\s*:\s*["']violet["']/.test(builtRuntime) || !/neutral\s*:\s*["']neutral["']/.test(builtRuntime)) {
          throw new Error(`${scenario.label}: built Nuxt app config did not contain Geist primary/neutral colors`)
        }
        if (scenario.all && !builtRuntime.includes('data-highlight-token')) {
          throw new Error(`${scenario.label}: built runtime did not preserve the trusted highlightedHtml branch`)
        }
        const builtCss = await readTreeText(path.join(consumerRoot, '.output/public'), '.css')
        if (!builtCss.includes('.flex{display:flex}')) {
          throw new Error(`${scenario.label}: built output did not contain Tailwind utility CSS; check main.css imports`)
        }
        if (!builtCss.includes(scenario.cssMarker)) {
          throw new Error(`${scenario.label}: built output did not contain copied-source CSS marker ${scenario.cssMarker}`)
        }
        console.log(`Consumer closure smoke passed (${scenario.label}): ${consumerRoot}`)
      }
      finally {
        if (options.keep_temp) kept.push(consumerRoot)
        else await rm(consumerRoot, { recursive: true, force: true })
      }
    }
    for (const consumerRoot of kept) console.log(`Kept consumer fixture: ${consumerRoot}`)
  }
}
catch (error) {
  printRegistryError(error)
  process.exitCode = 1
}
