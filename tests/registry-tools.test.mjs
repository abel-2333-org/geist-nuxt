import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import {
  RegistryError,
  applyCopyPlan,
  assertExactSha,
  assertSafeTarget,
  checkConsumer,
  parseArgs,
  planCopy,
  readLock,
  resolveItems,
  resolveSourceSha,
  sha256,
  validateRegistry,
} from '../scripts/lib/registry.mjs'

const SOURCE_SHA = '1234567890abcdef1234567890abcdef12345678'

test('accepts the pnpm argument separator', () => {
  const options = parseArgs(['--', 'geist-foundation', '--target', '../consumer', '--to', SOURCE_SHA])
  assert.deepEqual(options.items, ['geist-foundation'])
  assert.equal(options.target, '../consumer')
  assert.equal(options.to, SOURCE_SHA)
})

async function fixture() {
  const repoRoot = await mkdtemp(path.join(tmpdir(), 'geist-registry-repo-'))
  const consumerRoot = await mkdtemp(path.join(tmpdir(), 'geist-registry-consumer-'))
  await mkdir(path.join(repoRoot, 'foundation/components'), { recursive: true })
  await writeFile(path.join(repoRoot, 'foundation/components/Dependency.vue'), '<template><span>dependency</span></template>\n')
  await writeFile(path.join(repoRoot, 'foundation/components/Feature.vue'), '<script setup>\nimport Dependency from \'./Dependency.vue\'\n</script>\n<template><Dependency /></template>\n')
  const registry = {
    schemaVersion: 1,
    name: 'fixture',
    repository: 'https://example.test/fixture.git',
    compatibility: { nuxt: '>=4.4.0 <5', nuxtUi: '>=4.9.0 <5', tailwindcss: '>=4.3.0 <5' },
    externalRequirements: {
      packages: { '@nuxt/ui': '^4.9.0', '@vueuse/core': '^14.3.0' },
      consumerSetup: ['Wrap the app in UApp.'],
    },
    sourceRoots: ['foundation/components'],
    items: [
      {
        name: 'dependency',
        type: 'registry:component',
        title: 'Dependency',
        description: 'Dependency component.',
        files: [{ path: 'foundation/components/Dependency.vue', target: 'app/components/Dependency.vue' }],
      },
      {
        name: 'feature',
        type: 'registry:component',
        title: 'Feature',
        description: 'Feature component.',
        registryDependencies: ['dependency'],
        files: [{ path: 'foundation/components/Feature.vue', target: 'app/components/Feature.vue' }],
      },
    ],
  }
  return { repoRoot, consumerRoot, registry }
}

test('validates a complete registry and resolves dependency-first closure', async () => {
  const { repoRoot, registry } = await fixture()
  const result = await validateRegistry(registry, { repoRoot })
  assert.equal(result.sourceOwners.size, 2)
  const resolution = resolveItems(registry, ['feature'])
  assert.deepEqual(resolution.items.map(item => item.name), ['dependency', 'feature'])
  assert.deepEqual(resolution.files.map(file => file.target), ['app/components/Dependency.vue', 'app/components/Feature.vue'])
})

test('rejects undeclared files, duplicate targets, cycles, and undeclared relative imports', async (t) => {
  await t.test('undeclared source file', async () => {
    const { repoRoot, registry } = await fixture()
    await writeFile(path.join(repoRoot, 'foundation/components/Undeclared.vue'), '<template />\n')
    await assert.rejects(validateRegistry(registry, { repoRoot }), /not declared by any item/)
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

  await t.test('missing dependency declaration for a relative import', async () => {
    const { repoRoot, registry } = await fixture()
    registry.items[1].registryDependencies = []
    await assert.rejects(validateRegistry(registry, { repoRoot }), /without declaring a dependency/)
  })
})

test('rejects unsafe paths, protected consumer files, and non-exact SHAs', () => {
  assert.throws(() => assertSafeTarget('../outside.vue'), /escapes/)
  assert.throws(() => assertSafeTarget('/tmp/outside.vue'), /relative/)
  assert.throws(() => assertSafeTarget('node_modules/pkg/index.js'), /dependency directory/)
  assert.throws(() => assertSafeTarget('nuxt.config.ts'), /protected/)
  assert.throws(() => assertSafeTarget('app/app.config.ts'), /protected/)
  assert.throws(() => assertSafeTarget('app/assets/css/main.css'), /protected/)
  assert.throws(() => assertExactSha('main'), /exact 40-character Git SHA/)
  assert.equal(assertExactSha(SOURCE_SHA.toUpperCase()), SOURCE_SHA)
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
  assert.deepEqual(lock.registry.compatibility, registry.compatibility)
  assert.deepEqual(lock.registry.externalRequirements, registry.externalRequirements)
  const record = lock.files['app/components/Feature.vue']
  assert.equal(record.sourceSha, SOURCE_SHA)
  assert.equal(record.sourceHash, record.targetHash)
  assert.equal(record.targetHash, sha256(await readFile(path.join(consumerRoot, record.target))))
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
  // The fixture SHA intentionally differs from its non-git source, so only target
  // integrity is checked; real CLI runs always use the checked-out exact SHA.
  await checkConsumer({ registry, repoRoot, consumerRoot })
  await writeFile(path.join(consumerRoot, 'app/components/Feature.vue'), '<template>drift</template>\n')
  await assert.rejects(checkConsumer({ registry, repoRoot, consumerRoot }), /managed target drifted/)
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
