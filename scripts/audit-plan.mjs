#!/usr/bin/env node
// 组件审计排程 CLI。计划可绑定 main 基线;record 可执行排程或 affected 复审,
// 并只为已经提交的功能快照生成证据。
import fs from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'
import { loadRegistry, validateRegistry } from './lib/registry.mjs'
import {
  AuditError,
  assertPlanBaseSha,
  assertRecordBaseSha,
  buildGraph,
  describe,
  loadLedger,
  loadLedgerAt,
  planNext,
  readGitFile,
  recordResults,
  verifyLedger,
  writeLedgerAtomic,
} from './lib/audit.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ledgerRelativePath = 'docs/maintenance/component-audit/ledger.json'
const ledgerPath = path.join(repoRoot, ledgerRelativePath)

function printPlan(report) {
  console.log(`第 ${report.round} 轮${report.roundRollover ? '(新一轮开始)' : ''} · 共 ${report.totalComponents} 个分发组件 · 本轮剩余 ${report.remainingInRound} 个`)
  if (report.previous.length > 0) console.log(`上次审计:${report.previous.join('、')}`)
  if (report.priorityBacklog.length > 0) console.log(`高优先级 finding 插队:${report.priorityBacklog.join('、')}`)
  else if (report.openFindingReentry.length > 0) console.log(`带 open finding 重回 pool:${report.openFindingReentry.join('、')}`)
  console.log(`\n今天审计 ${report.items.length} 个组件(合计 ${report.totalLoc} 行):\n`)
  for (const item of report.items) {
    console.log(`▸ ${item.name} — ${item.title}`)
    console.log(`  选取理由:${item.why}`)
    console.log(`  源码:${item.files.map(file => file.path).join('、')}`)
    if (item.dependsOn.length > 0) console.log(`  依赖:${item.dependsOn.join('、')}`)
    if (item.dependedBy.length > 0) console.log(`  被依赖:${item.dependedBy.join('、')}(改 API 需同步评估)`)
    console.log(`  上次审计:${item.lastAuditedAt ?? '从未'}`)
    for (const finding of item.openFindings) {
      console.log(`  遗留待办 [${finding.id} · ${finding.severity}]:${finding.evidence}`)
    }
    console.log()
  }
}

function printVerify(report) {
  console.log(`证据成立(在 canonical main 上即 landed):${report.holds.length ? report.holds.join('、') : '无'}`)
  console.log(`legacy(v1 迁移,下次审计补齐):${report.legacy.length ? report.legacy.join('、') : '无'}`)
  console.log(`deferred(仍有未解决 finding):${report.deferred.length ? report.deferred.map(item => `${item.name}(${item.openFindings})`).join('、') : '无'}`)
  console.log(`未审计:${report.unaudited.length} 个`)
  if (report.stale.length > 0) {
    console.error('\n以下 verified 条目的证据已失效,必须重新审计:')
    for (const item of report.stale) console.error(`- ${item.name}:${item.reason}`)
  }
}

function parseCli() {
  let values
  let tokens
  try {
    ({ values, tokens } = parseArgs({
      options: {
        json: { type: 'boolean', default: false },
        verify: { type: 'boolean', default: false },
        migrate: { type: 'boolean', default: false },
        record: { type: 'string' },
        affected: { type: 'boolean', default: false },
        base: { type: 'string' },
        'allow-wont-fix': { type: 'boolean', default: false },
      },
      strict: true,
      allowPositionals: false,
      tokens: true,
    }))
  }
  catch (error) {
    throw new AuditError(`参数错误:${error.message}`)
  }

  const seen = new Set()
  for (const token of tokens.filter(token => token.kind === 'option')) {
    if (seen.has(token.name)) throw new AuditError(`参数不可重复:--${token.name}`)
    seen.add(token.name)
  }
  const modes = [values.verify, values.migrate, values.record !== undefined].filter(Boolean).length
  if (modes > 1) throw new AuditError('--verify、--migrate、--record 不能组合')
  if (values.record === '') throw new AuditError('--record 需要非空文件路径')
  if (values.record !== undefined && !values.base) throw new AuditError('--record 必须携带 --base <审计起点的 origin/main SHA>')
  if (values.affected && values.record === undefined) throw new AuditError('--affected 只适用于 --record')
  if (values.json && (values.migrate || values.record !== undefined)) throw new AuditError('--json 只适用于 plan 或 --verify')
  if (values['allow-wont-fix'] && values.record === undefined) throw new AuditError('--allow-wont-fix 只适用于 --record')
  if (values.base && values.verify) throw new AuditError('--base 不适用于 --verify')
  if (values.base && values.migrate) throw new AuditError('--base 不适用于 --migrate')
  return values
}

async function stateAt(baseSha, assertBase) {
  const base = assertBase(repoRoot, baseSha)
  let registry
  try {
    registry = JSON.parse(readGitFile(repoRoot, base, 'registry.json'))
  }
  catch (error) {
    if (error instanceof AuditError) throw error
    throw new AuditError(`${base} 上的 registry.json 不是合法 JSON:${error.message}`)
  }
  await validateRegistry(registry, { repoRoot, checkFiles: false })
  const graph = await buildGraph(registry, repoRoot, {
    readFile: relative => Promise.resolve(readGitFile(repoRoot, base, relative)),
  })
  const loaded = await loadLedgerAt(repoRoot, base, ledgerRelativePath, graph)
  return { base, registry, graph, ...loaded }
}

try {
  const values = parseCli()
  const registry = await loadRegistry(path.join(repoRoot, 'registry.json'))
  await validateRegistry(registry, { repoRoot, checkFiles: true })
  const graph = await buildGraph(registry, repoRoot)
  const current = await loadLedger(ledgerPath, graph)

  if (values.migrate) {
    await writeLedgerAtomic(ledgerPath, current.ledger, current.raw)
    console.log(`ledger 已迁移为 version ${current.ledger.version},写回:${ledgerPath}`)
  }
  else if (values.record !== undefined) {
    const planState = await stateAt(values.base, assertRecordBaseSha)
    const results = JSON.parse(await fs.readFile(path.resolve(values.record), 'utf8'))
    const outcome = await recordResults({
      repoRoot,
      ledgerPath,
      graph,
      ledger: current.ledger,
      rawLedger: current.raw,
      planGraph: planState.graph,
      planLedger: planState.ledger,
      baseLedgerRaw: planState.raw,
      results,
      baseSha: planState.base,
      affected: values.affected,
      allowWontFix: values['allow-wont-fix'],
    })
    if (values.affected) {
      console.log(`已复审受功能 diff 影响的 evidence owner ${outcome.coReviewed.length} 个:${outcome.coReviewed.join('、')}`)
    }
    else {
      console.log(`已记录计划组件 ${outcome.picked.length} 个:${outcome.picked.join('、')}`)
    }
    if (!values.affected && outcome.coReviewed.length > 0) {
      console.log(`同批复审受影响 evidence owner ${outcome.coReviewed.length} 个:${outcome.coReviewed.join('、')}`)
    }
    console.log(`证据统一绑定功能提交 ${outcome.headSha};ledger 请作为第二个提交随 PR 交付。`)
  }
  else if (values.verify) {
    const report = await verifyLedger({ repoRoot, ledger: current.ledger, graph })
    if (values.json) console.log(JSON.stringify(report, null, 2))
    else printVerify(report)
    if (report.stale.length > 0) process.exitCode = 1
  }
  else {
    const state = values.base ? await stateAt(values.base, assertPlanBaseSha) : { graph, ledger: current.ledger, base: null }
    const report = describe(state.graph, state.ledger, planNext(state.graph, state.ledger))
    if (state.base) report.baseSha = state.base
    if (values.json) console.log(JSON.stringify(report, null, 2))
    else printPlan(report)
  }
}
catch (error) {
  if (error instanceof AuditError || error instanceof SyntaxError) {
    console.error(error.message)
    process.exitCode = 1
  }
  else {
    throw error
  }
}
