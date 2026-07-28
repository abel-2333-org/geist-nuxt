#!/usr/bin/env node
// 组件审计排程：从 registry 依赖图 + ledger 推导「今天审计哪一簇组件」。
//
//   node scripts/audit-plan.mjs            打印今天的计划
//   node scripts/audit-plan.mjs --json     机器可读计划
//   node scripts/audit-plan.mjs --record <result.json>
//                                          把一次审计结果写回 ledger
//
// 选簇保证连贯性：seed 优先取与「上次审计集合」关系最紧的未审计组件，
// 再沿依赖图扩张，使相邻组件落在相邻的日子里。
import fs from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { loadRegistry } from './lib/registry.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ledgerPath = path.join(repoRoot, 'docs/maintenance/component-audit/ledger.json')

// —— 可调策略常量 ——
const TARGET_SIZE = 3 // 一天最多审计的组件数
const MIN_SIZE = 2 // 一天期望的下限；本轮余量不足时可低于它
const LOC_BUDGET = 1100 // 一天的源码总行数预算，超了就少取一个
const HUB_DEGREE = 6 // 被超过这么多 item 依赖的 item 视为 hub，不产生兄弟关系边
const SCORE_DIRECT = 3 // A 直接依赖 B（或反向）
const SCORE_SIBLING = 2 // A、B 共享同一个非 hub 依赖，每个共享依赖计一次，最多计 2 个
const SCORE_NAMESPACE = 1 // 同命名空间（foundation-* / api-docs-*）

const LEDGER_VERSION = 1

function namespaceOf(name) {
  return name.startsWith('api-docs-') ? 'api-docs' : 'foundation'
}

function headSha() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim()
  }
  catch {
    return null
  }
}

async function countLines(relativePath) {
  try {
    const content = await fs.readFile(path.join(repoRoot, relativePath), 'utf8')
    return content.split('\n').length
  }
  catch {
    return 0
  }
}

async function buildGraph(registry) {
  const byName = new Map(registry.items.map(item => [item.name, item]))
  const deps = new Map(registry.items.map(item => [item.name, new Set(item.registryDependencies ?? [])]))

  const dependedBy = new Map(registry.items.map(item => [item.name, new Set()]))
  for (const [name, set] of deps) {
    for (const dep of set) dependedBy.get(dep)?.add(name)
  }

  const hubs = new Set([...dependedBy].filter(([, set]) => set.size > HUB_DEGREE).map(([name]) => name))

  const components = registry.items.filter(item => item.type === 'registry:component').map(item => item.name)

  const loc = new Map()
  const fileLoc = new Map()
  for (const name of components) {
    const files = byName.get(name).files ?? []
    let total = 0
    for (const file of files) {
      const lines = await countLines(file.path)
      fileLoc.set(file.path, lines)
      total += lines
    }
    loc.set(name, total)
  }

  return { byName, deps, dependedBy, hubs, components, loc, fileLoc }
}

function relationScore(graph, a, b) {
  // 轮次翻转那天 lastPicked 会重新落回 pool，这里必须返回同形状的对象
  if (a === b) return { score: 0, reasons: [] }
  const depsA = graph.deps.get(a) ?? new Set()
  const depsB = graph.deps.get(b) ?? new Set()
  let score = 0
  const reasons = []

  if (depsA.has(b)) {
    score += SCORE_DIRECT
    reasons.push(`${a} 直接依赖 ${b}`)
  }
  if (depsB.has(a)) {
    score += SCORE_DIRECT
    reasons.push(`${b} 直接依赖 ${a}`)
  }

  const shared = [...depsA].filter(dep => depsB.has(dep) && !graph.hubs.has(dep))
  if (shared.length > 0) {
    score += SCORE_SIBLING * Math.min(shared.length, 2)
    reasons.push(`共享依赖 ${shared.slice(0, 3).join('、')}`)
  }

  if (namespaceOf(a) === namespaceOf(b)) score += SCORE_NAMESPACE

  return { score, reasons }
}

function scoreAgainstSet(graph, candidate, set) {
  let score = 0
  const reasons = []
  for (const other of set) {
    const relation = relationScore(graph, candidate, other)
    score += relation.score
    reasons.push(...relation.reasons)
  }
  return { score, reasons }
}

function compareCandidates(graph, a, b) {
  // 分数 → 被依赖数（改动收益面）→ 行数（复杂度）→ 名字（稳定排序）
  if (b.score !== a.score) return b.score - a.score
  const depsA = graph.dependedBy.get(a.name)?.size ?? 0
  const depsB = graph.dependedBy.get(b.name)?.size ?? 0
  if (depsB !== depsA) return depsB - depsA
  const locA = graph.loc.get(a.name) ?? 0
  const locB = graph.loc.get(b.name) ?? 0
  if (locB !== locA) return locB - locA
  return a.name.localeCompare(b.name)
}

async function loadLedger(graph) {
  let ledger
  try {
    ledger = JSON.parse(await fs.readFile(ledgerPath, 'utf8'))
  }
  catch {
    ledger = { version: LEDGER_VERSION, round: 1, lastRunAt: null, lastPicked: [], items: {} }
  }
  // registry 新增组件时自动补进 ledger，视为本轮未审计
  for (const name of graph.components) {
    ledger.items[name] ??= { round: 0, lastAuditedAt: null, lastAuditedSha: null, verdict: null, notes: null, openFindings: [] }
  }
  return ledger
}

function planNext(graph, ledger) {
  let round = ledger.round
  let pool = graph.components.filter(name => (ledger.items[name]?.round ?? 0) < round)
  let roundRollover = false

  if (pool.length === 0) {
    round += 1
    roundRollover = true
    pool = [...graph.components]
  }

  const seedFrom = (ledger.lastPicked ?? []).filter(name => graph.components.includes(name))
  const picked = []
  const rationale = new Map()

  // 1) seed：优先接续上次审计的簇
  const seedRanked = pool
    .map((name) => {
      const { score, reasons } = seedFrom.length > 0
        ? scoreAgainstSet(graph, name, seedFrom)
        : { score: 0, reasons: [] }
      return { name, score, reasons }
    })
    .sort((a, b) => compareCandidates(graph, a, b))

  const seed = seedRanked[0]
  picked.push(seed.name)
  rationale.set(
    seed.name,
    seed.score > 0
      ? `接续上次审计簇：${seed.reasons.join('；')}`
      : seedFrom.length > 0
        ? '与上次审计簇无依赖关联，改取被依赖最多的未审计组件'
        : '冷启动：取被依赖最多的组件，改动收益面最大',
  )

  // 2) 沿依赖图扩张，直到数量或行数预算触顶
  let loc = graph.loc.get(seed.name) ?? 0
  while (picked.length < TARGET_SIZE) {
    const remaining = pool.filter(name => !picked.includes(name))
    if (remaining.length === 0) break

    const ranked = remaining
      .map((name) => {
        const { score, reasons } = scoreAgainstSet(graph, name, picked)
        return { name, score, reasons }
      })
      .sort((a, b) => compareCandidates(graph, a, b))

    const next = ranked[0]
    const nextLoc = graph.loc.get(next.name) ?? 0
    if (picked.length >= MIN_SIZE && loc + nextLoc > LOC_BUDGET) break

    picked.push(next.name)
    loc += nextLoc
    rationale.set(next.name, next.score > 0 ? next.reasons.join('；') : '本轮余量中依赖关系最近的组件')
  }

  // 不留孤儿：若取完这批后本轮只剩 1 个组件，就把它并进来，避免出现单组件低价值日
  const orphans = pool.filter(name => !picked.includes(name))
  if (orphans.length === 1) {
    const [orphan] = orphans
    picked.push(orphan)
    loc += graph.loc.get(orphan) ?? 0
    rationale.set(orphan, '本轮最后一个组件，并入本批避免单组件日')
  }

  return { round, roundRollover, picked, rationale, loc, poolSize: pool.length }
}

function describe(graph, ledger, plan) {
  return {
    round: plan.round,
    // record() 会在本轮清空时就推进 round，所以「新一轮」以池子是否满员为准
    roundRollover: plan.roundRollover || (plan.poolSize === graph.components.length && (ledger.lastPicked ?? []).length > 0),
    remainingInRound: plan.poolSize - plan.picked.length,
    totalComponents: graph.components.length,
    totalLoc: plan.loc,
    previous: ledger.lastPicked ?? [],
    items: plan.picked.map((name) => {
      const item = graph.byName.get(name)
      return {
        name,
        title: item.title,
        description: item.description,
        why: plan.rationale.get(name),
        loc: graph.loc.get(name),
        files: (item.files ?? []).map(file => ({ path: file.path, target: file.target, loc: graph.fileLoc.get(file.path) ?? 0 })),
        dependsOn: [...(graph.deps.get(name) ?? [])],
        dependedBy: [...(graph.dependedBy.get(name) ?? [])],
        lastAuditedAt: ledger.items[name]?.lastAuditedAt ?? null,
        openFindings: ledger.items[name]?.openFindings ?? [],
      }
    }),
  }
}

function printPlan(report) {
  console.log(`第 ${report.round} 轮${report.roundRollover ? '（新一轮开始）' : ''} · 共 ${report.totalComponents} 个分发组件 · 本轮剩余 ${report.remainingInRound} 个`)
  if (report.previous.length > 0) console.log(`上次审计：${report.previous.join('、')}`)
  console.log(`\n今天审计 ${report.items.length} 个组件（合计 ${report.totalLoc} 行）：\n`)
  for (const item of report.items) {
    console.log(`▸ ${item.name} — ${item.title}`)
    console.log(`  选取理由：${item.why}`)
    console.log(`  源码：${item.files.map(f => f.path).join('、')}`)
    if (item.dependsOn.length > 0) console.log(`  依赖：${item.dependsOn.join('、')}`)
    if (item.dependedBy.length > 0) console.log(`  被依赖：${item.dependedBy.join('、')}（改 API 需同步评估）`)
    console.log(`  上次审计：${item.lastAuditedAt ?? '从未'}`)
    if (item.openFindings.length > 0) console.log(`  遗留待办：${item.openFindings.join('；')}`)
    console.log()
  }
}

async function record(graph, ledger, resultPath) {
  const results = JSON.parse(await fs.readFile(path.resolve(resultPath), 'utf8'))
  if (!Array.isArray(results)) throw new Error('record 文件必须是数组：[{ item, verdict, notes?, openFindings? }]')

  const sha = headSha()
  const now = new Date().toISOString()
  const picked = []

  for (const result of results) {
    const name = result.item
    if (!graph.components.includes(name)) throw new Error(`未知组件：${name}`)
    if (!['clean', 'improved', 'deferred'].includes(result.verdict)) {
      throw new Error(`${name} 的 verdict 必须是 clean / improved / deferred`)
    }
    ledger.items[name] = {
      round: ledger.round,
      lastAuditedAt: now,
      lastAuditedSha: sha,
      verdict: result.verdict,
      notes: result.notes ?? null,
      openFindings: result.openFindings ?? [],
    }
    picked.push(name)
  }

  // 本轮全部审计完 → 进入下一轮
  const unaudited = graph.components.filter(name => (ledger.items[name]?.round ?? 0) < ledger.round)
  if (unaudited.length === 0) ledger.round += 1

  ledger.version = LEDGER_VERSION
  ledger.lastRunAt = now
  ledger.lastPicked = picked

  await fs.mkdir(path.dirname(ledgerPath), { recursive: true })
  await fs.writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8')
  console.log(`已记录 ${picked.length} 个组件：${picked.join('、')}`)
  console.log(`当前轮次 ${ledger.round}，本轮剩余 ${graph.components.length - graph.components.filter(n => (ledger.items[n]?.round ?? 0) >= ledger.round).length} 个`)
}

const argv = process.argv.slice(2)
const registry = await loadRegistry(path.join(repoRoot, 'registry.json'))
const graph = await buildGraph(registry)
const ledger = await loadLedger(graph)

const recordIndex = argv.indexOf('--record')
if (recordIndex !== -1) {
  const resultPath = argv[recordIndex + 1]
  if (!resultPath) throw new Error('--record 需要一个结果 JSON 文件路径')
  await record(graph, ledger, resultPath)
}
else {
  const plan = planNext(graph, ledger)
  const report = describe(graph, ledger, plan)
  if (argv.includes('--json')) console.log(JSON.stringify(report, null, 2))
  else printPlan(report)
}
