import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises'
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
  resolveCopyRequest,
  resolveItems,
  resolveSourceSha,
  sha256,
  validateRegistry,
} from '../scripts/lib/registry.mjs'

const SOURCE_SHA = '1234567890abcdef1234567890abcdef12345678'
const OTHER_SOURCE_SHA = 'abcdef1234567890abcdef1234567890abcdef12'

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
    registry.items[0].files[0].target = 'app/components/nested/Dependency.vue'
    await assert.rejects(validateRegistry(registry, { repoRoot }), /does not resolve.*after copy/)
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
  assert.deepEqual(lock.registry.compatibility, registry.compatibility)
  assert.deepEqual(lock.registry.externalRequirements, registry.externalRequirements)
  const record = lock.files['app/components/Feature.vue']
  assert.equal(record.sourceSha, SOURCE_SHA)
  assert.equal(record.sourceHash, record.targetHash)
  assert.equal(record.targetHash, sha256(await readFile(path.join(consumerRoot, record.target))))
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
  // The fixture SHA intentionally differs from its non-git source, so only target
  // integrity is checked; real CLI runs always use the checked-out exact SHA.
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

  const closureChanged = structuredClone(registry)
  closureChanged.items.unshift({
    name: 'new-dependency',
    type: 'registry:component',
    title: 'New dependency',
    description: 'Newly required component.',
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
