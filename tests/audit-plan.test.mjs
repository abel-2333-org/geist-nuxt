import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  AuditError,
  LEDGER_VERSION,
  assertLedgerV2,
  assertPlanBaseSha,
  assertRecordBaseSha,
  buildGraph,
  computeGitScopeDigest,
  computeScopeDigest,
  emptyEntry,
  findingId,
  itemsWithOpenFindings,
  loadLedger,
  migrateLedgerV1,
  planNext,
  priorityBacklogOf,
  recordResults,
  registryItemDigest,
  resolveScope,
  verifyLedger,
  writeLedgerAtomic,
} from '../scripts/lib/audit.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const cliPath = path.resolve(here, '../scripts/audit-plan.mjs')
const SHA1_RE = /^[0-9a-f]{40}$/

const FIXTURE_REGISTRY = {
  schemaVersion: 1,
  name: 'fixture',
  repository: 'fixture',
  compatibility: { nuxt: '*', nuxtUi: '*', tailwindcss: '*' },
  externalRequirements: { packages: { '@nuxt/ui': '*', '@vueuse/core': '*' } },
  items: [
    { name: 'geist-foundation', type: 'registry:style', title: 'Base', description: 'base', files: [{ path: 'foundation/base.css', target: 'foundation/base.css' }] },
    { name: 'comp-a', type: 'registry:component', title: 'A', description: 'a', files: [{ path: 'foundation/components/A.vue', target: 'foundation/components/A.vue' }], registryDependencies: ['geist-foundation'] },
    { name: 'comp-b', type: 'registry:component', title: 'B', description: 'b', files: [{ path: 'foundation/components/B.vue', target: 'foundation/components/B.vue' }], registryDependencies: ['comp-a'] },
    { name: 'comp-c', type: 'registry:component', title: 'C', description: 'c', files: [{ path: 'foundation/components/C.vue', target: 'foundation/components/C.vue' }], registryDependencies: ['geist-foundation'] },
    { name: 'comp-d', type: 'registry:component', title: 'D', description: 'd', files: [{ path: 'foundation/components/D.vue', target: 'foundation/components/D.vue' }], registryDependencies: ['comp-c'] },
  ],
}

function auditedEntry(overrides = {}) {
  return {
    ...emptyEntry(),
    round: 1,
    lastAuditedAt: '2026-07-28T00:00:00.000Z',
    change: 'none',
    status: 'verified',
    evidence: { kind: 'legacy-v1', sha: null },
    ...overrides,
  }
}

function v2Ledger(overrides = {}) {
  const items = Object.fromEntries(['comp-a', 'comp-b', 'comp-c', 'comp-d'].map(name => [name, emptyEntry()]))
  return { version: LEDGER_VERSION, round: 1, lastRunAt: null, lastPicked: [], items, ...overrides }
}

async function fixtureRepo(t, { git = false, ledger = v2Ledger() } = {}) {
  const repoRoot = await mkdtemp(path.join(tmpdir(), 'geist-audit-'))
  t.after(() => rm(repoRoot, { recursive: true, force: true }))
  await mkdir(path.join(repoRoot, 'foundation/components'), { recursive: true })
  await mkdir(path.join(repoRoot, 'tests/component'), { recursive: true })
  await mkdir(path.join(repoRoot, 'docs/maintenance/component-audit'), { recursive: true })
  await writeFile(path.join(repoRoot, 'foundation/base.css'), ':root {}\n')
  for (const name of ['A', 'B', 'C', 'D']) {
    await writeFile(path.join(repoRoot, `foundation/components/${name}.vue`), `<template><span>${name}</span></template>\n`)
  }
  await writeFile(path.join(repoRoot, 'tests/component/a.spec.ts'), 'export {}\n')
  await writeFile(path.join(repoRoot, 'registry.json'), `${JSON.stringify(FIXTURE_REGISTRY, null, 2)}\n`)
  await writeFile(path.join(repoRoot, '.gitignore'), '*.lock.owner-*\n')
  const ledgerPath = path.join(repoRoot, 'docs/maintenance/component-audit/ledger.json')
  await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`)

  if (!git) return { repoRoot, ledgerPath }
  const run = (...args) => execFileSync('git', ['-c', 'user.email=audit@test', '-c', 'user.name=audit', '-c', 'commit.gpgsign=false', ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  run('init', '-q')
  run('add', '-A')
  run('commit', '-q', '-m', 'base')
  const baseSha = run('rev-parse', 'HEAD').trim()
  run('update-ref', 'refs/remotes/origin/main', baseSha)
  return { repoRoot, ledgerPath, baseSha, run }
}

async function graphFor(repoRoot, registry = FIXTURE_REGISTRY) {
  return buildGraph(registry, repoRoot)
}

test('v1 迁移保留 legacy provenance,并由 open finding 决定 deferred', () => {
  const sha = 'c5a73094643e378d75a84a64bbb36f53dca2771c'
  const v1 = {
    version: 1,
    round: 2,
    lastRunAt: '2026-07-28T16:29:35.909Z',
    lastPicked: ['comp-a'],
    items: {
      'comp-a': { round: 2, lastAuditedAt: 't', lastAuditedSha: sha, verdict: 'improved', notes: 'n', openFindings: ['反例一'] },
      'comp-b': { round: 1, lastAuditedAt: 't', lastAuditedSha: null, verdict: 'clean', notes: null, openFindings: [] },
      'comp-c': { round: 1, lastAuditedAt: 't', lastAuditedSha: null, verdict: 'deferred', notes: null, openFindings: ['待办'] },
      'comp-d': { round: 0, lastAuditedAt: null, lastAuditedSha: null, verdict: null, notes: null, openFindings: [] },
    },
  }
  const migrated = migrateLedgerV1(v1)
  assert.deepEqual(
    ['comp-a', 'comp-b', 'comp-c', 'comp-d'].map(name => [migrated.items[name].change, migrated.items[name].status]),
    [['modified', 'deferred'], ['none', 'verified'], ['none', 'deferred'], [null, null]],
  )
  assert.deepEqual(migrated.items['comp-a'].evidence, { kind: 'legacy-v1', sha })
  assert.equal(migrated.items['comp-a'].findings[0].id, findingId('comp-a', '反例一'))
  assert.deepEqual(migrateLedgerV1(v1), migrated)
})

test('v1 迁移拒绝未知 verdict 与损坏 finding', () => {
  assert.throws(() => migrateLedgerV1({ version: 1, round: 1, items: { x: { verdict: 'wat' } } }), AuditError)
  assert.throws(() => migrateLedgerV1({ version: 1, round: 1, items: { x: { verdict: 'clean', openFindings: [42] } } }), AuditError)
})

test('ledger 状态机拒绝 verified+open、deferred 无 open、重复 finding 与空 scope', () => {
  const base = v2Ledger()
  base.items['comp-a'] = auditedEntry({
    findings: [{ id: 'f-1', severity: 'low', claim: null, evidence: 'x', disposition: 'open' }],
  })
  assert.throws(() => assertLedgerV2(base), /verified 但仍有 open/)

  const noOpen = v2Ledger()
  noOpen.items['comp-a'] = auditedEntry({ status: 'deferred' })
  assert.throws(() => assertLedgerV2(noOpen), /没有 open/)

  const duplicate = v2Ledger()
  duplicate.items['comp-a'] = auditedEntry({
    status: 'deferred',
    findings: [
      { id: 'f-1', severity: 'low', claim: null, evidence: 'x', disposition: 'open' },
      { id: 'f-1', severity: 'low', claim: null, evidence: 'x', disposition: 'open' },
    ],
  })
  assert.throws(() => assertLedgerV2(duplicate), /重复/)

  const emptyScope = v2Ledger()
  emptyScope.items['comp-a'] = auditedEntry({
    evidence: {
      kind: 'scope-v1',
      baseSha: 'a'.repeat(40),
      headSha: 'b'.repeat(40),
      itemDigest: 'c'.repeat(64),
      scope: [],
      scopeDigest: 'd'.repeat(64),
    },
  })
  assert.throws(() => assertLedgerV2(emptyScope), /非空/)
})

test('loadLedger 对缺失、损坏和未知版本 fail closed', async (t) => {
  const { repoRoot, ledgerPath } = await fixtureRepo(t)
  const graph = await graphFor(repoRoot)
  await rm(ledgerPath)
  await assert.rejects(loadLedger(ledgerPath, graph), AuditError)
  await writeFile(ledgerPath, '{oops')
  await assert.rejects(loadLedger(ledgerPath, graph), AuditError)
  await writeFile(ledgerPath, JSON.stringify({ version: 99 }))
  await assert.rejects(loadLedger(ledgerPath, graph), AuditError)
})

test('planNext 让 open finding 重回 pool,critical/high 优先', async (t) => {
  const { repoRoot } = await fixtureRepo(t)
  const graph = await graphFor(repoRoot)
  const ledger = v2Ledger()
  for (const name of graph.components) ledger.items[name] = auditedEntry()
  ledger.items['comp-d'] = auditedEntry({
    status: 'deferred',
    findings: [{ id: 'f-1', severity: 'critical', claim: null, evidence: '崩溃', disposition: 'open' }],
  })
  assert.deepEqual(itemsWithOpenFindings(graph, ledger), ['comp-d'])
  assert.deepEqual(priorityBacklogOf(graph, ledger), ['comp-d'])
  assert.equal(planNext(graph, ledger).picked[0], 'comp-d')
})

test('planNext 不会因 LOC 预算跳过第二个 high finding 去填普通组件', async (t) => {
  const { repoRoot } = await fixtureRepo(t)
  const graph = await graphFor(repoRoot)
  graph.loc.set('comp-a', 700)
  graph.loc.set('comp-b', 700)
  const ledger = v2Ledger()
  for (const name of ['comp-a', 'comp-b']) {
    ledger.items[name] = auditedEntry({
      status: 'deferred',
      findings: [{ id: `f-${name}`, severity: 'high', claim: null, evidence: name, disposition: 'open' }],
    })
  }
  const plan = planNext(graph, ledger)
  assert.equal(plan.picked.length, 1)
  assert.ok(['comp-a', 'comp-b'].includes(plan.picked[0]))
  assert.equal(plan.picked.some(name => name === 'comp-c' || name === 'comp-d'), false)
})

test('resolveScope 规范化去重并拒绝簿记与越界', () => {
  const item = FIXTURE_REGISTRY.items.find(entry => entry.name === 'comp-a')
  assert.deepEqual(resolveScope(item, ['tests/component/a.spec.ts', 'foundation/components/A.vue']), [
    'foundation/components/A.vue',
    'tests/component/a.spec.ts',
  ])
  assert.throws(() => resolveScope(item, ['docs/maintenance/component-audit/ledger.json']), /自引用/)
  assert.throws(() => resolveScope(item, ['../outside.md']), AuditError)
  assert.throws(() => resolveScope(item, ['/etc/passwd']), AuditError)
})

test('scope digest 内容敏感且拒绝 symlink;Git digest 固定到提交', async (t) => {
  const { repoRoot, run } = await fixtureRepo(t, { git: true })
  const scope = ['foundation/components/A.vue', 'tests/component/a.spec.ts']
  const head = run('rev-parse', 'HEAD').trim()
  const gitDigest = computeGitScopeDigest(repoRoot, head, scope)
  assert.equal(gitDigest, await computeScopeDigest(repoRoot, scope))

  await writeFile(path.join(repoRoot, 'foundation/components/A.vue'), 'changed\n')
  assert.notEqual(gitDigest, await computeScopeDigest(repoRoot, scope))
  assert.equal(gitDigest, computeGitScopeDigest(repoRoot, head, scope))

  await rm(path.join(repoRoot, 'tests/component/a.spec.ts'))
  await symlink('/etc/hosts', path.join(repoRoot, 'tests/component/a.spec.ts'))
  await assert.rejects(computeScopeDigest(repoRoot, scope), /普通文件/)
  run('add', '-A')
  run('commit', '-q', '-m', 'symlink')
  const symlinkHead = run('rev-parse', 'HEAD').trim()
  assert.throws(() => computeGitScopeDigest(repoRoot, symlinkHead, scope), /只允许普通文件/)
})

test('base 锚定实时 origin/main,record 锚定 audit 分支精确分叉点', async (t) => {
  const { repoRoot, baseSha, run } = await fixtureRepo(t, { git: true })
  assert.equal(assertPlanBaseSha(repoRoot, baseSha), baseSha)
  await writeFile(path.join(repoRoot, 'remote.txt'), 'remote\n')
  run('add', '-A')
  run('commit', '-q', '-m', 'remote')
  const remoteSha = run('rev-parse', 'HEAD').trim()
  run('update-ref', 'refs/remotes/origin/main', remoteSha)
  await writeFile(path.join(repoRoot, 'branch.txt'), 'branch\n')
  run('add', '-A')
  run('commit', '-q', '-m', 'branch')
  assert.throws(() => assertPlanBaseSha(repoRoot, baseSha), /不是实时 origin\/main/)
  assert.throws(() => assertRecordBaseSha(repoRoot, baseSha), /不是当前 audit 分支/)
  assert.equal(assertRecordBaseSha(repoRoot, remoteSha), remoteSha)
})

async function recordFixture(t, existingFinding = null) {
  const ledger = v2Ledger()
  ledger.items['comp-c'] = auditedEntry()
  ledger.items['comp-d'] = auditedEntry()
  if (existingFinding) {
    ledger.items['comp-a'] = auditedEntry({
      status: 'deferred',
      findings: [existingFinding],
    })
  }
  const fixture = await fixtureRepo(t, { git: true, ledger })
  await writeFile(path.join(fixture.repoRoot, 'foundation/components/A.vue'), '<template><span>A2</span></template>\n')
  fixture.run('add', '-A')
  fixture.run('commit', '-q', '-m', 'work')
  const graph = await graphFor(fixture.repoRoot)
  const loaded = await loadLedger(fixture.ledgerPath, graph)
  return {
    ...fixture,
    graph,
    ledger: loaded.ledger,
    raw: loaded.raw,
    planGraph: graph,
    planLedger: structuredClone(loaded.ledger),
    baseLedgerRaw: loaded.raw,
  }
}

function resultFor(item, overrides = {}) {
  return { item, change: 'none', status: 'verified', notes: null, scope: [], findings: [], ...overrides }
}

test('recordResults 从 base 计划记账,证据绑定 Git HEAD、item 与 scope', async (t) => {
  const state = await recordFixture(t)
  const results = [
    resultFor('comp-a', { change: 'modified', scope: ['tests/component/a.spec.ts'] }),
    resultFor('comp-b'),
  ]
  const outcome = await recordResults({
    repoRoot: state.repoRoot,
    ledgerPath: state.ledgerPath,
    graph: state.graph,
    ledger: state.ledger,
    rawLedger: state.raw,
    planGraph: state.planGraph,
    planLedger: state.planLedger,
    baseLedgerRaw: state.baseLedgerRaw,
    results,
    baseSha: state.baseSha,
    now: '2026-07-29T00:00:00.000Z',
  })
  assert.match(outcome.headSha, SHA1_RE)
  const persisted = JSON.parse(await readFile(state.ledgerPath, 'utf8'))
  const evidence = persisted.items['comp-a'].evidence
  assert.equal(evidence.kind, 'scope-v1')
  assert.equal(evidence.baseSha, state.baseSha)
  assert.equal(evidence.headSha, outcome.headSha)
  assert.equal(evidence.itemDigest, registryItemDigest(state.graph.byName.get('comp-a')))
  assert.equal(evidence.scopeDigest, computeGitScopeDigest(state.repoRoot, outcome.headSha, evidence.scope))
})

test('recordResults 拒绝脏工作区、计划集合漂移与非祖先 base', async (t) => {
  const dirty = await recordFixture(t)
  await writeFile(path.join(dirty.repoRoot, 'uncommitted.txt'), 'x')
  const args = {
    repoRoot: dirty.repoRoot,
    ledgerPath: dirty.ledgerPath,
    graph: dirty.graph,
    ledger: dirty.ledger,
    rawLedger: dirty.raw,
    planGraph: dirty.planGraph,
    planLedger: dirty.planLedger,
    baseLedgerRaw: dirty.baseLedgerRaw,
    results: [resultFor('comp-a'), resultFor('comp-b')],
    baseSha: dirty.baseSha,
  }
  await assert.rejects(recordResults(args), /工作区不干净/)
  await rm(path.join(dirty.repoRoot, 'uncommitted.txt'))
  await assert.rejects(recordResults({ ...args, results: [resultFor('comp-a')] }), /当日计划一致/)
  await assert.rejects(recordResults({ ...args, baseSha: 'a'.repeat(40) }), /不是当前 HEAD 的祖先/)
})

test('recordResults 不允许静默删除 open finding,关闭必须显式,wont-fix 需授权', async (t) => {
  const finding = { id: 'f-existing', severity: 'high', claim: null, evidence: '390px 溢出', disposition: 'open' }
  const state = await recordFixture(t, finding)
  const base = {
    repoRoot: state.repoRoot,
    ledgerPath: state.ledgerPath,
    graph: state.graph,
    ledger: state.ledger,
    rawLedger: state.raw,
    planGraph: state.planGraph,
    planLedger: state.planLedger,
    baseLedgerRaw: state.baseLedgerRaw,
    baseSha: state.baseSha,
  }
  await assert.rejects(recordResults({
    ...base,
    results: [resultFor('comp-a'), resultFor('comp-b')],
  }), /不得省略既有 open/)
  await assert.rejects(recordResults({
    ...base,
    results: [
      resultFor('comp-a', { findings: [{ ...finding, disposition: 'wont-fix' }] }),
      resultFor('comp-b'),
    ],
  }), /人工明确授权/)
  await recordResults({
    ...base,
    results: [
      resultFor('comp-a', { findings: [{ ...finding, disposition: 'resolved' }] }),
      resultFor('comp-b'),
    ],
  })
  const persisted = JSON.parse(await readFile(state.ledgerPath, 'utf8'))
  assert.equal(persisted.items['comp-a'].findings[0].disposition, 'resolved')
})

test('recordResults 拒绝 verified+open、deferred 无 open与新建 closed finding', async (t) => {
  const state = await recordFixture(t)
  const base = {
    repoRoot: state.repoRoot,
    ledgerPath: state.ledgerPath,
    graph: state.graph,
    ledger: state.ledger,
    rawLedger: state.raw,
    planGraph: state.planGraph,
    planLedger: state.planLedger,
    baseLedgerRaw: state.baseLedgerRaw,
    baseSha: state.baseSha,
  }
  await assert.rejects(recordResults({
    ...base,
    results: [resultFor('comp-a', {
      findings: [{ severity: 'low', evidence: 'x', disposition: 'open' }],
    }), resultFor('comp-b')],
  }), /verified 却仍有 open/)
  await assert.rejects(recordResults({
    ...base,
    results: [resultFor('comp-a', { status: 'deferred' }), resultFor('comp-b')],
  }), /没有任何 open/)
  await assert.rejects(recordResults({
    ...base,
    results: [resultFor('comp-a', {
      findings: [{ severity: 'low', evidence: 'x', disposition: 'resolved' }],
    }), resultFor('comp-b')],
  }), /新 finding/)
  await assert.rejects(recordResults({
    ...base,
    results: [
      resultFor('comp-a', { change: 'modified' }),
      resultFor('comp-b', { change: 'modified' }),
    ],
  }), /comp-b 标记 modified/)
})

test('writeLedgerAtomic 原子发布完整 owner,不自动回收残留锁并保留较新状态', async (t) => {
  const { ledgerPath, run } = await fixtureRepo(t, { git: true })
  const raw = await readFile(ledgerPath, 'utf8')
  await writeFile(`${ledgerPath}.lock`, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString(), token: 'live' }))
  await assert.rejects(writeLedgerAtomic(ledgerPath, v2Ledger(), raw), /拒绝自动回收/)
  await rm(`${ledgerPath}.lock`)
  await writeFile(`${ledgerPath}.lock`, JSON.stringify({ pid: 2147483647, startedAt: '2026-01-01T00:00:00.000Z', token: 'dead' }))
  await assert.rejects(writeLedgerAtomic(ledgerPath, v2Ledger(), raw), /拒绝自动回收/)
  await rm(`${ledgerPath}.lock`)
  await writeLedgerAtomic(ledgerPath, v2Ledger(), raw)
  assert.equal(await readFile(`${ledgerPath}.lock`, 'utf8').catch(error => error.code), 'ENOENT')
  const migratedRaw = await readFile(ledgerPath, 'utf8')
  await writeFile(ledgerPath, `${raw}\n`)
  await assert.rejects(writeLedgerAtomic(ledgerPath, v2Ledger(), migratedRaw), /并发修改/)
  const residue = 'docs/maintenance/component-audit/ledger.json.lock.owner-crash'
  assert.equal(run('check-ignore', residue).trim(), residue)
})

function exactEvidence(repoRoot, graph, name, baseSha, headSha, scope) {
  return {
    kind: 'scope-v1',
    baseSha,
    headSha,
    itemDigest: registryItemDigest(graph.byName.get(name)),
    scope,
    scopeDigest: computeGitScopeDigest(repoRoot, headSha, scope),
  }
}

test('verifyLedger 同时校验 scope 内容与 registry item 拓扑', async (t) => {
  const { repoRoot, baseSha, run } = await fixtureRepo(t, { git: true })
  const graph = await graphFor(repoRoot)
  const ledger = v2Ledger()
  ledger.items['comp-a'] = auditedEntry({
    evidence: exactEvidence(repoRoot, graph, 'comp-a', baseSha, baseSha, ['foundation/components/A.vue']),
  })
  ledger.items['comp-b'] = auditedEntry({
    evidence: exactEvidence(repoRoot, graph, 'comp-b', baseSha, baseSha, ['foundation/components/B.vue']),
  })
  ledger.items['comp-c'] = auditedEntry()
  ledger.items['comp-d'] = auditedEntry({
    status: 'deferred',
    findings: [{ id: 'f-3', severity: 'low', claim: null, evidence: 'x', disposition: 'open' }],
  })

  await writeFile(path.join(repoRoot, 'foundation/components/B.vue'), 'drift\n')
  const topologyChanged = structuredClone(FIXTURE_REGISTRY)
  topologyChanged.items.find(item => item.name === 'comp-a').registryDependencies = []
  const changedGraph = await graphFor(repoRoot, topologyChanged)
  const report = await verifyLedger({ repoRoot, ledger, graph: changedGraph })
  assert.deepEqual(report.stale.map(item => item.name), ['comp-a', 'comp-b'])
  assert.deepEqual(report.legacy, ['comp-c'])
  assert.deepEqual(report.deferred, [{ name: 'comp-d', openFindings: 1 }])
  assert.equal(run('status', '--porcelain').includes('foundation/components/B.vue'), true)
})

test('verifyLedger 把 registry 删除或改名判为 stale,包括 deferred 条目', async (t) => {
  const { repoRoot, baseSha } = await fixtureRepo(t, { git: true })
  const graph = await graphFor(repoRoot)
  const ledger = v2Ledger()
  ledger.items['comp-a'] = auditedEntry({
    status: 'deferred',
    evidence: exactEvidence(repoRoot, graph, 'comp-a', baseSha, baseSha, ['foundation/components/A.vue']),
    findings: [{ id: 'f-1', severity: 'low', claim: null, evidence: 'x', disposition: 'open' }],
  })
  const deleted = structuredClone(FIXTURE_REGISTRY)
  deleted.items = deleted.items.filter(item => item.name !== 'comp-a')
  const report = await verifyLedger({ repoRoot, ledger, graph: await graphFor(repoRoot, deleted) })
  assert.match(report.stale[0].reason, /删除、改名/)
})

test('CLI 对未知参数和混合模式 fail closed', () => {
  const unknown = spawnSync(process.execPath, [cliPath, '--definitely-unknown'], { encoding: 'utf8' })
  assert.notEqual(unknown.status, 0)
  assert.match(unknown.stderr, /参数错误/)
  const mixed = spawnSync(process.execPath, [cliPath, '--verify', '--migrate'], { encoding: 'utf8' })
  assert.notEqual(mixed.status, 0)
  assert.match(mixed.stderr, /不能组合/)
  const duplicate = spawnSync(process.execPath, [cliPath, '--json', '--json'], { encoding: 'utf8' })
  assert.notEqual(duplicate.status, 0)
  assert.match(duplicate.stderr, /不可重复/)
})
