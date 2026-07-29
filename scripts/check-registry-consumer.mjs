#!/usr/bin/env node
import { execFileSync, spawn } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ElementTypes, parse as parseTemplate } from '@vue/compiler-dom'
import { parse as parseSfc } from '@vue/compiler-sfc'
import {
  applyCopyPlan,
  assertExactSha,
  checkConsumer,
  loadRegistry,
  parseArgs,
  planCopy,
  printRegistryError,
  readLock,
  resolveCopyRequest,
  resolveItems,
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

function capture(command, args, cwd, env = process.env) {
  console.log(`> ${command} ${args.join(' ')}`)
  const output = execFileSync(command, args, { cwd, encoding: 'utf8', env })
  process.stdout.write(output)
  return output
}

async function openPort() {
  const server = createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('failed to allocate consumer runtime port')
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  return address.port
}

async function renderBuiltPage(consumerRoot) {
  const port = await openPort()
  const url = `http://127.0.0.1:${port}/`
  const child = spawn(process.execPath, ['.output/server/index.mjs'], {
    cwd: consumerRoot,
    env: {
      ...process.env,
      NITRO_HOST: '127.0.0.1',
      NITRO_PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const logs = []
  const record = chunk => logs.push(chunk.toString())
  child.stdout.on('data', record)
  child.stderr.on('data', record)

  try {
    // Readiness is probed by polling the port, not by scraping Nitro's startup
    // banner — the log text is an implementation detail that has changed across
    // Nitro versions and would make this silently time out. We still fail fast
    // if the child errors or exits before it can serve.
    const deadline = Date.now() + 10_000
    let exited = null
    child.once('error', error => { exited = { error } })
    child.once('exit', code => { exited ??= { code } })

    let response
    while (true) {
      if (exited) {
        if (exited.error) throw exited.error
        throw new Error(`consumer runtime exited before listening (status ${exited.code})\n${logs.join('')}`)
      }
      if (Date.now() > deadline) {
        throw new Error(`consumer runtime did not start at ${url}\n${logs.join('')}`)
      }
      try {
        response = await fetch(url, { signal: AbortSignal.timeout(1_000) })
        break
      }
      catch {
        // Connection refused / aborted while the server is still booting.
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    const html = await response.text()
    if (!response.ok) {
      throw new Error(`consumer runtime returned HTTP ${response.status}\n${html}\n${logs.join('')}`)
    }
    return { html, output: logs.join('') }
  }
  finally {
    if (child.exitCode === null) {
      child.kill('SIGTERM')
      await Promise.race([
        new Promise(resolve => child.once('exit', resolve)),
        new Promise(resolve => setTimeout(resolve, 2_000)),
      ])
      if (child.exitCode === null) child.kill('SIGKILL')
    }
  }
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

async function fileHashes(root, targets) {
  return Object.fromEntries(await Promise.all(targets.map(async (target) => {
    try {
      return [target, sha256(await readFile(path.join(root, target)))]
    }
    catch (error) {
      if (error?.code === 'ENOENT') return [target, null]
      throw error
    }
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

function packageJson(externalRequirements) {
  return {
    name: 'geist-registry-consumer-smoke',
    private: true,
    type: 'module',
    scripts: {
      postinstall: 'nuxt prepare',
      typecheck: 'nuxt typecheck',
      build: 'nuxt build',
    },
    dependencies: externalRequirements.packages,
    devDependencies: {
      typescript: '~5.9.0',
      'vue-tsc': '^3.3.6',
    },
  }
}

function allResolution(registry) {
  return resolveItems(registry, registry.items.map(item => item.name))
}

function scenarioResolution(registry, scenario) {
  return scenario.all
    ? allResolution(registry)
    : resolveItems(registry, [scenario.item])
}

function assertPackageRequirements(manifest, lock, label) {
  if (JSON.stringify(manifest.dependencies) !== JSON.stringify(lock.registry.externalRequirements.packages)) {
    throw new Error(`${label}: package.json dependencies differ from resolved lock requirements`)
  }
}

const configMigration = [
  {
    currentSource: 'foundation/config/nuxt.ts',
    currentTarget: 'app/config/foundation/nuxt.ts',
    legacySource: 'foundation/config/geist-nuxt.ts',
    legacyTarget: 'app/config/geist-nuxt.ts',
    legacyExport: 'geistNuxtConfig',
  },
  {
    currentSource: 'foundation/config/app.ts',
    currentTarget: 'app/config/foundation/app.ts',
    legacySource: 'foundation/config/geist-app.ts',
    legacyTarget: 'app/config/geist-app.ts',
    legacyExport: 'geistAppConfig',
  },
]

async function checkLegacyConfigMigration({
  registry,
  sourceSha,
  dependencyNodeModules,
  keepTemp = false,
}) {
  const consumerRoot = await mkdtemp(path.join(tmpdir(), 'geist-consumer-legacy-config-'))
  const legacyRoot = await mkdtemp(path.join(tmpdir(), 'geist-registry-legacy-config-'))
  try {
    await cp(fixtureRoot, consumerRoot, { recursive: true })
    await writeFile(
      path.join(consumerRoot, 'app/pages/index.vue'),
      '<template>\n  <main>Legacy config migration</main>\n</template>\n',
    )
    const currentEntrypoints = {
      nuxt: await readFile(path.join(consumerRoot, 'nuxt.config.ts'), 'utf8'),
      app: await readFile(path.join(consumerRoot, 'app/app.config.ts'), 'utf8'),
    }
    await writeFile(
      path.join(consumerRoot, 'nuxt.config.ts'),
      currentEntrypoints.nuxt
        .replace("import base from './app/config/foundation/nuxt'", "import { geistNuxtConfig } from './app/config/geist-nuxt'")
        .replaceAll('base.', 'geistNuxtConfig.'),
    )
    await writeFile(
      path.join(consumerRoot, 'app/app.config.ts'),
      currentEntrypoints.app
        .replace("import base from './config/foundation/app'", "import { geistAppConfig } from './config/geist-app'")
        .replace('defineAppConfig(base)', 'defineAppConfig(geistAppConfig)'),
    )
    const foundationResolution = resolveItems(registry, ['geist-foundation'])
    const foundationManifest = packageJson(foundationResolution.externalRequirements)
    await writeFile(
      path.join(consumerRoot, 'package.json'),
      `${JSON.stringify(foundationManifest, null, 2)}\n`,
    )
    await symlink(dependencyNodeModules, path.join(consumerRoot, 'node_modules'), 'dir')

    const legacyRegistry = structuredClone(registry)
    const foundation = legacyRegistry.items.find(item => item.name === 'geist-foundation')
    if (!foundation) throw new Error('legacy config migration: geist-foundation item is missing')
    foundation.files = foundation.files.map((file) => {
      const migration = configMigration.find(candidate => candidate.currentTarget === file.target)
      return migration
        ? { path: migration.legacySource, target: migration.legacyTarget }
        : file
    })
    legacyRegistry.externalRequirements.consumerSetup = [
      legacyRegistry.externalRequirements.consumerSetup[0],
      'Merge app/config/geist-app.ts into the consumer app/app.config.ts.',
      'Merge app/config/geist-nuxt.ts into the consumer nuxt.config.ts.',
      'Use the copied app/assets/css/main.css as the Tailwind, Nuxt UI, and Geist foundation entry.',
      ...legacyRegistry.externalRequirements.consumerSetup.slice(4),
    ]

    for (const file of foundation.files) {
      await mkdir(path.join(legacyRoot, path.dirname(file.path)), { recursive: true })
      const migration = configMigration.find(candidate => candidate.legacySource === file.path)
      const source = migration
        ? (await readFile(path.join(repoRoot, migration.currentSource), 'utf8'))
            .replace('export default', `export const ${migration.legacyExport} =`)
        : await readFile(path.join(repoRoot, file.path))
      await writeFile(path.join(legacyRoot, file.path), source)
    }

    await applyCopyPlan(await planCopy({
      registry: legacyRegistry,
      resolution: resolveItems(legacyRegistry, ['geist-foundation']),
      repoRoot: legacyRoot,
      consumerRoot,
      sourceSha,
    }))
    const protectedBefore = await protectedHashes(consumerRoot)
    const lock = await readLock(consumerRoot)
    const resolution = resolveCopyRequest(registry, [], { lock, update: true })
    const plan = await planCopy({
      registry,
      resolution,
      repoRoot,
      consumerRoot,
      sourceSha,
      update: true,
    })
    const actions = Object.fromEntries(plan.operations.map(operation => [operation.target, operation.action]))
    for (const migration of configMigration) {
      if (actions[migration.currentTarget] !== 'create' || actions[migration.legacyTarget] !== 'delete') {
        throw new Error(`legacy config migration: expected create/delete plan for ${migration.currentTarget}`)
      }
    }

    const copyArgs = [
      path.join(repoRoot, 'scripts/copy-registry.mjs'),
      '--update',
      '--target',
      consumerRoot,
      '--sha',
      sourceSha,
    ]
    const copyEnv = {
      ...process.env,
      GEIST_REGISTRY_TEST_ALLOW_DIRTY: '1',
    }
    const migrationTargets = configMigration.flatMap(migration => [
      migration.currentTarget,
      migration.legacyTarget,
    ])
    const dryRunBefore = {
      lock: sha256(await readFile(path.join(consumerRoot, 'geist.lock.json'))),
      files: await fileHashes(consumerRoot, migrationTargets),
    }
    const dryRunOutput = capture(process.execPath, copyArgs, repoRoot, copyEnv)
    for (const migration of configMigration) {
      if (
        !dryRunOutput.includes(`create    ${migration.currentTarget}`)
        || !dryRunOutput.includes(`delete    ${migration.legacyTarget}`)
      ) {
        throw new Error(`legacy config migration: CLI dry-run did not report create/delete for ${migration.currentTarget}`)
      }
    }
    const dryRunAfter = {
      lock: sha256(await readFile(path.join(consumerRoot, 'geist.lock.json'))),
      files: await fileHashes(consumerRoot, migrationTargets),
    }
    if (JSON.stringify(dryRunBefore) !== JSON.stringify(dryRunAfter)) {
      throw new Error('legacy config migration: CLI dry-run modified the consumer')
    }
    run(process.execPath, [...copyArgs, '--write'], repoRoot, copyEnv)
    const protectedAfter = await protectedHashes(consumerRoot)
    if (JSON.stringify(protectedBefore) !== JSON.stringify(protectedAfter)) {
      throw new Error('legacy config migration: update modified a protected consumer entrypoint')
    }
    const staleNuxt = await readFile(path.join(consumerRoot, 'nuxt.config.ts'), 'utf8')
    const staleApp = await readFile(path.join(consumerRoot, 'app/app.config.ts'), 'utf8')
    if (!staleNuxt.includes('config/geist-nuxt') || !staleApp.includes('config/geist-app')) {
      throw new Error('legacy config migration: protected entrypoints did not retain their old imports')
    }

    await writeFile(path.join(consumerRoot, 'nuxt.config.ts'), currentEntrypoints.nuxt)
    await writeFile(path.join(consumerRoot, 'app/app.config.ts'), currentEntrypoints.app)
    const currentLock = await checkConsumer({ registry, repoRoot, consumerRoot })
    assertPackageRequirements(foundationManifest, currentLock, 'legacy config migration')
    run('pnpm', ['exec', 'nuxt', 'prepare'], consumerRoot)
    run('pnpm', ['run', 'typecheck'], consumerRoot)
    run('pnpm', ['run', 'build'], consumerRoot)
    console.log(`Legacy config migration smoke passed: ${consumerRoot}`)
    return keepTemp ? consumerRoot : undefined
  }
  finally {
    await rm(legacyRoot, { recursive: true, force: true })
    if (!keepTemp) await rm(consumerRoot, { recursive: true, force: true })
  }
}

async function materializeSource(sourceSha) {
  const sourceRoot = await mkdtemp(path.join(tmpdir(), 'geist-upgrade-source-'))
  try {
    const archivePath = path.join(sourceRoot, 'source.tar')
    run('git', ['archive', '--format=tar', '--output', archivePath, sourceSha], repoRoot)
    run('tar', ['xf', archivePath, '-C', sourceRoot], repoRoot)
    await rm(archivePath)
    // The archived registry CLI belongs to this repository, so it must resolve
    // this repository's tooling dependencies rather than the consumer fixture's
    // intentionally minimal dependency tree.
    await symlink(path.join(repoRoot, 'node_modules'), path.join(sourceRoot, 'node_modules'), 'dir')
    await writeFile(path.join(sourceRoot, '.geist-source.json'), `${JSON.stringify({
      schemaVersion: 1,
      sourceSha,
    }, null, 2)}\n`)
    return sourceRoot
  }
  catch (error) {
    await rm(sourceRoot, { recursive: true, force: true })
    throw error
  }
}

async function runUpgradeSmoke({ baseSha, headSha, headRegistry, dependencyNodeModules }) {
  let sourceRoot
  let consumerRoot
  try {
    run('git', ['merge-base', '--is-ancestor', baseSha, headSha], repoRoot)
    sourceRoot = await materializeSource(baseSha)
    consumerRoot = await mkdtemp(path.join(tmpdir(), 'geist-consumer-upgrade-'))
    const baseRegistry = await loadRegistry(path.join(sourceRoot, 'registry.json'))
    await validateRegistry(baseRegistry, { repoRoot: sourceRoot, checkFiles: true })

    await cp(path.join(sourceRoot, 'tests/fixtures/consumer'), consumerRoot, { recursive: true })
    const headResolution = allResolution(headRegistry)
    const headManifest = packageJson(headResolution.externalRequirements)
    await writeFile(
      path.join(consumerRoot, 'package.json'),
      `${JSON.stringify(headManifest, null, 2)}\n`,
    )
    await symlink(dependencyNodeModules, path.join(consumerRoot, 'node_modules'), 'dir')
    const before = await protectedHashes(consumerRoot)

    run(process.execPath, [
      path.join(sourceRoot, 'scripts/copy-registry.mjs'),
      '--all',
      '--target',
      consumerRoot,
      '--to',
      baseSha,
      '--write',
    ], sourceRoot)
    const installed = await protectedHashes(consumerRoot)
    if (JSON.stringify(before) !== JSON.stringify(installed)) {
      throw new Error('base copy-in modified a protected consumer file')
    }
    await checkConsumer({ registry: baseRegistry, repoRoot: sourceRoot, consumerRoot })

    run(process.execPath, [
      path.join(repoRoot, 'scripts/copy-registry.mjs'),
      '--update',
      '--target',
      consumerRoot,
      '--to',
      headSha,
      '--write',
    ], repoRoot)
    const updated = await protectedHashes(consumerRoot)
    if (JSON.stringify(before) !== JSON.stringify(updated)) {
      throw new Error('HEAD update modified a protected consumer file')
    }
    const lock = await checkConsumer({ registry: headRegistry, repoRoot, consumerRoot })
    assertPackageRequirements(headManifest, lock, 'consumer upgrade')

    run('pnpm', ['exec', 'nuxt', 'prepare'], consumerRoot)
    await assertResolvedComponents(consumerRoot, lock)
    run('pnpm', ['run', 'typecheck'], consumerRoot)
    run('pnpm', ['run', 'build'], consumerRoot)
    console.log(`Consumer upgrade smoke passed: ${baseSha} -> ${headSha}`)
  }
  finally {
    if (consumerRoot) await rm(consumerRoot, { recursive: true, force: true })
    if (sourceRoot) await rm(sourceRoot, { recursive: true, force: true })
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
    label: 'foundation-annotation-popover',
    item: 'foundation-annotation-popover',
    build: true,
    cssMarker: 'decoration-dashed',
    page: `<template>\n  <p>Rate limits use a <AnnotationPopover label="Term">sliding window<template #content>A rolling time span for counting requests.</template></AnnotationPopover> algorithm.</p>\n</template>\n`,
  },
  {
    label: 'foundation-term-annotation',
    item: 'foundation-term-annotation',
    build: true,
    cssMarker: 'decoration-dashed',
    renderedMarkers: ['Sliding window'],
    page: `<script setup lang="ts">
provideGlossary({
  'sliding-window': {
    term: 'Sliding window',
    definition: 'A rolling time span for counting requests.',
  },
})
</script>
<template>
  <p>Rate limits use a <TermAnnotation id="sliding-window" /> algorithm.</p>
</template>
`,
  },
  {
    label: 'foundation-doc-annotation',
    item: 'foundation-doc-annotation',
    build: true,
    cssMarker: 'decoration-dashed',
    renderedMarkers: ['Rate limiting guide'],
    page: `<script setup lang="ts">
async function loadGuide() {
  return {
    title: 'Rate limiting guide',
    description: 'Recommended retry backoff.',
  }
}
</script>
<template>
  <DocAnnotation to="/guides/rate-limits" :load="loadGuide">
    Rate limiting guide
  </DocAnnotation>
</template>
`,
  },
  {
    label: 'api-docs-field-item',
    item: 'api-docs-field-item',
    build: true,
    cssMarker: 'scroll-mt-24',
    renderedMarkers: ['amount', 'string', 'Default constraint note.', 'Explicit caveat note.'],
    forbiddenRuntimeOutput: ['Failed to resolve component: ApiDocsSchemaComposition'],
    page: `<script setup lang="ts">
import type { FieldNote } from '~/utils/field'

const notes: FieldNote[] = [
  { text: 'Default constraint note.' },
  { kind: 'caveat', text: 'Explicit caveat note.' },
]

// @ts-expect-error \`tone\` was removed; \`kind\` is the only note category.
const legacyNote: FieldNote = { tone: 'caution', text: 'Legacy note shape.' }
void legacyNote
</script>
<template>
  <ApiDocsFieldItem name="amount" type="string" :notes="notes" />
</template>
`,
  },
  {
    label: 'api-docs-field-annotation',
    item: 'api-docs-field-annotation',
    build: true,
    cssMarker: 'decoration-dashed',
    renderedMarkers: ['amount'],
    page: `<script setup lang="ts">
provideFieldSource({
  amount: {
    field: {
      path: 'body_amount',
      name: 'amount',
      type: 'integer',
      required: true,
    },
  },
})
</script>
<template>
  <ApiDocsFieldAnnotation field-ref="amount" />
</template>
`,
  },
  {
    label: 'api-docs-sidebar-nav',
    item: 'api-docs-sidebar-nav',
    build: true,
    cssMarker: '--api-docs-nav-w',
    page: `<script setup lang="ts">\nconst sections = [{ label: 'Resources', kind: 'endpoints' as const, items: [{ label: 'Create resource', method: 'POST', scenarios: ['Batch'] }] }]\n</script>\n<template>\n  <ApiDocsSidebarNav :sections="sections" :resizable="false" />\n</template>\n`,
  },
  {
    label: 'api-docs-site-search',
    item: 'api-docs-site-search',
    build: true,
    cssMarker: 'max-sm\\:px-1\\.5',
    page: `<script setup lang="ts">\nconst groups = [{ id: 'guides', label: 'Guides', items: [{ label: 'Quickstart', to: '#quickstart', icon: 'i-lucide-rocket' }] }]\n</script>\n<template>\n  <ApiDocsSiteSearch :groups="groups" />\n</template>\n`,
  },
  {
    // Render SchemaComposition only through FieldItem's optional field-level
    // delegation. The page never references ApiDocsSchemaComposition directly,
    // so this covers dynamic resolution after registry copy-in.
    label: 'api-docs-schema-composition',
    item: 'api-docs-schema-composition',
    build: true,
    // ps-9 is the discriminator row's indent — unique to this component's
    // template, so its presence proves the SchemaComposition source was copied.
    cssMarker: 'ps-9',
    renderedMarkers: ['One of', 'Card', 'brand'],
    forbiddenRuntimeOutput: ['Failed to resolve component: ApiDocsSchemaComposition'],
    page: `<script setup lang="ts">
const field = {
  path: 'payment_method',
  name: 'payment_method',
  type: 'object',
  composition: {
    kind: 'oneOf' as const,
    discriminator: {
      propertyName: 'type',
      mapping: [
        { value: 'card', variantId: 'card' },
        { value: 'wallet', variantId: 'wallet' },
      ],
    },
    variants: [
      {
        id: 'card',
        label: 'Card',
        description: 'A tokenized payment card.',
        fields: [
          { path: 'payment_method_card_brand', name: 'brand', type: 'string', required: true },
          { path: 'payment_method_card_last4', name: 'last4', type: 'string', required: true },
        ],
      },
      {
        id: 'wallet',
        label: 'Wallet',
        description: 'A hosted wallet balance.',
        fields: [
          { path: 'payment_method_wallet_provider', name: 'provider', type: 'string', required: true },
        ],
      },
    ],
  },
}
</script>
<template>
  <ApiDocsFieldItem v-bind="field" />
</template>
`,
  },
  {
    label: 'api-docs-webhook-protocol',
    item: 'api-docs-webhook-protocol',
    build: true,
    cssMarker: 'sm\\:w-36',
    page: `<script setup lang="ts">
const verification = {
  label: 'VERIFICATION',
  description: 'Verify the signature before processing the event.',
  facts: [{ term: 'Header', value: 'X-Example-Signature', code: true }],
}
const acknowledgement = {
  label: 'ACKNOWLEDGEMENT',
  facts: [{ term: 'HTTP status', value: '200', code: true }],
  example: {
    code: '{\\n  "received": true\\n}',
    language: 'json',
    title: 'Acknowledgement body',
    labels: {
      language: 'Language',
      copy: 'Copy acknowledgement',
      copied: 'Acknowledgement copied',
      wrapOn: 'Wrap acknowledgement',
      wrapOff: 'Do not wrap acknowledgement',
      emptyTitle: 'No acknowledgement',
      emptyHint: 'No literal body is required.',
    },
  },
}
const delivery = {
  label: 'DELIVERY',
  facts: [
    { term: 'Attempts', value: 'Initial delivery plus 3 retries.' },
    { term: 'Timeout', value: '10 seconds.' },
  ],
  schedule: {
    term: 'Retry schedule',
    summary: 'Retry after 1 minute, 5 minutes, then 30 minutes.',
    steps: ['1 minute', '5 minutes', '30 minutes'],
    expandLabel: (hidden: number) => \`Show \${hidden} retry intervals\`,
    collapseLabel: 'Hide retry intervals',
  },
}
</script>
<template>
  <ApiDocsWebhookProtocol
    :verification="verification"
    :acknowledgement="acknowledgement"
    :delivery="delivery"
    :heading-level="3"
    :max-schedule-steps="1"
  />
</template>
`,
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

function closureScenarios(registry, { selectedLabel, group } = {}) {
  const isolatedRenderingItems = registry.items
    .filter(item => ['registry:component', 'registry:block'].includes(item.type))
    .map(item => ({
      label: `isolated-${item.name}`,
      item: item.name,
      page: isolatedPage(item),
    }))
  const groups = {
    runtime: runtimeScenarios,
    isolated: isolatedRenderingItems,
  }
  if (group && !Object.hasOwn(groups, group)) {
    throw new Error(`unknown consumer smoke group: ${group}`)
  }
  const allScenarios = [...runtimeScenarios, ...isolatedRenderingItems]
  const scenarios = group ? groups[group] : allScenarios
  if (!selectedLabel) return scenarios
  const selected = allScenarios.find(scenario => scenario.label === selectedLabel)
  if (!selected) throw new Error(`unknown consumer smoke scenario: ${selectedLabel}`)
  if (!scenarios.includes(selected)) {
    throw new Error(`consumer smoke scenario ${selectedLabel} is not in group ${group}`)
  }
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
    const upgradeFrom = options.upgrade_from
      ? assertExactSha(options.upgrade_from, 'upgrade source SHA')
      : undefined
    const sourceSha = resolveSourceSha(repoRoot, options.sha ?? options.to, { allowDirty: !upgradeFrom })
    const scenarios = upgradeFrom
      ? []
      : closureScenarios(registry, {
          selectedLabel: options.scenario,
          group: options.group,
        })
    const kept = []
    const dependencyRoot = options.skip_install
      ? undefined
      : await mkdtemp(path.join(tmpdir(), 'geist-consumer-dependencies-'))
    const dependencyNodeModules = dependencyRoot
      ? path.join(dependencyRoot, 'node_modules')
      : path.join(repoRoot, 'node_modules')
    try {
      if (dependencyRoot) {
        const resolution = allResolution(registry)
        await writeFile(
          path.join(dependencyRoot, 'package.json'),
          `${JSON.stringify(packageJson(resolution.externalRequirements), null, 2)}\n`,
        )
        run('pnpm', ['install', '--ignore-workspace', '--ignore-scripts'], dependencyRoot)
      }

      if (!upgradeFrom && !options.scenario && (!options.group || options.group === 'runtime')) {
        const legacyConsumer = await checkLegacyConfigMigration({
          registry,
          sourceSha,
          dependencyNodeModules,
          keepTemp: options.keep_temp,
        })
        if (legacyConsumer) kept.push(legacyConsumer)
      }

      if (upgradeFrom) {
        await runUpgradeSmoke({
          baseSha: upgradeFrom,
          headSha: sourceSha,
          headRegistry: registry,
          dependencyNodeModules,
        })
      }

      for (const scenario of scenarios) {
        const consumerRoot = await mkdtemp(path.join(tmpdir(), `geist-consumer-${scenario.label}-`))
        try {
          const resolution = scenarioResolution(registry, scenario)
          const manifest = packageJson(resolution.externalRequirements)
          await cp(fixtureRoot, consumerRoot, { recursive: true })
          if (scenario.page) await writeFile(path.join(consumerRoot, 'app/pages/index.vue'), scenario.page)
          const before = await protectedHashes(consumerRoot)
          await writeFile(path.join(consumerRoot, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
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
          assertPackageRequirements(manifest, lock, scenario.label)
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
            if (scenario.renderedMarkers || scenario.forbiddenRuntimeOutput) {
              const runtime = await renderBuiltPage(consumerRoot)
              const rendered = runtime.html
              for (const marker of scenario.renderedMarkers ?? []) {
                if (!rendered.includes(marker)) {
                  throw new Error(`${scenario.label}: rendered HTML did not contain ${marker}`)
                }
              }
              for (const pattern of scenario.forbiddenRuntimeOutput ?? []) {
                if (runtime.output.includes(pattern)) {
                  throw new Error(`${scenario.label}: runtime output contained ${pattern}`)
                }
              }
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
