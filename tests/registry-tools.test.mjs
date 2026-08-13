import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import semver from 'semver'
import {
  RegistryError,
  VERIFICATION_TAGS,
  applyCopyPlan,
  assertExactSha,
  assertExpectedPlanDigest,
  assertSafeTarget,
  buildApplyResult,
  buildRuntimePlanDocument,
  checkConsumer,
  compareCodeUnits,
  loadRegistry,
  parseArgs,
  parseShard,
  planCopy,
  planDocumentDigest,
  readLock,
  resolveCopyRequest,
  resolveItems,
  resolveSourceSha,
  selectShard,
  sha256,
  validateRegistry,
} from '../scripts/lib/registry.mjs'

const SOURCE_SHA = '1234567890abcdef1234567890abcdef12345678'
const OTHER_SOURCE_SHA = 'abcdef1234567890abcdef1234567890abcdef12'
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('accepts the pnpm argument separator', () => {
  const options = parseArgs(['--', 'geist-foundation', '--target', '../consumer', '--to', SOURCE_SHA])
  assert.deepEqual(options.items, ['geist-foundation'])
  assert.equal(options.target, '../consumer')
  assert.equal(options.to, SOURCE_SHA)
  assert.equal(parseArgs(['--json', '--target', '../consumer']).json, true)
})

test('canonical plan ordering is independent of the process locale', () => {
  assert.deepEqual(['ä', 'z', 'A'].sort(compareCodeUnits), ['A', 'z', 'ä'])
  assert.equal(
    planDocumentDigest({ z: 1, ä: 2 }),
    sha256(JSON.stringify({ z: 1, ä: 2 })),
  )
})

test('partitions consumer scenarios into complete deterministic shards', () => {
  const scenarios = Array.from({ length: 12 }, (_, index) => `scenario-${index + 1}`)
  const shards = ['1/3', '2/3', '3/3'].map(value => selectShard(scenarios, parseShard(value)))

  assert.deepEqual(shards, [
    ['scenario-1', 'scenario-4', 'scenario-7', 'scenario-10'],
    ['scenario-2', 'scenario-5', 'scenario-8', 'scenario-11'],
    ['scenario-3', 'scenario-6', 'scenario-9', 'scenario-12'],
  ])
  assert.deepEqual(new Set(shards.flat()), new Set(scenarios))
  assert.equal(shards.flat().length, scenarios.length)

  const isolated = Array.from({ length: 29 }, (_, index) => `isolated-${index + 1}`)
  const halves = ['1/2', '2/2'].map(value => selectShard(isolated, parseShard(value)))
  assert.deepEqual(halves.map(values => values.length), [15, 14])
  assert.deepEqual(new Set(halves.flat()), new Set(isolated))
  assert.deepEqual(selectShard(scenarios, parseShard('1/3')), shards[0])
})

test('rejects malformed or out-of-range consumer shards', () => {
  for (const value of ['0/3', '4/3', '1/0', '01/3', '1/03', '1.5/3', '1/3/4', '1', 'a/b', '9007199254740992/9007199254740992']) {
    assert.throws(() => parseShard(value), /shard/)
  }
  assert.equal(parseShard(undefined), undefined)
})

async function fixture() {
  const repoRoot = await mkdtemp(path.join(tmpdir(), 'geist-registry-repo-'))
  const consumerRoot = await mkdtemp(path.join(tmpdir(), 'geist-registry-consumer-'))
  await mkdir(path.join(repoRoot, 'foundation/components'), { recursive: true })
  await writeFile(path.join(repoRoot, '.geist-source.json'), `${JSON.stringify({
    schemaVersion: 1,
    sourceSha: SOURCE_SHA,
  })}\n`)
  await writeFile(path.join(repoRoot, 'foundation/components/Dependency.vue'), '<template><span>dependency</span></template>\n')
  await writeFile(path.join(repoRoot, 'foundation/components/Feature.vue'), '<script setup>\nimport Dependency from \'./Dependency.vue\'\n</script>\n<template><Dependency /></template>\n')
  const registry = {
    schemaVersion: 1,
    name: 'fixture',
    repository: 'https://example.test/fixture.git',
    compatibility: { nuxt: '>=4.4.0 <5', nuxtUi: '>=4.9.0 <5', tailwindcss: '>=4.3.0 <5' },
    externalRequirements: {
      packages: {
        '@nuxt/ui': '^4.9.0',
        '@vueuse/core': '^14.3.0',
        nuxt: '>=4.4.0 <5',
        tailwindcss: '>=4.3.0 <5',
      },
      consumerSetup: ['Wrap the app in UApp.'],
    },
    sourceRoots: ['foundation/components'],
    items: [
      {
        name: 'dependency',
        type: 'registry:component',
        title: 'Dependency',
        description: 'Dependency component.',
        verification: ['visual', 'dependency'],
        packageDependencies: { 'dependency-package': '^1.0.0' },
        files: [{ path: 'foundation/components/Dependency.vue', target: 'app/components/Dependency.vue' }],
      },
      {
        name: 'feature',
        type: 'registry:component',
        title: 'Feature',
        description: 'Feature component.',
        verification: ['visual', 'dependency'],
        packageDependencies: { 'feature-package': '^2.0.0' },
        registryDependencies: ['dependency'],
        files: [{ path: 'foundation/components/Feature.vue', target: 'app/components/Feature.vue' }],
      },
    ],
  }
  return { repoRoot, consumerRoot, registry }
}

async function configFixture() {
  const result = await fixture()
  await mkdir(path.join(result.repoRoot, 'foundation/config'), { recursive: true })
  const oldFiles = [
    {
      path: 'foundation/config/geist-nuxt.ts',
      target: 'app/config/geist-nuxt.ts',
      content: 'export const geistNuxtConfig = { ui: {} }\n',
    },
    {
      path: 'foundation/config/geist-app.ts',
      target: 'app/config/geist-app.ts',
      content: 'export const geistAppConfig = { ui: {} }\n',
    },
  ]
  for (const file of oldFiles) {
    await writeFile(path.join(result.repoRoot, file.path), file.content)
  }
  result.registry.sourceRoots.push('foundation/config')
  result.registry.items.push({
    name: 'foundation-config',
    type: 'registry:style',
    title: 'Foundation config',
    description: 'Managed Nuxt and App config fragments.',
    verification: ['config'],
    files: oldFiles.map(({ path: source, target }) => ({ path: source, target })),
  })
  return { ...result, oldFiles }
}

async function migrateConfigFixture(registry, repoRoot) {
  const current = structuredClone(registry)
  const item = current.items.find(candidate => candidate.name === 'foundation-config')
  const newFiles = [
    {
      path: 'foundation/config/nuxt.ts',
      target: 'app/config/foundation/nuxt.ts',
      content: 'export default { ui: {} }\n',
    },
    {
      path: 'foundation/config/app.ts',
      target: 'app/config/foundation/app.ts',
      content: 'export default { ui: {} }\n',
    },
  ]
  for (const file of newFiles) {
    await writeFile(path.join(repoRoot, file.path), file.content)
  }
  item.files = newFiles.map(({ path: source, target }) => ({ path: source, target }))
  return { current, newFiles }
}

test('validates a complete registry and resolves dependency-first closure', async () => {
  const { repoRoot, registry } = await fixture()
  const result = await validateRegistry(registry, { repoRoot })
  assert.equal(result.sourceOwners.size, 2)
  assert.deepEqual([...result.publicComponentOwners.keys()], ['Dependency', 'Feature'])
  const resolution = resolveItems(registry, ['feature'])
  assert.deepEqual(resolution.items.map(item => item.name), ['dependency', 'feature'])
  assert.deepEqual(resolution.files.map(file => file.target), ['app/components/Dependency.vue', 'app/components/Feature.vue'])
  assert.deepEqual(resolution.externalRequirements.packages, {
    '@nuxt/ui': '^4.9.0',
    '@vueuse/core': '^14.3.0',
    'dependency-package': '^1.0.0',
    'feature-package': '^2.0.0',
    nuxt: '>=4.4.0 <5',
    tailwindcss: '>=4.3.0 <5',
  })
})

test('fails closed on missing, empty, unknown, or duplicate verification metadata', async (t) => {
  await t.test('missing verification', async () => {
    const { repoRoot, registry } = await fixture()
    delete registry.items[0].verification
    await assert.rejects(validateRegistry(registry, { repoRoot }), /items\[0\]\.verification must be a non-empty array/)
  })

  await t.test('empty verification', async () => {
    const { repoRoot, registry } = await fixture()
    registry.items[0].verification = []
    await assert.rejects(validateRegistry(registry, { repoRoot }), /verification must be a non-empty array/)
  })

  await t.test('non-array verification', async () => {
    const { repoRoot, registry } = await fixture()
    registry.items[0].verification = 'visual'
    await assert.rejects(validateRegistry(registry, { repoRoot }), /verification must be a non-empty array/)
  })

  await t.test('unknown tag', async () => {
    const { repoRoot, registry } = await fixture()
    registry.items[0].verification = ['visual', 'made-up']
    await assert.rejects(validateRegistry(registry, { repoRoot }), /verification contains an unknown tag: "made-up"/)
  })

  await t.test('non-string tag', async () => {
    const { repoRoot, registry } = await fixture()
    registry.items[0].verification = [['visual']]
    await assert.rejects(validateRegistry(registry, { repoRoot }), /verification contains an unknown tag/)
  })

  await t.test('duplicate tags', async () => {
    const { repoRoot, registry } = await fixture()
    registry.items[0].verification = ['visual', 'visual']
    await assert.rejects(validateRegistry(registry, { repoRoot }), /verification contains duplicates/)
  })

  await t.test('package dependencies without dependency verification', async () => {
    const { repoRoot, registry } = await fixture()
    registry.items[0].verification = ['visual']
    await assert.rejects(validateRegistry(registry, { repoRoot }), /verification must include "dependency" when packageDependencies are declared/)
  })
})

test('real registry items declare complete verification metadata from the stable vocabulary', async () => {
  const registry = await loadRegistry(path.join(PROJECT_ROOT, 'registry.json'))
  for (const item of registry.items) {
    assert.equal(Array.isArray(item.verification) && item.verification.length > 0, true, `${item.name} must declare verification tags`)
    for (const tag of item.verification) {
      assert.equal(VERIFICATION_TAGS.includes(tag), true, `${item.name} declares unknown tag ${tag}`)
    }
    if (item.packageDependencies) {
      assert.equal(item.verification.includes('dependency'), true, `${item.name} must verify package dependency integration`)
    }
  }
  const foundation = registry.items.find(item => item.name === 'geist-foundation')
  assert.deepEqual(foundation.verification, ['visual', 'foundation', 'config'])

  const expectedBehaviorTags = {
    'api-docs-code-block': ['visual', 'interaction', 'responsive'],
    'api-docs-response-example': ['visual', 'interaction', 'responsive'],
    'api-docs-field-item': ['visual', 'interaction', 'responsive'],
    'api-docs-relation-source-path': ['visual', 'interaction', 'responsive'],
    'api-docs-operation-target': ['visual', 'interaction', 'responsive'],
    'api-docs-code-rail': ['visual', 'interaction', 'responsive'],
    'api-docs-site-search': ['visual', 'interaction', 'responsive', 'dependency'],
  }
  for (const [name, tags] of Object.entries(expectedBehaviorTags)) {
    assert.deepEqual(registry.items.find(item => item.name === name)?.verification, tags)
  }
})

test('keeps compatibility and external package requirements equivalent', async (t) => {
  await t.test('accepts semantically equivalent ranges', async () => {
    const { repoRoot, registry } = await fixture()
    registry.externalRequirements.packages.nuxt = '^4.4.0'
    await validateRegistry(registry, { repoRoot })
  })

  await t.test('accepts an empty OR branch when another branch is satisfiable', async () => {
    const { repoRoot, registry } = await fixture()
    registry.externalRequirements.packages.nuxt = '>=1 <1 || ^4.4.0'
    await validateRegistry(registry, { repoRoot })
  })

  await t.test('rejects an invalid compatibility range', async () => {
    const { repoRoot, registry } = await fixture()
    registry.compatibility.nuxt = '^4..0'
    await assert.rejects(validateRegistry(registry, { repoRoot }), /compatibility.nuxt must be a valid semver range/)
  })

  await t.test('rejects an unsatisfiable compatibility range', async () => {
    const { repoRoot, registry } = await fixture()
    registry.compatibility.nuxt = '>5 <4'
    await assert.rejects(validateRegistry(registry, { repoRoot }), /compatibility.nuxt must be a valid semver range/)
  })

  await t.test('rejects an unsatisfiable external package range', async () => {
    const { repoRoot, registry } = await fixture()
    registry.externalRequirements.packages.nuxt = '>5 <4'
    await assert.rejects(
      validateRegistry(registry, { repoRoot }),
      /externalRequirements.packages.nuxt must be a valid semver range/,
    )
  })

  await t.test('rejects a missing mapped package', async () => {
    const { repoRoot, registry } = await fixture()
    delete registry.externalRequirements.packages.tailwindcss
    await assert.rejects(validateRegistry(registry, { repoRoot }), /externalRequirements.packages must declare tailwindcss/)
  })

  for (const [label, range] of [
    ['narrower', '4.4.8'],
    ['broader', '>=4.0.0 <5'],
  ]) {
    await t.test(`rejects a ${label} external package range`, async () => {
      const { repoRoot, registry } = await fixture()
      registry.externalRequirements.packages.nuxt = range
      await assert.rejects(
        validateRegistry(registry, { repoRoot }),
        /compatibility.nuxt must match externalRequirements.packages.nuxt/,
      )
    })
  }
})

test('supports Nuxt 4.5 consumers in the real registry contract', async () => {
  const registry = await loadRegistry(path.join(PROJECT_ROOT, 'registry.json'))
  assert.equal(semver.satisfies('4.5.0', registry.compatibility.nuxt), true)
  assert.equal(semver.satisfies('4.5.0', registry.externalRequirements.packages.nuxt), true)
})

test('keeps the real managed config surface vendor-neutral', async () => {
  const registry = await loadRegistry(path.join(PROJECT_ROOT, 'registry.json'))
  const foundation = registry.items.find(item => item.name === 'geist-foundation')
  assert.deepEqual(
    foundation.files.filter(file => file.path.startsWith('foundation/config/')),
    [
      { path: 'foundation/config/nuxt.ts', target: 'app/config/foundation/nuxt.ts' },
      { path: 'foundation/config/app.ts', target: 'app/config/foundation/app.ts' },
    ],
  )
  const vendorTargets = registry.items
    .flatMap(item => item.files.map(file => file.target))
    .filter(target => /geist/i.test(target))
  assert.deepEqual(vendorTargets, [])

  for (const [entrypoint, expectedImport] of Object.entries({
    'tests/fixtures/consumer/nuxt.config.ts': "import base from './app/config/foundation/nuxt'",
    'tests/fixtures/consumer/app/app.config.ts': "import base from './config/foundation/app'",
  })) {
    const source = await readFile(path.join(PROJECT_ROOT, entrypoint), 'utf8')
    assert.equal(source.split('\n', 1)[0], expectedImport)
    assert.doesNotMatch(source, /\bgeist[A-Z]\w*|config\/geist-/)
  }
})

test('keeps the real public component surface flat, neutral, and unique', async () => {
  const registry = await loadRegistry(path.join(PROJECT_ROOT, 'registry.json'))
  const result = await validateRegistry(registry, { repoRoot: PROJECT_ROOT })
  const publicNames = [...result.publicComponentOwners.keys()]

  assert.equal(publicNames.length, 30)
  assert.equal(new Set(publicNames).size, publicNames.length)
  assert.equal(publicNames.includes('HttpMethodBadge'), true)
  assert.equal(publicNames.includes('WebhookBadge'), true)
  assert.equal(publicNames.includes('RelationSourcePath'), true)
  assert.equal(publicNames.includes('AppHeader'), true)
  assert.deepEqual(publicNames.filter(name => /^(?:ApiDocs|Composition)/.test(name)), [])
})

test('rejects undeclared files, duplicate targets, cycles, and undeclared relative imports', async (t) => {
  await t.test('undeclared source file', async () => {
    const { repoRoot, registry } = await fixture()
    await writeFile(path.join(repoRoot, 'foundation/components/Undeclared.vue'), '<template />\n')
    await assert.rejects(validateRegistry(registry, { repoRoot }), /not declared by any item/)
  })

  await t.test('source file outside declared source roots', async () => {
    const { repoRoot, registry } = await fixture()
    await mkdir(path.join(repoRoot, 'foundation/composables'), { recursive: true })
    await writeFile(path.join(repoRoot, 'foundation/composables/useUndeclared.ts'), 'export const useUndeclared = () => true\n')
    await assert.rejects(validateRegistry(registry, { repoRoot }), /outside declared sourceRoots/)
  })

  await t.test('symlinked canonical source root', async () => {
    const { repoRoot, registry } = await fixture()
    const outsideRoot = await mkdtemp(path.join(tmpdir(), 'geist-registry-outside-'))
    await symlink(outsideRoot, path.join(repoRoot, 'kits'), 'dir')
    await assert.rejects(
      validateRegistry(registry, { repoRoot }),
      /canonical source root must be a non-symlink directory: kits/,
    )
  })

  await t.test('duplicate target', async () => {
    const { repoRoot, registry } = await fixture()
    registry.items[1].files[0].target = registry.items[0].files[0].target
    await assert.rejects(validateRegistry(registry, { repoRoot }), /target path has multiple owners/)
  })

  await t.test('dependency cycle', async () => {
    const { repoRoot, registry } = await fixture()
    registry.items[0].registryDependencies = ['feature']
    await assert.rejects(validateRegistry(registry, { repoRoot }), /dependency cycle/)
  })

  await t.test('invalid item package dependency', async () => {
    const { repoRoot, registry } = await fixture()
    registry.items[1].packageDependencies = { 'Feature Package': '' }
    await assert.rejects(validateRegistry(registry, { repoRoot }), /invalid package name|valid semver range/)
  })

  await t.test('invalid item package range', async () => {
    const { repoRoot, registry } = await fixture()
    registry.items[1].packageDependencies = { 'feature-package': '' }
    await assert.rejects(validateRegistry(registry, { repoRoot }), /valid semver range/)

    registry.items[1].packageDependencies = { 'feature-package': '^17..0' }
    await assert.rejects(validateRegistry(registry, { repoRoot }), /valid semver range/)
  })

  await t.test('conflicting package dependency', async () => {
    const { repoRoot, registry } = await fixture()
    registry.items[1].packageDependencies = { '@nuxt/ui': '^5.0.0' }
    await assert.rejects(validateRegistry(registry, { repoRoot }), /package dependency conflict/)
    assert.throws(() => resolveItems(registry, ['feature']), /package dependency conflict/)
  })

  await t.test('independent items may use incompatible ranges until selected together', async () => {
    const { repoRoot, registry } = await fixture()
    registry.items[0].packageDependencies = { shared: '^1.0.0' }
    registry.items[1].packageDependencies = { shared: '^2.0.0' }
    registry.items[1].registryDependencies = []
    await writeFile(path.join(repoRoot, 'foundation/components/Feature.vue'), '<template><span>feature</span></template>\n')

    await validateRegistry(registry, { repoRoot })
    assert.doesNotThrow(() => resolveItems(registry, ['dependency']))
    assert.doesNotThrow(() => resolveItems(registry, ['feature']))
    assert.throws(() => resolveItems(registry, ['dependency', 'feature']), /package dependency conflict/)
  })

  await t.test('package names cannot collide with object prototype keys', async () => {
    const { repoRoot, registry } = await fixture()
    registry.items[0].packageDependencies = { constructor: '^1.0.0' }

    await validateRegistry(registry, { repoRoot })
    assert.equal(resolveItems(registry, ['dependency']).externalRequirements.packages.constructor, '^1.0.0')
  })

  await t.test('bare imports require a package declaration in the item closure', async () => {
    const { repoRoot, registry } = await fixture()
    delete registry.items[1].packageDependencies
    await writeFile(
      path.join(repoRoot, 'foundation/components/Feature.vue'),
      '<script setup>\nimport feature from \'feature-package\'\nvoid feature\n</script>\n<template><span>feature</span></template>\n',
    )

    await assert.rejects(validateRegistry(registry, { repoRoot }), /imports package feature-package.*without declaring/)
  })

  await t.test('comments, strings, and Node builtins do not create package requirements', async () => {
    const { repoRoot, registry } = await fixture()
    await writeFile(
      path.join(repoRoot, 'foundation/components/Feature.vue'),
      `<script setup lang="ts">
import path from 'path'
const example = "import('not-a-package')"
// import commented from 'also-not-a-package'
void path
void example
</script>
<template><span>feature</span></template>
`,
    )

    await validateRegistry(registry, { repoRoot })
  })

  await t.test('CSS imports resolve packages without treating comments or URLs as packages', async () => {
    const { repoRoot, registry } = await fixture()
    await writeFile(
      path.join(repoRoot, 'foundation/components/imports.css'),
      `/* @import "comment-only"; */
@import url(style-package);
@import url("https://example.test/theme.css");
`,
    )
    registry.items.push({
      name: 'styles',
      type: 'registry:style',
      title: 'Styles',
      description: 'Style imports.',
      verification: ['visual', 'dependency'],
      packageDependencies: { 'style-package': '^1.0.0' },
      files: [{ path: 'foundation/components/imports.css', target: 'app/assets/css/imports.css' }],
    })

    await validateRegistry(registry, { repoRoot })
    delete registry.items.at(-1).packageDependencies
    await assert.rejects(validateRegistry(registry, { repoRoot }), /imports package style-package.*without declaring/)
  })

  await t.test('missing dependency declaration for a relative import', async () => {
    const { repoRoot, registry } = await fixture()
    registry.items[1].registryDependencies = []
    await assert.rejects(validateRegistry(registry, { repoRoot }), /without declaring a dependency/)
  })

  await t.test('relative import outside the declared distribution', async () => {
    const { repoRoot, registry } = await fixture()
    await writeFile(
      path.join(repoRoot, 'foundation/components/Feature.vue'),
      '<script setup>\nimport Outside from \'../../outside.vue\'\n</script>\n<template><Outside /></template>\n',
    )
    await assert.rejects(validateRegistry(registry, { repoRoot }), /does not resolve to a declared source file/)
  })

  await t.test('relative import whose copied targets no longer preserve the source layout', async () => {
    const { repoRoot, registry } = await fixture()
    registry.items[0].files[0].target = 'app/components/RenamedDependency.vue'
    await assert.rejects(validateRegistry(registry, { repoRoot }), /does not resolve.*after copy/)
  })

  await t.test('rendering item with a nested public target', async () => {
    const { repoRoot, registry } = await fixture()
    registry.items[0].files[0].target = 'app/components/nested/Dependency.vue'
    await assert.rejects(validateRegistry(registry, { repoRoot }), /exactly one flat app\/components/)
  })

  await t.test('rendering item whose title differs from its public component', async () => {
    const { repoRoot, registry } = await fixture()
    registry.items[0].title = 'ApiDocsDependency'
    await assert.rejects(validateRegistry(registry, { repoRoot }), /title must match public component name/)
  })

  await t.test('dynamic relative import still requires its owning item dependency', async () => {
    const { repoRoot, registry } = await fixture()
    registry.items[1].registryDependencies = []
    await writeFile(
      path.join(repoRoot, 'foundation/components/Feature.vue'),
      '<script setup>\nconst Dependency = defineAsyncComponent(() => import(\'./Dependency.vue\'))\n</script>\n<template><Dependency /></template>\n',
    )
    await assert.rejects(validateRegistry(registry, { repoRoot }), /without declaring a dependency/)
  })
})

test('emits a versioned machine-readable runtime plan with deterministic digest', async () => {
  const { repoRoot, consumerRoot, registry } = await fixture()
  const buildDocument = async () => buildRuntimePlanDocument(await planCopy({
    registry,
    resolution: resolveItems(registry, ['feature']),
    repoRoot,
    consumerRoot,
    sourceSha: SOURCE_SHA,
  }))
  const document = await buildDocument()
  assert.equal(document.planSchemaVersion, 1)
  assert.equal(document.kind, 'runtime')
  assert.deepEqual(document.registry, { name: 'fixture', repository: 'https://example.test/fixture.git' })
  assert.equal(document.sourceSha, SOURCE_SHA)
  assert.deepEqual(document.consumer, { lockPresent: false, lockSourceSha: null })
  assert.deepEqual(
    document.operations.map(operation => [operation.action, operation.owner, operation.target]),
    [
      ['create', 'item:dependency', 'app/components/Dependency.vue'],
      ['create', 'item:feature', 'app/components/Feature.vue'],
    ],
  )
  for (const operation of document.operations) {
    assert.equal(operation.beforeHash, null)
    assert.match(operation.afterHash, /^[0-9a-f]{64}$/)
    assert.deepEqual(operation.verification, ['visual', 'dependency'])
    assert.equal(operation.verificationSource, undefined)
    assert.equal(path.posix.isAbsolute(operation.source) || path.posix.isAbsolute(operation.target), false)
  }
  assert.deepEqual(
    document.packageOperations.map(operation => [operation.action, operation.name]),
    [
      ['add', '@nuxt/ui'],
      ['add', '@vueuse/core'],
      ['add', 'dependency-package'],
      ['add', 'feature-package'],
      ['add', 'nuxt'],
      ['add', 'tailwindcss'],
    ],
  )
  assert.deepEqual(document.consumerSetupOperations, [{ action: 'add', instruction: 'Wrap the app in UApp.' }])
  assert.deepEqual(document.configMigrations, [])
  assert.deepEqual(document.summary, { create: 2, update: 0, delete: 0, unchanged: 0, verification: ['visual', 'dependency'] })
  assert.equal(document.planDigest, planDocumentDigest(document))
  assert.deepEqual(await buildDocument(), document)
})

test('sorts runtime plan operations by locale-independent code-unit order', () => {
  const operation = target => ({
    action: 'create',
    item: 'feature',
    path: target,
    sourceHash: '1'.repeat(64),
    target,
  })
  const document = buildRuntimePlanDocument({
    registry: {
      name: 'fixture',
      repository: 'https://example.test/fixture.git',
      items: [{ name: 'feature', verification: ['visual'] }],
    },
    resolution: { externalRequirements: { packages: {}, consumerSetup: [] } },
    sourceSha: SOURCE_SHA,
    operations: [operation('ä.vue'), operation('z.vue')],
  })

  assert.deepEqual(document.operations.map(entry => entry.target), ['z.vue', 'ä.vue'])
})

test('expected plan digest gate validates format and fails closed on drift', () => {
  const document = { planDigest: 'a'.repeat(64) }
  assert.equal(assertExpectedPlanDigest(document, 'A'.repeat(64)), 'a'.repeat(64))
  assert.throws(() => assertExpectedPlanDigest(document, 'main'), /64-character sha256 plan digest/)
  assert.throws(
    () => assertExpectedPlanDigest(document, 'b'.repeat(64)),
    error => error instanceof RegistryError
      && error.code === 'PLAN_CHANGED'
      && /no files were written/.test(error.message),
  )
})

test('apply result echoes the plan digest and per-operation outcomes', () => {
  const document = {
    planDigest: 'c'.repeat(64),
    operations: [
      { action: 'create', target: 'a', beforeHash: null },
      { action: 'update', target: 'b', beforeHash: '1'.repeat(64) },
      { action: 'unchanged', target: 'c', beforeHash: '2'.repeat(64) },
      { action: 'delete', target: 'd', beforeHash: '3'.repeat(64) },
      { action: 'delete', target: 'e', beforeHash: null },
    ],
  }
  const result = buildApplyResult(document, { expectedPlanDigest: 'c'.repeat(64), lockSourceSha: SOURCE_SHA })
  assert.equal(result.planDigest, document.planDigest)
  assert.equal(result.apply.expectedPlanDigest, 'c'.repeat(64))
  assert.equal(result.apply.lockSourceSha, SOURCE_SHA)
  assert.deepEqual(result.apply.operations.map(operation => operation.outcome), [
    'applied',
    'applied',
    'skipped',
    'applied',
    'skipped',
  ])
})

test('apply re-verifies every planned before-state and stops with zero writes on drift', async () => {
  const { repoRoot, consumerRoot, registry } = await fixture()
  const plan = await planCopy({
    registry,
    resolution: resolveItems(registry, ['feature']),
    repoRoot,
    consumerRoot,
    sourceSha: SOURCE_SHA,
  })
  await mkdir(path.join(consumerRoot, 'app/components'), { recursive: true })
  await writeFile(path.join(consumerRoot, 'app/components/Feature.vue'), '<template>raced in</template>\n')

  await assert.rejects(
    applyCopyPlan(plan),
    error => error instanceof RegistryError
      && error.code === 'PLAN_CHANGED'
      && /consumer target changed after planning: app\/components\/Feature\.vue/.test(error.message),
  )
  await assert.rejects(readFile(path.join(consumerRoot, 'app/components/Dependency.vue')), /ENOENT/)
  await assert.rejects(readFile(path.join(consumerRoot, 'geist.lock.json')), /ENOENT/)
})

test('runtime CLI performs guarded apply end to end against the real registry', async () => {
  const consumerRoot = await mkdtemp(path.join(tmpdir(), 'geist-guarded-consumer-'))
  const cli = path.join(PROJECT_ROOT, 'scripts/copy-registry.mjs')
  const env = { ...process.env, GEIST_REGISTRY_TEST_ALLOW_DIRTY: '1' }
  const runCli = args => spawnSync(process.execPath, [cli, 'geist-foundation', '--target', consumerRoot, ...args], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    env,
  })

  const document = JSON.parse(runCli(['--json']).stdout)
  assert.equal(document.kind, 'runtime')

  const changed = runCli(['--write', '--expect-plan', 'f'.repeat(64), '--json'])
  assert.notEqual(changed.status, 0)
  assert.equal(JSON.parse(changed.stdout).error.code, 'PLAN_CHANGED')
  await assert.rejects(readFile(path.join(consumerRoot, 'geist.lock.json')), /ENOENT/)

  const rejected = runCli(['--expect-plan', document.planDigest])
  assert.notEqual(rejected.status, 0)
  assert.match(rejected.stderr, /--expect-plan requires --write/)

  const write = runCli(['--write', '--expect-plan', document.planDigest, '--json'])
  assert.equal(write.status, 0, write.stderr)
  const result = JSON.parse(write.stdout)
  assert.equal(result.planDigest, document.planDigest)
  assert.equal(result.apply.expectedPlanDigest, document.planDigest)
  assert.equal(result.apply.operations.every(operation => operation.outcome === 'applied'), true)
  assert.equal(result.apply.lockSourceSha, result.sourceSha)

  const converged = JSON.parse(runCli(['--json']).stdout)
  assert.equal(converged.summary.create + converged.summary.update + converged.summary.delete, 0)
})

test('sourceSha-only rewrite keeps operations unchanged and creates no runtime impact', async () => {
  const { repoRoot, consumerRoot, registry } = await fixture()
  const resolution = resolveItems(registry, ['feature'])
  await applyCopyPlan(await planCopy({ registry, resolution, repoRoot, consumerRoot, sourceSha: SOURCE_SHA }))
  const document = buildRuntimePlanDocument(await planCopy({
    registry,
    resolution: resolveCopyRequest(registry, [], { lock: await readLock(consumerRoot), update: true }),
    repoRoot,
    consumerRoot,
    sourceSha: OTHER_SOURCE_SHA,
    update: true,
  }))
  assert.deepEqual(document.summary, { create: 0, update: 0, delete: 0, unchanged: 2, verification: [] })
  assert.deepEqual(document.packageOperations, [])
  assert.deepEqual(document.consumerSetupOperations, [])
  for (const operation of document.operations) {
    assert.equal(operation.action, 'unchanged')
    assert.equal(operation.beforeHash, operation.afterHash)
  }
})

test('resolves delete operation verification from registry, then lock, then vocabulary fallback', async (t) => {
  await t.test('config migration keeps registry-resolved tags and reports the relocation', async () => {
    const { repoRoot, consumerRoot, registry } = await configFixture()
    await applyCopyPlan(await planCopy({
      registry,
      resolution: resolveItems(registry, ['foundation-config']),
      repoRoot,
      consumerRoot,
      sourceSha: SOURCE_SHA,
    }))
    const { current } = await migrateConfigFixture(registry, repoRoot)
    const document = buildRuntimePlanDocument(await planCopy({
      registry: current,
      resolution: resolveCopyRequest(current, [], { lock: await readLock(consumerRoot), update: true }),
      repoRoot,
      consumerRoot,
      sourceSha: OTHER_SOURCE_SHA,
      update: true,
    }))
    const deletes = document.operations.filter(operation => operation.action === 'delete')
    assert.equal(deletes.length, 2)
    for (const operation of deletes) {
      assert.deepEqual(operation.verification, ['config'])
      assert.equal(operation.verificationSource, 'registry')
      assert.equal(operation.afterHash, null)
    }
    assert.deepEqual(document.configMigrations, [{
      owner: 'item:foundation-config',
      from: ['app/config/geist-app.ts', 'app/config/geist-nuxt.ts'],
      to: ['app/config/foundation/app.ts', 'app/config/foundation/nuxt.ts'],
    }])
    assert.deepEqual(document.summary.verification, ['config'])
  })

  await t.test('removed item falls back to lock-recorded tags, then the full vocabulary', async () => {
    const { repoRoot, consumerRoot, registry } = await fixture()
    await applyCopyPlan(await planCopy({
      registry,
      resolution: resolveItems(registry, ['feature']),
      repoRoot,
      consumerRoot,
      sourceSha: SOURCE_SHA,
    }))

    const withoutDependency = structuredClone(registry)
    withoutDependency.items = [withoutDependency.items.find(item => item.name === 'feature')]
    withoutDependency.items[0].registryDependencies = []
    const buildDocument = async () => buildRuntimePlanDocument(await planCopy({
      registry: withoutDependency,
      resolution: resolveItems(withoutDependency, ['feature']),
      repoRoot,
      consumerRoot,
      sourceSha: SOURCE_SHA,
      update: true,
    }))
    const fromLock = (await buildDocument()).operations.find(operation => operation.action === 'delete')
    assert.equal(fromLock.owner, 'item:dependency')
    assert.deepEqual(fromLock.verification, ['visual', 'dependency'])
    assert.equal(fromLock.verificationSource, 'lock')

    const lockPath = path.join(consumerRoot, 'geist.lock.json')
    const legacy = JSON.parse(await readFile(lockPath, 'utf8'))
    for (const record of Object.values(legacy.items)) delete record.verification
    await writeFile(lockPath, `${JSON.stringify(legacy, null, 2)}\n`)
    const fallback = (await buildDocument()).operations.find(operation => operation.action === 'delete')
    assert.deepEqual(fallback.verification, [...VERIFICATION_TAGS])
    assert.equal(fallback.verificationSource, 'vocabulary-fallback')
  })
})

test('package and consumer setup changes surface as typed plan operations', async () => {
  const { repoRoot, consumerRoot, registry } = await fixture()
  await applyCopyPlan(await planCopy({
    registry,
    resolution: resolveItems(registry, ['feature']),
    repoRoot,
    consumerRoot,
    sourceSha: SOURCE_SHA,
  }))
  const current = structuredClone(registry)
  current.items[1].packageDependencies = { 'feature-package': '^3.0.0' }
  delete current.items[0].packageDependencies
  current.externalRequirements.consumerSetup = ['Wrap the application in UApp.']
  const document = buildRuntimePlanDocument(await planCopy({
    registry: current,
    resolution: resolveCopyRequest(current, [], { lock: await readLock(consumerRoot), update: true }),
    repoRoot,
    consumerRoot,
    sourceSha: SOURCE_SHA,
    update: true,
  }))
  assert.deepEqual(document.packageOperations, [
    { action: 'remove', name: 'dependency-package', before: '^1.0.0', after: null },
    { action: 'change', name: 'feature-package', before: '^2.0.0', after: '^3.0.0' },
  ])
  assert.deepEqual(document.consumerSetupOperations, [
    { action: 'add', instruction: 'Wrap the application in UApp.' },
    { action: 'remove', instruction: 'Wrap the app in UApp.' },
  ])
})

test('lock records canonical verification tags and check flags tampering', async () => {
  const { repoRoot, consumerRoot, registry } = await fixture()
  registry.items[1].verification = ['dependency', 'visual']
  await applyCopyPlan(await planCopy({
    registry,
    resolution: resolveItems(registry, ['feature']),
    repoRoot,
    consumerRoot,
    sourceSha: SOURCE_SHA,
  }))
  const lock = await readLock(consumerRoot)
  assert.deepEqual(lock.items.feature.verification, ['visual', 'dependency'])
  await checkConsumer({ registry, repoRoot, consumerRoot })

  const lockPath = path.join(consumerRoot, 'geist.lock.json')
  const tampered = structuredClone(lock)
  tampered.items.feature.verification = ['interaction']
  await writeFile(lockPath, `${JSON.stringify(tampered, null, 2)}\n`)
  await assert.rejects(checkConsumer({ registry, repoRoot, consumerRoot }), /locked item verification differs from registry: feature/)

  const legacy = structuredClone(lock)
  for (const record of Object.values(legacy.items)) delete record.verification
  await writeFile(lockPath, `${JSON.stringify(legacy, null, 2)}\n`)
  await checkConsumer({ registry, repoRoot, consumerRoot })

  const malformed = structuredClone(lock)
  malformed.items.feature.verification = []
  await writeFile(lockPath, `${JSON.stringify(malformed, null, 2)}\n`)
  await assert.rejects(readLock(consumerRoot), /unsupported format/)
})

test('rejects unsafe paths and protected consumer files while allowing the managed foundation main.css', () => {
  assert.throws(() => assertSafeTarget('../outside.vue'), /escapes/)
  assert.throws(() => assertSafeTarget('/tmp/outside.vue'), /relative/)
  assert.throws(() => assertSafeTarget('node_modules/pkg/index.js'), /dependency directory/)
  assert.throws(() => assertSafeTarget('nuxt.config.ts'), /protected/)
  assert.throws(() => assertSafeTarget('app/app.config.ts'), /protected/)
  assert.equal(assertSafeTarget('app/assets/css/main.css'), 'app/assets/css/main.css')
  assert.throws(() => assertSafeTarget('assets/css/main.css'), /protected/)
  assert.throws(() => assertExactSha('main'), /exact 40-character Git SHA/)
  assert.equal(assertExactSha(SOURCE_SHA.toUpperCase()), SOURCE_SHA)
})

test('copy planning rejects a symlink anywhere in the consumer target path', async () => {
  const { repoRoot, consumerRoot, registry } = await fixture()
  const outsideRoot = await mkdtemp(path.join(tmpdir(), 'geist-registry-outside-'))
  await mkdir(path.join(consumerRoot, 'app'), { recursive: true })
  await symlink(outsideRoot, path.join(consumerRoot, 'app/components'), 'dir')

  await assert.rejects(
    planCopy({
      registry,
      resolution: resolveItems(registry, ['feature']),
      repoRoot,
      consumerRoot,
      sourceSha: SOURCE_SHA,
    }),
    /contains a symbolic link/,
  )
  await assert.rejects(readFile(path.join(outsideRoot, 'Feature.vue')), /ENOENT/)
})

test('exact-SHA resolution refuses dirty distributable source', async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), 'geist-registry-git-'))
  await mkdir(path.join(repoRoot, 'foundation'), { recursive: true })
  await writeFile(path.join(repoRoot, 'foundation/Example.vue'), '<template />\n')
  await writeFile(path.join(repoRoot, 'registry.json'), '{}\n')
  execFileSync('git', ['init'], { cwd: repoRoot, stdio: 'ignore' })
  execFileSync('git', ['config', 'user.email', 'registry-test@example.invalid'], { cwd: repoRoot })
  execFileSync('git', ['config', 'user.name', 'Registry Test'], { cwd: repoRoot })
  execFileSync('git', ['add', 'foundation', 'registry.json'], { cwd: repoRoot })
  execFileSync('git', ['commit', '-m', 'fixture'], { cwd: repoRoot, stdio: 'ignore' })

  const sourceSha = resolveSourceSha(repoRoot)
  assert.match(sourceSha, /^[0-9a-f]{40}$/)
  await writeFile(path.join(repoRoot, 'foundation/Example.vue'), '<template>dirty</template>\n')
  assert.throws(() => resolveSourceSha(repoRoot, sourceSha), /source is dirty/)
  assert.equal(resolveSourceSha(repoRoot, sourceSha, { allowDirty: true }), sourceSha)
})

test('source SHA falls back to release metadata when the snapshot has no .git', async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), 'geist-registry-snapshot-'))
  await writeFile(path.join(repoRoot, '.geist-source.json'), `${JSON.stringify({
    schemaVersion: 1,
    sourceSha: SOURCE_SHA,
  })}\n`)

  assert.equal(resolveSourceSha(repoRoot), SOURCE_SHA)
  assert.equal(resolveSourceSha(repoRoot, SOURCE_SHA), SOURCE_SHA)
  assert.throws(
    () => resolveSourceSha(repoRoot, 'abcdefabcdefabcdefabcdefabcdefabcdefabcd'),
    /does not match.*source/i,
  )

  await writeFile(path.join(repoRoot, '.geist-source.json'), '{"schemaVersion":2,"sourceSha":"bad"}\n')
  assert.throws(() => resolveSourceSha(repoRoot), /unsupported format/)
})

test('dry-run planning writes nothing; write records exact SHA and source/target hashes', async () => {
  const { repoRoot, consumerRoot, registry } = await fixture()
  await validateRegistry(registry, { repoRoot })
  const resolution = resolveItems(registry, ['feature'])
  const plan = await planCopy({ registry, resolution, repoRoot, consumerRoot, sourceSha: SOURCE_SHA })
  assert.deepEqual(plan.operations.map(operation => operation.action), ['create', 'create'])
  await assert.rejects(readFile(path.join(consumerRoot, 'app/components/Feature.vue')), /ENOENT/)

  await applyCopyPlan(plan)
  const lock = await readLock(consumerRoot)
  assert.deepEqual(lock.requestedItems, ['feature'])
  assert.equal(lock.items.feature.sourceSha, SOURCE_SHA)
  assert.deepEqual(lock.items.dependency.packageDependencies, { 'dependency-package': '^1.0.0' })
  assert.deepEqual(lock.items.feature.packageDependencies, { 'feature-package': '^2.0.0' })
  assert.deepEqual(lock.registry.compatibility, registry.compatibility)
  assert.deepEqual(lock.registry.externalRequirements, resolution.externalRequirements)
  const record = lock.files['app/components/Feature.vue']
  assert.equal(record.sourceSha, SOURCE_SHA)
  assert.equal(record.sourceHash, record.targetHash)
  assert.equal(record.targetHash, sha256(await readFile(path.join(consumerRoot, record.target))))
})

test('renames managed config targets and rewrites their lock records', async () => {
  const { repoRoot, consumerRoot, registry, oldFiles } = await configFixture()
  const initial = resolveItems(registry, ['foundation-config'])
  await applyCopyPlan(await planCopy({
    registry,
    resolution: initial,
    repoRoot,
    consumerRoot,
    sourceSha: SOURCE_SHA,
  }))
  const beforeLock = await readFile(path.join(consumerRoot, 'geist.lock.json'), 'utf8')
  const { current, newFiles } = await migrateConfigFixture(registry, repoRoot)
  const resolution = resolveCopyRequest(current, [], {
    lock: await readLock(consumerRoot),
    update: true,
  })

  const plan = await planCopy({
    registry: current,
    resolution,
    repoRoot,
    consumerRoot,
    sourceSha: OTHER_SOURCE_SHA,
    update: true,
  })
  assert.deepEqual(
    Object.fromEntries(plan.operations.map(operation => [operation.target, operation.action])),
    {
      'app/config/foundation/nuxt.ts': 'create',
      'app/config/foundation/app.ts': 'create',
      'app/config/geist-nuxt.ts': 'delete',
      'app/config/geist-app.ts': 'delete',
    },
  )
  assert.equal(await readFile(path.join(consumerRoot, 'geist.lock.json'), 'utf8'), beforeLock)
  for (const file of oldFiles) assert.equal(await readFile(path.join(consumerRoot, file.target), 'utf8'), file.content)
  for (const file of newFiles) {
    await assert.rejects(readFile(path.join(consumerRoot, file.target)), /ENOENT/)
  }

  const lock = await applyCopyPlan(plan)
  assert.deepEqual(lock.items['foundation-config'].files, newFiles.map(file => file.target))
  for (const file of oldFiles) {
    assert.equal(lock.files[file.target], undefined)
    await assert.rejects(readFile(path.join(consumerRoot, file.target)), /ENOENT/)
  }
  for (const file of newFiles) {
    assert.equal(lock.files[file.target].source, file.path)
    assert.equal(await readFile(path.join(consumerRoot, file.target), 'utf8'), file.content)
  }
  await writeFile(path.join(repoRoot, '.geist-source.json'), `${JSON.stringify({
    schemaVersion: 1,
    sourceSha: OTHER_SOURCE_SHA,
  })}\n`)
  await checkConsumer({ registry: current, repoRoot, consumerRoot })
})

test('stops a managed config rename before creating replacements when an old target drifted', async () => {
  const { repoRoot, consumerRoot, registry, oldFiles } = await configFixture()
  await applyCopyPlan(await planCopy({
    registry,
    resolution: resolveItems(registry, ['foundation-config']),
    repoRoot,
    consumerRoot,
    sourceSha: SOURCE_SHA,
  }))
  const lockPath = path.join(consumerRoot, 'geist.lock.json')
  const beforeLock = await readFile(lockPath, 'utf8')
  await writeFile(path.join(consumerRoot, oldFiles[0].target), 'export default { local: true }\n')
  const { current, newFiles } = await migrateConfigFixture(registry, repoRoot)

  await assert.rejects(
    planCopy({
      registry: current,
      resolution: resolveCopyRequest(current, [], {
        lock: await readLock(consumerRoot),
        update: true,
      }),
      repoRoot,
      consumerRoot,
      sourceSha: OTHER_SOURCE_SHA,
      update: true,
    }),
    /conflicting target/,
  )
  assert.equal(await readFile(lockPath, 'utf8'), beforeLock)
  for (const file of newFiles) {
    await assert.rejects(readFile(path.join(consumerRoot, file.target)), /ENOENT/)
  }
})

test('stops a managed config rename before deleting old targets when a new target conflicts', async () => {
  const { repoRoot, consumerRoot, registry, oldFiles } = await configFixture()
  await applyCopyPlan(await planCopy({
    registry,
    resolution: resolveItems(registry, ['foundation-config']),
    repoRoot,
    consumerRoot,
    sourceSha: SOURCE_SHA,
  }))
  const lockPath = path.join(consumerRoot, 'geist.lock.json')
  const beforeLock = await readFile(lockPath, 'utf8')
  const { current, newFiles } = await migrateConfigFixture(registry, repoRoot)
  const conflictingTarget = path.join(consumerRoot, newFiles[0].target)
  const localContent = 'export default { consumer: true }\n'
  await mkdir(path.dirname(conflictingTarget), { recursive: true })
  await writeFile(conflictingTarget, localContent)

  await assert.rejects(
    planCopy({
      registry: current,
      resolution: resolveCopyRequest(current, [], {
        lock: await readLock(consumerRoot),
        update: true,
      }),
      repoRoot,
      consumerRoot,
      sourceSha: OTHER_SOURCE_SHA,
      update: true,
    }),
    /conflicting target/,
  )
  assert.equal(await readFile(lockPath, 'utf8'), beforeLock)
  for (const file of oldFiles) {
    assert.equal(await readFile(path.join(consumerRoot, file.target), 'utf8'), file.content)
  }
  assert.equal(await readFile(conflictingTarget, 'utf8'), localContent)
  await assert.rejects(readFile(path.join(consumerRoot, newFiles[1].target)), /ENOENT/)
})

test('reconcile rejects a lock issued by another registry before trusting managed hashes', async () => {
  const { repoRoot, consumerRoot, registry } = await fixture()
  const resolution = resolveItems(registry, ['feature'])
  await applyCopyPlan(await planCopy({ registry, resolution, repoRoot, consumerRoot, sourceSha: SOURCE_SHA }))
  const foreignLock = await readLock(consumerRoot)
  foreignLock.registry = {
    ...foreignLock.registry,
    name: 'foreign-registry',
    repository: 'https://example.test/foreign.git',
  }

  assert.throws(
    () => resolveCopyRequest(registry, ['feature'], { lock: foreignLock, update: true }),
    /belongs to a different registry/,
  )

  await writeFile(path.join(consumerRoot, 'geist.lock.json'), `${JSON.stringify(foreignLock, null, 2)}\n`)
  await assert.rejects(
    planCopy({ registry, resolution, repoRoot, consumerRoot, sourceSha: SOURCE_SHA, update: true }),
    /belongs to a different registry/,
  )
})

test('consumer check requires one exact source SHA and matching installed hashes', async (t) => {
  const { repoRoot, consumerRoot, registry } = await fixture()
  const resolution = resolveItems(registry, ['feature'])
  await applyCopyPlan(await planCopy({ registry, resolution, repoRoot, consumerRoot, sourceSha: SOURCE_SHA }))
  const originalLock = await readLock(consumerRoot)
  const lockPath = path.join(consumerRoot, 'geist.lock.json')

  await t.test('item source SHA matches registry source SHA', async () => {
    const lock = structuredClone(originalLock)
    lock.items.feature.sourceSha = OTHER_SOURCE_SHA
    await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`)
    await assert.rejects(checkConsumer({ registry, repoRoot, consumerRoot }), /feature sourceSha must match registry lastSourceSha/)
  })

  await t.test('file source SHA matches registry source SHA', async () => {
    const lock = structuredClone(originalLock)
    lock.files['app/components/Feature.vue'].sourceSha = OTHER_SOURCE_SHA
    await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`)
    await assert.rejects(checkConsumer({ registry, repoRoot, consumerRoot }), /Feature\.vue sourceSha must match registry lastSourceSha/)
  })

  await t.test('source and installed hashes remain identical', async () => {
    const lock = structuredClone(originalLock)
    lock.files['app/components/Feature.vue'].sourceHash = sha256('different source')
    await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`)
    await assert.rejects(checkConsumer({ registry, repoRoot, consumerRoot }), /sourceHash must match targetHash/)
  })

  await t.test('installed source SHA matches the checked-out source', async () => {
    await writeFile(lockPath, `${JSON.stringify(originalLock, null, 2)}\n`)
    await writeFile(path.join(repoRoot, '.geist-source.json'), `${JSON.stringify({
      schemaVersion: 1,
      sourceSha: OTHER_SOURCE_SHA,
    })}\n`)
    await assert.rejects(checkConsumer({ registry, repoRoot, consumerRoot }), /does not match checked-out source.*geist:update/)
  })

  await t.test('source metadata is required outside a Git checkout', async () => {
    await writeFile(lockPath, `${JSON.stringify(originalLock, null, 2)}\n`)
    await rm(path.join(repoRoot, '.geist-source.json'))
    await assert.rejects(checkConsumer({ registry, repoRoot, consumerRoot }), /neither \.git nor \.geist-source\.json exists/)
  })

  await t.test('source metadata must be valid JSON', async () => {
    await writeFile(lockPath, `${JSON.stringify(originalLock, null, 2)}\n`)
    await writeFile(path.join(repoRoot, '.geist-source.json'), '{not-json}\n')
    await assert.rejects(checkConsumer({ registry, repoRoot, consumerRoot }), /\.geist-source\.json is not valid JSON/)
  })

  await t.test('source metadata must contain an exact SHA', async () => {
    await writeFile(lockPath, `${JSON.stringify(originalLock, null, 2)}\n`)
    await writeFile(path.join(repoRoot, '.geist-source.json'), `${JSON.stringify({
      schemaVersion: 1,
      sourceSha: 'main',
    })}\n`)
    await assert.rejects(checkConsumer({ registry, repoRoot, consumerRoot }), /must be an exact 40-character Git SHA/)
  })
})

test('copy into an existing lock reconciles the full request set and prunes removed locked items', async () => {
  const { repoRoot, consumerRoot, registry } = await fixture()
  const legacySource = 'foundation/components/Legacy.vue'
  const legacyTarget = 'app/components/Legacy.vue'
  await writeFile(path.join(repoRoot, legacySource), '<template><span>legacy</span></template>\n')
  registry.items[0].files.push({ path: legacySource, target: legacyTarget })

  const initialResolution = resolveItems(registry, ['feature'])
  await applyCopyPlan(await planCopy({
    registry,
    resolution: initialResolution,
    repoRoot,
    consumerRoot,
    sourceSha: SOURCE_SHA,
  }))
  const initialLock = await readLock(consumerRoot)

  const currentRegistry = structuredClone(registry)
  currentRegistry.items[0].files = currentRegistry.items[0].files.filter(file => file.target !== legacyTarget)
  const newSource = 'foundation/components/NewFeature.vue'
  const newTarget = 'app/components/NewFeature.vue'
  await writeFile(path.join(repoRoot, newSource), '<template><span>new</span></template>\n')
  currentRegistry.items.push({
    name: 'new-feature',
    type: 'registry:component',
    title: 'New feature',
    description: 'New feature component.',
    verification: ['visual'],
    registryDependencies: ['dependency'],
    files: [{ path: newSource, target: newTarget }],
  })

  const expanded = resolveCopyRequest(currentRegistry, ['new-feature'], { lock: initialLock })
  assert.deepEqual(expanded.requested, ['feature', 'new-feature'])
  const reconcilePlan = await planCopy({
    registry: currentRegistry,
    resolution: expanded,
    repoRoot,
    consumerRoot,
    sourceSha: SOURCE_SHA,
    update: true,
  })
  assert.equal(reconcilePlan.operations.find(operation => operation.target === legacyTarget).action, 'delete')
  const expandedLock = await applyCopyPlan(reconcilePlan)
  assert.equal(expandedLock.files[legacyTarget], undefined)
  await assert.rejects(readFile(path.join(consumerRoot, legacyTarget)), /ENOENT/)
  await checkConsumer({ registry: currentRegistry, repoRoot, consumerRoot })

  const withoutFeature = structuredClone(currentRegistry)
  withoutFeature.items = withoutFeature.items.filter(item => item.name !== 'feature')
  const recovered = resolveCopyRequest(withoutFeature, [], { lock: expandedLock, update: true })
  assert.deepEqual(recovered.requested, ['new-feature'])
  const recoveryPlan = await planCopy({
    registry: withoutFeature,
    resolution: recovered,
    repoRoot,
    consumerRoot,
    sourceSha: SOURCE_SHA,
    update: true,
  })
  const recoveredLock = await applyCopyPlan(recoveryPlan)
  assert.equal(recoveredLock.items.feature, undefined)
  assert.equal(recoveredLock.files['app/components/Feature.vue'], undefined)
  await assert.rejects(readFile(path.join(consumerRoot, 'app/components/Feature.vue')), /ENOENT/)
  await checkConsumer({ registry: withoutFeature, repoRoot, consumerRoot })
  assert.throws(
    () => resolveCopyRequest(withoutFeature, ['feature'], { lock: recoveredLock, update: true }),
    /unknown registry item: feature/,
  )
})

test('updates an unmodified managed target and stops the whole batch on conflict', async () => {
  const { repoRoot, consumerRoot, registry } = await fixture()
  const resolution = resolveItems(registry, ['feature'])
  await applyCopyPlan(await planCopy({ registry, resolution, repoRoot, consumerRoot, sourceSha: SOURCE_SHA }))

  await writeFile(path.join(repoRoot, 'foundation/components/Feature.vue'), '<template><strong>updated</strong></template>\n')
  const updatePlan = await planCopy({ registry, resolution, repoRoot, consumerRoot, sourceSha: SOURCE_SHA, update: true })
  assert.equal(updatePlan.operations.find(operation => operation.item === 'feature').action, 'update')
  await applyCopyPlan(updatePlan)
  assert.match(await readFile(path.join(consumerRoot, 'app/components/Feature.vue'), 'utf8'), /updated/)

  await writeFile(path.join(consumerRoot, 'app/components/Feature.vue'), '<template>consumer edit</template>\n')
  await writeFile(path.join(repoRoot, 'foundation/components/Dependency.vue'), '<template>new dependency</template>\n')
  await assert.rejects(
    planCopy({ registry, resolution, repoRoot, consumerRoot, sourceSha: SOURCE_SHA, update: true }),
    error => error instanceof RegistryError && /no files were written/.test(error.message),
  )
  assert.doesNotMatch(await readFile(path.join(consumerRoot, 'app/components/Dependency.vue'), 'utf8'), /new dependency/)
})

test('consumer check detects target drift', async () => {
  const { repoRoot, consumerRoot, registry } = await fixture()
  const resolution = resolveItems(registry, ['feature'])
  await applyCopyPlan(await planCopy({ registry, resolution, repoRoot, consumerRoot, sourceSha: SOURCE_SHA }))
  // The fixture source stamp matches the lock SHA, so this test isolates target drift.
  await checkConsumer({ registry, repoRoot, consumerRoot })
  await writeFile(path.join(consumerRoot, 'app/components/Feature.vue'), '<template>drift</template>\n')
  await assert.rejects(checkConsumer({ registry, repoRoot, consumerRoot }), /managed target drifted/)
})

test('consumer check detects registry metadata and dependency-closure drift', async () => {
  const { repoRoot, consumerRoot, registry } = await fixture()
  const resolution = resolveItems(registry, ['feature'])
  await applyCopyPlan(await planCopy({ registry, resolution, repoRoot, consumerRoot, sourceSha: SOURCE_SHA }))

  const metadataChanged = structuredClone(registry)
  metadataChanged.compatibility.nuxt = '>=4.5.0 <5'
  await assert.rejects(
    checkConsumer({ registry: metadataChanged, repoRoot, consumerRoot }),
    /registry metadata differs/,
  )

  const packagesChanged = structuredClone(registry)
  packagesChanged.items.find(item => item.name === 'feature').packageDependencies['feature-package'] = '^3.0.0'
  await assert.rejects(
    checkConsumer({ registry: packagesChanged, repoRoot, consumerRoot }),
    error => (
      error instanceof RegistryError
      && /registry metadata differs/.test(error.message)
      && /item package dependencies differ/.test(error.message)
    ),
  )

  const closureChanged = structuredClone(registry)
  closureChanged.items.unshift({
    name: 'new-dependency',
    type: 'registry:component',
    title: 'New dependency',
    description: 'Newly required component.',
    verification: ['visual'],
    files: [{
      path: 'foundation/components/NewDependency.vue',
      target: 'app/components/NewDependency.vue',
    }],
  })
  closureChanged.items.find(item => item.name === 'feature').registryDependencies.push('new-dependency')
  await assert.rejects(
    checkConsumer({ registry: closureChanged, repoRoot, consumerRoot }),
    error => (
      error instanceof RegistryError
      && /locked item closure differs/.test(error.message)
      && /locked file closure differs/.test(error.message)
      && /locked item dependencies differ/.test(error.message)
    ),
  )
})

test('lock reader rejects array-shaped item/file maps', async () => {
  const consumerRoot = await mkdtemp(path.join(tmpdir(), 'geist-registry-malformed-lock-'))
  await writeFile(path.join(consumerRoot, 'geist.lock.json'), `${JSON.stringify({
    lockVersion: 1,
    registry: {},
    requestedItems: [],
    items: [],
    files: [],
  })}\n`)
  await assert.rejects(readLock(consumerRoot), /unsupported format/)
})

test('lock reader accepts v1 item records created before packageDependencies', async () => {
  const { repoRoot, consumerRoot, registry } = await fixture()
  const resolution = resolveItems(registry, ['feature'])
  await applyCopyPlan(await planCopy({ registry, resolution, repoRoot, consumerRoot, sourceSha: SOURCE_SHA }))
  const lockPath = path.join(consumerRoot, 'geist.lock.json')
  const lock = JSON.parse(await readFile(lockPath, 'utf8'))
  for (const item of Object.values(lock.items)) delete item.packageDependencies
  await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`)
  assert.ok(await readLock(consumerRoot))
})

test('empty reconcile still rejects a symlinked lock target before writing', async () => {
  const consumerRoot = await mkdtemp(path.join(tmpdir(), 'geist-registry-lock-symlink-'))
  const outsideRoot = await mkdtemp(path.join(tmpdir(), 'geist-registry-lock-outside-'))
  const outsideLock = path.join(outsideRoot, 'geist.lock.json')
  await writeFile(outsideLock, '{}\n')
  await symlink(outsideLock, path.join(consumerRoot, 'geist.lock.json'))

  await assert.rejects(readLock(consumerRoot), /contains a symbolic link/)
  assert.equal(await readFile(outsideLock, 'utf8'), '{}\n')
})

test('update removes stale managed files but refuses to remove locally modified stale files', async () => {
  const { repoRoot, consumerRoot, registry } = await fixture()
  const resolution = resolveItems(registry, ['feature'])
  await applyCopyPlan(await planCopy({ registry, resolution, repoRoot, consumerRoot, sourceSha: SOURCE_SHA }))

  const withoutDependency = structuredClone(registry)
  withoutDependency.items = [withoutDependency.items.find(item => item.name === 'feature')]
  withoutDependency.items[0].registryDependencies = []
  withoutDependency.items[0].files[0].path = 'foundation/components/Feature.vue'
  const stalePlan = await planCopy({
    registry: withoutDependency,
    resolution: resolveItems(withoutDependency, ['feature']),
    repoRoot,
    consumerRoot,
    sourceSha: SOURCE_SHA,
    update: true,
  })
  assert.equal(stalePlan.operations.find(operation => operation.target.endsWith('Dependency.vue')).action, 'delete')

  await writeFile(path.join(consumerRoot, 'app/components/Dependency.vue'), '<template>local edit</template>\n')
  await assert.rejects(
    planCopy({
      registry: withoutDependency,
      resolution: resolveItems(withoutDependency, ['feature']),
      repoRoot,
      consumerRoot,
      sourceSha: SOURCE_SHA,
      update: true,
    }),
    /conflicting target/,
  )

  // Restoring the managed content allows the stale file and lock record to be pruned.
  await writeFile(path.join(consumerRoot, 'app/components/Dependency.vue'), '<template><span>dependency</span></template>\n')
  const cleanPlan = await planCopy({
    registry: withoutDependency,
    resolution: resolveItems(withoutDependency, ['feature']),
    repoRoot,
    consumerRoot,
    sourceSha: SOURCE_SHA,
    update: true,
  })
  const updatedLock = await applyCopyPlan(cleanPlan)
  assert.equal(updatedLock.files['app/components/Dependency.vue'], undefined)
  assert.equal(updatedLock.items.dependency, undefined)
  await assert.rejects(readFile(path.join(consumerRoot, 'app/components/Dependency.vue')), /ENOENT/)
})
