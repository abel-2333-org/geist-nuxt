// 组件审计核心库:选簇、ledger 状态机、Git 快照证据、fail-closed 读写。
//
// 状态模型(正交两轴,不再用单一 verdict 混淆「改没改」与「审没审完」):
//   change  none | modified          本次审计有没有改代码
//   status  deferred | verified      是否仍有 open finding
//   landed  派生态,不落盘 —— verified 且证据在 canonical main 上重算一致
//
// 新证据绑定审计起点、功能提交、registry item 拓扑与 scope 内容。record 只读取
// 已提交 Git blob;ledger/report 作为第二个提交交付。簿记目录禁止进入 scope,
// 避免自引用。
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { sha256 } from './registry.mjs'

export const LEDGER_VERSION = 2
export const CHANGES = ['none', 'modified']
export const STATUSES = ['deferred', 'verified']
// unknown 仅存在于 v1 迁移产物;新记录必须使用前四级
export const SEVERITIES = ['critical', 'high', 'medium', 'low', 'unknown']
export const RECORDABLE_SEVERITIES = ['critical', 'high', 'medium', 'low']
export const DISPOSITIONS = ['open', 'resolved', 'wont-fix']
export const BOOKKEEPING_PREFIX = 'docs/maintenance/component-audit/'

// —— 可调策略常量(选簇算法既有行为,勿随意改动)——
export const TARGET_SIZE = 3 // 一天最多审计的组件数
export const MIN_SIZE = 2 // 一天期望的下限;本轮余量不足时可低于它
export const LOC_BUDGET = 1100 // 一天的源码总行数预算,超了就少取一个
export const HUB_DEGREE = 6 // 被超过这么多 item 依赖的 item 视为 hub,不产生兄弟关系边
const SCORE_DIRECT = 3 // A 直接依赖 B(或反向)
const SCORE_SIBLING = 2 // A、B 共享同一个非 hub 依赖,每个共享依赖计一次,最多计 2 个
const SCORE_NAMESPACE = 1 // 同命名空间(foundation-* / api-docs-*)

const SHA_RE = /^[0-9a-f]{40}$/i
const DIGEST_RE = /^[0-9a-f]{64}$/
const EVIDENCE_KINDS = ['legacy-v1', 'scope-v1']

export class AuditError extends Error {
  constructor(message, details = []) {
    super(message)
    this.name = 'AuditError'
    this.details = details
  }
}

function namespaceOf(name) {
  return name.startsWith('api-docs-') ? 'api-docs' : 'foundation'
}

// —— git 取证:失败必须抛错,绝不返回 null 继续 ——

export function headSha(repoRoot) {
  let value
  try {
    value = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  }
  catch (error) {
    throw new AuditError(`无法取得 HEAD SHA(fail closed,不写 null):${error.message}`)
  }
  if (!SHA_RE.test(value)) throw new AuditError(`HEAD SHA 非法:${value}`)
  return value.toLowerCase()
}

export function assertBaseSha(repoRoot, baseSha) {
  if (!SHA_RE.test(baseSha ?? '')) {
    throw new AuditError(`--base 必须是精确 40 位 main SHA,收到:${baseSha ?? '<缺失>'}`)
  }
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', baseSha, 'HEAD'], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  }
  catch {
    throw new AuditError(`--base ${baseSha} 不是当前 HEAD 的祖先:审计必须从实时 origin/main 精确 SHA 开始`)
  }
  return baseSha.toLowerCase()
}

function originMainSha(repoRoot) {
  const value = gitText(repoRoot, ['rev-parse', '--verify', 'refs/remotes/origin/main'], '无法取得实时 origin/main').trim()
  if (!SHA_RE.test(value)) throw new AuditError(`origin/main SHA 非法:${value}`)
  return value.toLowerCase()
}

export function assertPlanBaseSha(repoRoot, baseSha) {
  const normalized = assertBaseSha(repoRoot, baseSha)
  const remote = originMainSha(repoRoot)
  if (normalized !== remote) {
    throw new AuditError(`--base ${normalized} 不是实时 origin/main ${remote};请重新 fetch 后生成计划`)
  }
  return normalized
}

export function assertRecordBaseSha(repoRoot, baseSha) {
  const normalized = assertBaseSha(repoRoot, baseSha)
  const branchBase = gitText(repoRoot, ['merge-base', 'HEAD', 'refs/remotes/origin/main'], '无法确定 audit 分支与 origin/main 的分叉点').trim().toLowerCase()
  if (!SHA_RE.test(branchBase) || normalized !== branchBase) {
    throw new AuditError(`--base ${normalized} 不是当前 audit 分支与 origin/main 的精确分叉点 ${branchBase};请 rebase 后重新审计`)
  }
  return normalized
}

function gitText(repoRoot, args, label) {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 16 * 1024 * 1024,
    })
  }
  catch (error) {
    throw new AuditError(`${label}(fail closed):${error.stderr?.trim() || error.message}`)
  }
}

function gitBytes(repoRoot, args, label) {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    })
  }
  catch (error) {
    throw new AuditError(`${label}(fail closed):${error.stderr?.toString('utf8').trim() || error.message}`)
  }
}

export function assertCleanWorktree(repoRoot) {
  const dirty = gitText(repoRoot, ['status', '--porcelain=v1', '--untracked-files=all'], '无法检查工作区状态').trim()
  if (dirty) {
    throw new AuditError(`--record 前必须先提交功能改动,当前工作区不干净:\n${dirty}`)
  }
}

function gitBlob(repoRoot, revision, relativePath) {
  const tree = gitBytes(repoRoot, ['ls-tree', '-z', revision, '--', relativePath], `无法检查 Git blob mode ${revision}:${relativePath}`)
  const record = tree.toString('utf8').replace(/\0$/, '')
  const match = /^(\d{6}) (blob|commit) ([0-9a-f]{40,64})\t(.+)$/.exec(record)
  if (!match || match[4] !== relativePath) {
    throw new AuditError(`Git scope 文件不存在或不是唯一条目:${revision}:${relativePath}`)
  }
  const [, mode, type, oid] = match
  if (type !== 'blob' || (mode !== '100644' && mode !== '100755')) {
    throw new AuditError(`Git scope 只允许普通文件:${relativePath}(mode ${mode},type ${type})`)
  }
  return gitBytes(repoRoot, ['cat-file', 'blob', oid], `无法读取 Git blob ${revision}:${relativePath}`)
}

export function readGitFile(repoRoot, revision, relativePath) {
  return gitBlob(repoRoot, revision, relativePath).toString('utf8')
}

// —— 依赖图(与既有实现一致)——

async function countLines(repoRoot, relativePath, readFile) {
  try {
    const content = await readFile(relativePath)
    return content.split('\n').length
  }
  catch {
    return 0
  }
}

export async function buildGraph(registry, repoRoot, options = {}) {
  const readFile = options.readFile ?? (relative => fs.readFile(path.join(repoRoot, relative), 'utf8'))
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
      const lines = await countLines(repoRoot, file.path, readFile)
      fileLoc.set(file.path, lines)
      total += lines
    }
    loc.set(name, total)
  }

  return { byName, deps, dependedBy, hubs, components, loc, fileLoc }
}

function relationScore(graph, a, b) {
  // 轮次翻转那天 lastPicked 会重新落回 pool,这里必须返回同形状的对象
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
  // 分数 → 被依赖数(改动收益面)→ 行数(复杂度)→ 名字(稳定排序)
  if (b.score !== a.score) return b.score - a.score
  const depsA = graph.dependedBy.get(a.name)?.size ?? 0
  const depsB = graph.dependedBy.get(b.name)?.size ?? 0
  if (depsB !== depsA) return depsB - depsA
  const locA = graph.loc.get(a.name) ?? 0
  const locB = graph.loc.get(b.name) ?? 0
  if (locB !== locA) return locB - locA
  return a.name.localeCompare(b.name)
}

// —— ledger:fail-closed 读取与确定性迁移 ——

export function emptyEntry() {
  return {
    round: 0,
    lastAuditedAt: null,
    change: null,
    status: null,
    evidence: null,
    notes: null,
    findings: [],
  }
}

export function findingId(item, evidence) {
  return `f-${sha256(`${item}\n${evidence}`).slice(0, 12)}`
}

// v1 → v2 纯函数迁移:同一输入永远得到同一输出。
// verdict 映射:clean → none;improved → modified;deferred → none。
// v1 没有可验证 scope,只保留原 SHA 的 provenance,不把它误称为 main SHA。
export function migrateLedgerV1(raw) {
  if (!raw || typeof raw !== 'object' || raw.version !== 1 || typeof raw.round !== 'number'
    || !raw.items || typeof raw.items !== 'object' || Array.isArray(raw.items)) {
    throw new AuditError('无法迁移:不是结构完整的 v1 ledger(fail closed)')
  }
  const changeMap = { clean: 'none', improved: 'modified', deferred: 'none' }
  const items = {}
  for (const [name, entry] of Object.entries(raw.items)) {
    if (!entry || typeof entry !== 'object') throw new AuditError(`v1 ledger 条目损坏:${name}`)
    const verdict = entry.verdict ?? null
    if (verdict !== null && !changeMap[verdict]) throw new AuditError(`v1 verdict 未知,拒绝迁移:${name} = ${verdict}`)
    const openFindings = entry.openFindings ?? []
    if (!Array.isArray(openFindings) || openFindings.some(text => typeof text !== 'string')) {
      throw new AuditError(`v1 openFindings 必须是字符串数组:${name}`)
    }
    const findings = openFindings.map(text => ({
      id: findingId(name, text),
      severity: 'unknown',
      claim: null,
      evidence: text,
      disposition: 'open',
    }))
    items[name] = {
      round: typeof entry.round === 'number' ? entry.round : 0,
      lastAuditedAt: entry.lastAuditedAt ?? null,
      change: verdict === null ? null : changeMap[verdict],
      status: verdict === null ? null : findings.length > 0 || verdict === 'deferred' ? 'deferred' : 'verified',
      evidence: verdict === null
        ? null
        : { kind: 'legacy-v1', sha: entry.lastAuditedSha ?? null },
      notes: entry.notes ?? null,
      findings,
    }
  }
  return {
    version: LEDGER_VERSION,
    round: raw.round,
    lastRunAt: raw.lastRunAt ?? null,
    lastPicked: [...(raw.lastPicked ?? [])],
    items,
  }
}

export function assertLedgerV2(ledger) {
  const fail = (message) => { throw new AuditError(`ledger 校验失败(fail closed):${message}`) }
  if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger)) fail('必须是对象')
  if (ledger.version !== LEDGER_VERSION) fail(`version 必须是 ${LEDGER_VERSION},收到 ${ledger.version}`)
  if (!Number.isInteger(ledger.round) || ledger.round < 1) fail('round 必须是 ≥1 的整数')
  if (ledger.lastRunAt !== null && typeof ledger.lastRunAt !== 'string') fail('lastRunAt 必须是 null 或字符串')
  if (!Array.isArray(ledger.lastPicked) || ledger.lastPicked.some(name => typeof name !== 'string')) fail('lastPicked 必须是字符串数组')
  if (new Set(ledger.lastPicked).size !== ledger.lastPicked.length) fail('lastPicked 不得重复')
  if (!ledger.items || typeof ledger.items !== 'object' || Array.isArray(ledger.items)) fail('items 必须是对象')
  for (const [name, entry] of Object.entries(ledger.items)) {
    if (!entry || typeof entry !== 'object') fail(`条目 ${name} 损坏`)
    if (!Number.isInteger(entry.round) || entry.round < 0) fail(`${name}.round 非法`)
    if (entry.lastAuditedAt !== null && typeof entry.lastAuditedAt !== 'string') fail(`${name}.lastAuditedAt 非法`)
    if (entry.notes !== null && typeof entry.notes !== 'string') fail(`${name}.notes 非法`)
    if (!(entry.change === null ? entry.status === null : CHANGES.includes(entry.change))) fail(`${name}.change 非法:${entry.change}`)
    if (entry.status !== null && !STATUSES.includes(entry.status)) fail(`${name}.status 非法:${entry.status}`)
    if ((entry.change === null) !== (entry.status === null)) fail(`${name} 的 change/status 必须同时为 null 或同时有值`)
    if ((entry.status === null) !== (entry.evidence === null)) fail(`${name} 的 status/evidence 必须同时为空或同时有值`)
    if (entry.evidence !== null) {
      const evidence = entry.evidence
      if (!evidence || typeof evidence !== 'object' || !EVIDENCE_KINDS.includes(evidence.kind)) fail(`${name}.evidence.kind 非法`)
      if (evidence.kind === 'legacy-v1') {
        if (evidence.sha !== null && !SHA_RE.test(evidence.sha)) fail(`${name}.evidence.sha 非法`)
      }
      else {
        for (const field of ['baseSha', 'headSha']) {
          if (!SHA_RE.test(evidence[field] ?? '')) fail(`${name}.evidence.${field} 非法`)
        }
        for (const field of ['itemDigest', 'scopeDigest']) {
          if (!DIGEST_RE.test(evidence[field] ?? '')) fail(`${name}.evidence.${field} 非法`)
        }
        if (!Array.isArray(evidence.scope) || evidence.scope.length === 0) fail(`${name}.evidence.scope 必须是非空数组`)
        const normalized = evidence.scope.map(scopePath)
        const sorted = [...normalized].sort()
        if (new Set(normalized).size !== normalized.length
          || normalized.some((value, index) => value !== evidence.scope[index])
          || sorted.some((value, index) => value !== normalized[index])) {
          fail(`${name}.evidence.scope 必须规范化、唯一且有序`)
        }
      }
    }
    if (!Array.isArray(entry.findings)) fail(`${name}.findings 必须是数组`)
    const findingIds = new Set()
    for (const finding of entry.findings) {
      if (!finding || typeof finding !== 'object') fail(`${name} 存在损坏的 finding`)
      if (typeof finding.id !== 'string' || !finding.id) fail(`${name} 的 finding 缺 id`)
      if (!SEVERITIES.includes(finding.severity)) fail(`${name}/${finding.id} severity 非法:${finding.severity}`)
      if (typeof finding.evidence !== 'string' || !finding.evidence) fail(`${name}/${finding.id} 缺 evidence`)
      if (!DISPOSITIONS.includes(finding.disposition)) fail(`${name}/${finding.id} disposition 非法:${finding.disposition}`)
      if (finding.claim !== null && typeof finding.claim !== 'string') fail(`${name}/${finding.id} claim 必须是 null 或字符串`)
      if (findingIds.has(finding.id)) fail(`${name} 的 finding id 重复:${finding.id}`)
      findingIds.add(finding.id)
    }
    const openCount = entry.findings.filter(finding => finding.disposition === 'open').length
    if (entry.status === 'verified' && openCount > 0) fail(`${name} 为 verified 但仍有 open finding`)
    if (entry.status === 'deferred' && openCount === 0) fail(`${name} 为 deferred 但没有 open finding`)
  }
}

// 读取失败、JSON 损坏、版本未知 → 全部抛错。绝不静默重建冷启动 ledger:
// 那会丢掉整轮审计进度并让完成状态凭空归零。
export async function loadLedger(ledgerPath, graph) {
  let raw
  try {
    raw = await fs.readFile(ledgerPath, 'utf8')
  }
  catch (error) {
    throw new AuditError(`无法读取 ledger(fail closed,不冷启动):${ledgerPath}(${error?.code ?? error?.message})`)
  }
  let parsed
  try {
    parsed = JSON.parse(raw)
  }
  catch (error) {
    throw new AuditError(`ledger 不是合法 JSON(fail closed):${error.message}`)
  }
  let ledger
  if (parsed?.version === 1) ledger = migrateLedgerV1(parsed)
  else if (parsed?.version === LEDGER_VERSION) ledger = parsed
  else throw new AuditError(`不支持的 ledger version:${parsed?.version ?? '<缺失>'}(fail closed)`)
  assertLedgerV2(ledger)
  // registry 新增组件时自动补进 ledger,视为本轮未审计
  for (const name of graph.components) {
    ledger.items[name] ??= emptyEntry()
  }
  return { ledger, raw }
}

export async function loadLedgerAt(repoRoot, revision, ledgerRelativePath, graph) {
  const raw = readGitFile(repoRoot, revision, ledgerRelativePath)
  let parsed
  try {
    parsed = JSON.parse(raw)
  }
  catch (error) {
    throw new AuditError(`${revision} 上的 ledger 不是合法 JSON:${error.message}`)
  }
  const ledger = parsed?.version === 1
    ? migrateLedgerV1(parsed)
    : parsed?.version === LEDGER_VERSION
      ? parsed
      : null
  if (!ledger) throw new AuditError(`${revision} 上的 ledger version 不受支持:${parsed?.version ?? '<缺失>'}`)
  assertLedgerV2(ledger)
  for (const name of graph.components) ledger.items[name] ??= emptyEntry()
  return { ledger, raw }
}

async function acquireLedgerLock(lockPath) {
  const owner = {
    pid: process.pid,
    startedAt: new Date().toISOString(),
    token: randomUUID(),
  }
  // 与正式 lock 同目录以保证 hard link 不跨文件系统；gitignore 会隔离崩溃残留。
  const candidate = `${lockPath}.owner-${owner.token}`
  try {
    // 先完整写 owner 文件,再用 hard link 原子发布。这样进程无论在哪一刻终止,
    // 正式 lock 都只会是「不存在」或「完整 metadata」,不会留下半写内容。
    await fs.writeFile(candidate, `${JSON.stringify(owner)}\n`, { encoding: 'utf8', flag: 'wx' })
    await fs.link(candidate, lockPath)
  }
  catch (error) {
    if (error?.code === 'EEXIST') {
      let current = '<损坏>'
      try {
        const parsed = JSON.parse(await fs.readFile(lockPath, 'utf8'))
        current = `pid=${parsed.pid ?? '<未知>'},startedAt=${parsed.startedAt ?? '<未知>'}`
      }
      catch {}
      throw new AuditError(`ledger 已锁定(${current});拒绝自动回收,请人工确认 owner 已退出后清理 ${lockPath}`)
    }
    throw new AuditError(`无法取得 ledger 写锁:${error?.code ?? error?.message}`)
  }
  finally {
    try {
      await fs.rm(candidate, { force: true })
    }
    catch (error) {
      throw new AuditError(`ledger lock owner 临时文件清理失败:${error?.code ?? error?.message}`)
    }
  }
  return { owner }
}

async function releaseLedgerLock(lockPath, lock) {
  let current
  try {
    current = JSON.parse(await fs.readFile(lockPath, 'utf8'))
  }
  catch (error) {
    throw new AuditError(`ledger lock 清理前无法回读:${error?.code ?? error?.message}`)
  }
  if (current.token !== lock.owner.token) {
    throw new AuditError('ledger lock owner 已变化,拒绝删除其他进程的 lock')
  }
  try {
    await fs.rm(lockPath)
  }
  catch (error) {
    throw new AuditError(`ledger lock 清理失败:${error?.code ?? error?.message}`)
  }
}

export async function writeLedgerAtomic(ledgerPath, ledger, expectedRaw) {
  assertLedgerV2(ledger)
  await fs.mkdir(path.dirname(ledgerPath), { recursive: true })
  const lockPath = `${ledgerPath}.lock`
  const lock = await acquireLedgerLock(lockPath)

  const temporary = `${ledgerPath}.audit-tmp-${lock.owner.token}`
  let failure = null
  try {
    // 比较与替换都位于独占锁内,避免两个 writer 同时通过 stale 检查。
    if (expectedRaw !== undefined) {
      let current
      try {
        current = await fs.readFile(ledgerPath, 'utf8')
      }
      catch (error) {
        throw new AuditError(`stale 守卫读取失败:${ledgerPath}(${error?.code ?? error?.message})`)
      }
      if (current !== expectedRaw) {
        throw new AuditError('ledger 在本次运行期间被并发修改,拒绝覆盖(重新加载后再记账)')
      }
    }
    await fs.writeFile(temporary, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8')
    await fs.rename(temporary, ledgerPath)
  }
  catch (error) {
    failure = error
  }

  const cleanupFailures = []
  try {
    await fs.rm(temporary, { force: true })
  }
  catch (error) {
    cleanupFailures.push(new AuditError(`ledger 临时文件清理失败:${error?.code ?? error?.message}`))
  }
  try {
    await releaseLedgerLock(lockPath, lock)
  }
  catch (error) {
    cleanupFailures.push(error)
  }

  if (failure && cleanupFailures.length > 0) {
    throw new AuditError(
      `${failure.message};此外 ${cleanupFailures.map(error => error.message).join(';')}`,
      [failure, ...cleanupFailures],
    )
  }
  if (failure) throw failure
  if (cleanupFailures.length === 1) throw cleanupFailures[0]
  if (cleanupFailures.length > 1) {
    throw new AuditError(
      cleanupFailures.map(error => error.message).join(';'),
      cleanupFailures,
    )
  }
}

// —— 选簇(既有算法 + deferred 优先队列)——

function severityRank(severity) {
  const index = SEVERITIES.indexOf(severity)
  return index === -1 ? SEVERITIES.length : index
}

function topOpenSeverity(entry) {
  const open = (entry?.findings ?? []).filter(finding => finding.disposition === 'open')
  if (open.length === 0) return null
  return open.reduce((best, finding) => (severityRank(finding.severity) < severityRank(best) ? finding.severity : best), open[0].severity)
}

// 仍有 open finding 的组件(无论 status 是 deferred 还是 verified-带遗留)
// 立即重回 pool:不因「已经扫描过」而等完整 round 结束才重新出现。
export function itemsWithOpenFindings(graph, ledger) {
  return graph.components.filter((name) => {
    const entry = ledger.items[name]
    return entry?.status !== null && entry?.status !== undefined
      && (entry.findings ?? []).some(finding => finding.disposition === 'open')
  })
}

// 其中 critical / high 的 open finding 插队:排在新扫描之前。
// unknown(v1 迁移产物)不能凭空声称高优先级,只走 pool 重入。
export function priorityBacklogOf(graph, ledger) {
  return itemsWithOpenFindings(graph, ledger).filter((name) => {
    const top = topOpenSeverity(ledger.items[name])
    return top === 'critical' || top === 'high'
  })
}

export function planNext(graph, ledger) {
  let round = ledger.round
  const reentry = itemsWithOpenFindings(graph, ledger)
  const priority = priorityBacklogOf(graph, ledger)
  let unaudited = graph.components.filter(name => (ledger.items[name]?.round ?? 0) < round)
  let roundRollover = false

  if (unaudited.length === 0 && reentry.length === 0) {
    round += 1
    roundRollover = true
    unaudited = [...graph.components]
  }

  const pool = [...new Set([...reentry, ...unaudited])]
  const seedFrom = (ledger.lastPicked ?? []).filter(name => graph.components.includes(name))
  const picked = []
  const rationale = new Map()
  let loc = 0

  // 0) 高优先级未解决 finding 排在新扫描之前
  const rankedBacklog = priority
    .map(name => ({ name, severity: topOpenSeverity(ledger.items[name]) ?? 'unknown', score: 0, reasons: [] }))
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || compareCandidates(graph, a, b))
  for (const candidate of rankedBacklog) {
    if (picked.length >= TARGET_SIZE) break
    const nextLoc = graph.loc.get(candidate.name) ?? 0
    if (picked.length > 0 && loc + nextLoc > LOC_BUDGET) break
    picked.push(candidate.name)
    loc += nextLoc
    rationale.set(candidate.name, `遗留 deferred finding(最高 severity:${candidate.severity})优先于新扫描`)
  }
  const blockedPriority = priority.some(name => !picked.includes(name))

  // 1) seed:优先接续上次审计的簇(backlog 未占满时)
  if (picked.length === 0 && !blockedPriority) {
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
    loc += graph.loc.get(seed.name) ?? 0
    rationale.set(
      seed.name,
      seed.score > 0
        ? `接续上次审计簇:${seed.reasons.join(';')}`
        : seedFrom.length > 0
          ? '与上次审计簇无依赖关联,改取被依赖最多的未审计组件'
          : '冷启动:取被依赖最多的组件,改动收益面最大',
    )
  }

  // 2) 沿依赖图扩张,直到数量或行数预算触顶
  while (!blockedPriority && picked.length < TARGET_SIZE) {
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
    rationale.set(next.name, next.score > 0 ? next.reasons.join(';') : '本轮余量中依赖关系最近的组件')
  }

  // 不留孤儿:若取完这批后本轮只剩 1 个组件,就把它并进来,避免出现单组件低价值日
  const orphans = pool.filter(name => !picked.includes(name))
  if (!blockedPriority && orphans.length === 1) {
    const [orphan] = orphans
    picked.push(orphan)
    loc += graph.loc.get(orphan) ?? 0
    rationale.set(orphan, '本轮最后一个组件,并入本批避免单组件日')
  }

  return { round, roundRollover, picked, rationale, loc, poolSize: pool.length, reentry, priority }
}

export function describe(graph, ledger, plan) {
  return {
    round: plan.round,
    // record() 会在本轮清空时就推进 round,所以「新一轮」以池子是否满员为准
    roundRollover: plan.roundRollover || (plan.poolSize === graph.components.length && (ledger.lastPicked ?? []).length > 0),
    remainingInRound: plan.poolSize - plan.picked.length,
    totalComponents: graph.components.length,
    totalLoc: plan.loc,
    previous: ledger.lastPicked ?? [],
    openFindingReentry: plan.reentry,
    priorityBacklog: plan.priority,
    items: plan.picked.map((name) => {
      const item = graph.byName.get(name)
      const entry = ledger.items[name] ?? emptyEntry()
      return {
        name,
        title: item.title,
        description: item.description,
        why: plan.rationale.get(name),
        loc: graph.loc.get(name),
        files: (item.files ?? []).map(file => ({ path: file.path, target: file.target, loc: graph.fileLoc.get(file.path) ?? 0 })),
        dependsOn: [...(graph.deps.get(name) ?? [])],
        dependedBy: [...(graph.dependedBy.get(name) ?? [])],
        lastAuditedAt: entry.lastAuditedAt,
        change: entry.change,
        status: entry.status,
        openFindings: (entry.findings ?? []).filter(finding => finding.disposition === 'open'),
      }
    }),
  }
}

// —— 记账:输入必须与当日计划严格一致,证据必须完整 ——

function scopePath(input) {
  if (typeof input !== 'string' || !input || input.includes('\\') || path.posix.isAbsolute(input)) {
    throw new AuditError(`scope 路径非法:${input}`)
  }
  const normalized = path.posix.normalize(input)
  if (normalized !== input || normalized.startsWith('../') || normalized.split('/').some(segment => segment === '..' || segment === '.')) {
    throw new AuditError(`scope 路径未规范化或越界:${input}`)
  }
  if (normalized.startsWith(BOOKKEEPING_PREFIX)) {
    throw new AuditError(`scope 不得包含审计簿记(digest 自引用):${input}`)
  }
  return normalized
}

export function resolveScope(registryItem, declaredScope = []) {
  if (!Array.isArray(declaredScope) || declaredScope.some(p => typeof p !== 'string' || !p)) {
    throw new AuditError(`${registryItem.name} 的 scope 必须是非空字符串数组`)
  }
  const paths = new Set((registryItem.files ?? []).map(file => scopePath(file.path)))
  for (const input of declaredScope) paths.add(scopePath(input))
  return [...paths].sort()
}

export async function computeScopeDigest(repoRoot, scopeFiles) {
  const parts = []
  for (const relative of [...scopeFiles].map(scopePath).sort()) {
    let content
    try {
      const absolute = path.join(repoRoot, relative)
      const info = await fs.lstat(absolute)
      if (info.isSymbolicLink() || !info.isFile()) throw new AuditError(`scope 必须是普通文件:${relative}`)
      content = await fs.readFile(absolute)
    }
    catch (error) {
      if (error instanceof AuditError) throw error
      throw new AuditError(`scope 文件不可读,digest 失败(fail closed):${relative}(${error?.code ?? error?.message})`)
    }
    parts.push(`${relative}\0${sha256(content)}`)
  }
  return sha256(parts.join('\n'))
}

export function computeGitScopeDigest(repoRoot, revision, scopeFiles) {
  const parts = []
  for (const relative of [...scopeFiles].map(scopePath).sort()) {
    const content = gitBlob(repoRoot, revision, relative)
    parts.push(`${relative}\0${sha256(content)}`)
  }
  return sha256(parts.join('\n'))
}

export function registryItemDigest(item) {
  if (!item || typeof item !== 'object') throw new AuditError('无法计算缺失 registry item 的 digest')
  const normalized = {
    ...item,
    files: (item.files ?? [])
      .map(file => ({ path: file.path, target: file.target ?? null }))
      .sort((a, b) => a.path.localeCompare(b.path) || String(a.target).localeCompare(String(b.target))),
    registryDependencies: [...(item.registryDependencies ?? [])].sort(),
  }
  const canonicalize = value => Array.isArray(value)
    ? value.map(canonicalize)
    : value && typeof value === 'object'
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonicalize(child)]))
      : value
  return sha256(JSON.stringify(canonicalize(normalized)))
}

function normalizeFinding(itemName, finding, existing, allowWontFix) {
  if (!finding || typeof finding !== 'object') throw new AuditError(`${itemName} 存在损坏的 finding`)
  if (typeof finding.evidence !== 'string' || !finding.evidence) throw new AuditError(`${itemName} 的 finding 缺 evidence(复现输入 / 反例)`)
  if (!RECORDABLE_SEVERITIES.includes(finding.severity)) {
    throw new AuditError(`${itemName} 的 finding severity 必须是 ${RECORDABLE_SEVERITIES.join('/')},收到:${finding.severity}`)
  }
  const disposition = finding.disposition ?? 'open'
  if (!DISPOSITIONS.includes(disposition)) throw new AuditError(`${itemName} 的 finding disposition 非法:${finding.disposition}`)
  if (disposition === 'wont-fix' && !allowWontFix) {
    throw new AuditError(`${itemName} 的 wont-fix 需要人工明确授权(--allow-wont-fix)`)
  }
  const derivedId = findingId(itemName, finding.evidence)
  if (!existing && finding.id !== undefined && finding.id !== derivedId) {
    throw new AuditError(`${itemName} 的新 finding id 必须由 evidence 派生:${derivedId}`)
  }
  const normalized = {
    id: existing?.id ?? derivedId,
    severity: finding.severity,
    claim: typeof finding.claim === 'string' && finding.claim ? finding.claim : null,
    evidence: finding.evidence,
    disposition,
  }
  if (existing && normalized.evidence !== existing.evidence) {
    throw new AuditError(`${itemName}/${normalized.id} 的 evidence 不可改写;请保留原 finding 或新增 finding`)
  }
  if (!existing && disposition !== 'open') {
    throw new AuditError(`${itemName}/${normalized.id} 是新 finding,不能直接标记 ${disposition}`)
  }
  return normalized
}

function mergeFindings(itemName, previous, submitted, allowWontFix) {
  const priorById = new Map(previous.map(finding => [finding.id, finding]))
  const incoming = submitted.map(finding => {
    const provisionalId = typeof finding?.id === 'string' && finding.id
      ? finding.id
      : findingId(itemName, finding?.evidence ?? '')
    return normalizeFinding(itemName, finding, priorById.get(provisionalId), allowWontFix)
  })
  const ids = incoming.map(finding => finding.id)
  if (new Set(ids).size !== ids.length) throw new AuditError(`${itemName} 的 record finding id 重复`)

  const incomingById = new Map(incoming.map(finding => [finding.id, finding]))
  const missingOpen = previous
    .filter(finding => finding.disposition === 'open' && !incomingById.has(finding.id))
    .map(finding => finding.id)
  if (missingOpen.length > 0) {
    throw new AuditError(`${itemName} 不得省略既有 open finding:${missingOpen.join('、')}`)
  }

  const closed = previous.filter(finding => finding.disposition !== 'open' && !incomingById.has(finding.id))
  return [...closed, ...incoming].sort((a, b) => a.id.localeCompare(b.id))
}

function hasCommittedPathChange(repoRoot, baseSha, headSha, paths) {
  try {
    execFileSync('git', ['diff', '--quiet', baseSha, headSha, '--', ...paths], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return false
  }
  catch (error) {
    if (error.status === 1) return true
    throw new AuditError(`无法比较审计功能提交:${error.stderr?.toString('utf8').trim() || error.message}`)
  }
}

function hasCommittedScopeChange(repoRoot, baseSha, headSha, scope) {
  return hasCommittedPathChange(repoRoot, baseSha, headSha, scope)
}

function hasCommittedChange(repoRoot, baseSha, headSha, scope) {
  return hasCommittedPathChange(repoRoot, baseSha, headSha, ['registry.json', ...scope])
}

function isGitScopeFile(repoRoot, revision, relativePath) {
  try {
    gitBlob(repoRoot, revision, relativePath)
    return true
  }
  catch (error) {
    if (error instanceof AuditError && (
      error.message.includes('不存在或不是唯一条目')
      || error.message.includes('只允许普通文件')
    )) return false
    throw error
  }
}

function impactedEvidenceOwners(repoRoot, baseSha, headSha, ledger, graph, planned) {
  return Object.entries(ledger.items)
    .filter(([name, entry]) => !planned.has(name) && entry.evidence?.kind === 'scope-v1')
    .map(([name, entry]) => ({
      name,
      changed: entry.evidence.scope.filter(scope => hasCommittedScopeChange(repoRoot, baseSha, headSha, [scope])),
      topologyChanged: !graph.byName.has(name)
        || registryItemDigest(graph.byName.get(name)) !== entry.evidence.itemDigest,
    }))
    .filter(owner => owner.changed.length > 0 || owner.topologyChanged)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function recordResults({
  repoRoot,
  ledgerPath,
  graph,
  ledger,
  rawLedger,
  planGraph,
  planLedger,
  baseLedgerRaw,
  results,
  baseSha,
  allowWontFix = false,
  now = new Date().toISOString(),
}) {
  if (!Array.isArray(results)) {
    throw new AuditError('record 文件必须是数组:[{ item, change, status, notes?, scope?, findings? }]')
  }
  assertCleanWorktree(repoRoot)
  const evidenceHeadSha = headSha(repoRoot)
  const normalizedBaseSha = assertRecordBaseSha(repoRoot, baseSha)
  if (rawLedger !== baseLedgerRaw) {
    throw new AuditError('当前 ledger 与 --base 上的 canonical ledger 不一致;请先 rebase,不要在旧记录上继续记账')
  }

  // 计划从 --base 的 registry + ledger + Git blob LOC 重算,不受实现期间工作树变化影响。
  const plan = planNext(planGraph, planLedger)
  const resultNames = results.map(result => result?.item)
  if (new Set(resultNames).size !== resultNames.length) throw new AuditError('record 输入包含重复 item')

  const planned = new Set(plan.picked)
  for (const result of results) {
    if (result?.coReview !== undefined && typeof result.coReview !== 'boolean') {
      throw new AuditError(`${result?.item ?? '未知 item'} 的 coReview 必须是 boolean`)
    }
    if (planned.has(result?.item) && result.coReview === true) {
      throw new AuditError(`${result.item} 是当日计划组件,不得标记 coReview`)
    }
    if (!planned.has(result?.item) && result?.coReview !== true) {
      throw new AuditError(`${result?.item ?? '未知 item'} 不在当日计划中,必须是 recorder 要求的 coReview owner`)
    }
  }

  const expected = [...plan.picked].sort()
  const received = results.filter(result => planned.has(result.item)).map(result => result.item).sort()
  if (JSON.stringify(expected) !== JSON.stringify(received)) {
    throw new AuditError(`record 输入必须与当日计划一致\n  计划:${expected.join('、')}\n  收到:${received.join('、')}`)
  }

  const impacts = impactedEvidenceOwners(
    repoRoot,
    normalizedBaseSha,
    evidenceHeadSha,
    planLedger,
    graph,
    planned,
  )
  const impacted = impacts.map(owner => owner.name)
  const impactByName = new Map(impacts.map(owner => [owner.name, owner.changed]))
  const coReviewed = results.filter(result => result.coReview === true).map(result => result.item).sort()
  const missingOwners = impacted.filter(name => !coReviewed.includes(name))
  if (missingOwners.length > 0) {
    throw new AuditError(`record 输入缺少受当前功能 diff 影响的 evidence owner:${missingOwners.join('、')}`)
  }
  const unrelatedOwners = coReviewed.filter(name => !impacted.includes(name))
  if (unrelatedOwners.length > 0) {
    throw new AuditError(`coReview 只能包含 base evidence 被当前功能 diff 影响的 scope-v1 owner:${unrelatedOwners.join('、')}`)
  }

  const nextEntries = new Map()
  const resultByName = new Map(results.map(result => [result.item, result]))
  for (const name of [...plan.picked, ...impacted]) {
    const result = resultByName.get(name)
    const coReview = result.coReview === true
    if (coReview) {
      if (result.change !== 'modified') throw new AuditError(`${name} 的 coReview change 必须是 modified`)
      if (typeof result.notes !== 'string' || !result.notes.trim()) throw new AuditError(`${name} 的 coReview 必须提供非空 notes`)
      if (!Array.isArray(result.scope) || result.scope.length === 0) throw new AuditError(`${name} 的 coReview 必须显式提供非空 scope`)
      if (!Array.isArray(result.findings)) throw new AuditError(`${name} 的 coReview 必须显式提供 findings 数组`)
    }
    if (!CHANGES.includes(result.change)) throw new AuditError(`${name} 的 change 必须是 ${CHANGES.join(' / ')}`)
    if (!STATUSES.includes(result.status)) throw new AuditError(`${name} 的 status 必须是 ${STATUSES.join(' / ')}`)
    const item = graph.byName.get(name)
    if (!item || item.type !== 'registry:component') throw new AuditError(`${name} 在当前 registry 中不存在或不再是 component`)
    const findings = mergeFindings(name, ledger.items[name]?.findings ?? [], result.findings ?? [], allowWontFix)
    const openCount = findings.filter(finding => finding.disposition === 'open').length
    if (result.status === 'deferred' && openCount === 0) {
      throw new AuditError(`${name} 标记 deferred 却没有任何 open finding:deferred 必须有明确未解决问题`)
    }
    if (result.status === 'verified' && openCount > 0) {
      throw new AuditError(`${name} 标记 verified 却仍有 open finding`)
    }
    const scope = resolveScope(item, result.scope ?? [])
    if (coReview) {
      const dropped = impactByName.get(name)
        .filter(path => isGitScopeFile(repoRoot, evidenceHeadSha, path))
        .filter(path => !scope.includes(path))
      if (dropped.length > 0) {
        throw new AuditError(`${name} 的 coReview scope 不得移除受影响的 base scope 路径:${dropped.join('、')}`)
      }
    }
    if (result.change === 'modified' && !hasCommittedChange(repoRoot, normalizedBaseSha, evidenceHeadSha, scope)) {
      throw new AuditError(`${name} 标记 modified,但 base 与功能提交之间的 registry/scope 没有变化`)
    }
    nextEntries.set(name, {
      round: plan.round,
      lastAuditedAt: now,
      change: result.change,
      status: result.status,
      evidence: {
        kind: 'scope-v1',
        baseSha: normalizedBaseSha,
        headSha: evidenceHeadSha,
        itemDigest: registryItemDigest(item),
        scope,
        scopeDigest: computeGitScopeDigest(repoRoot, evidenceHeadSha, scope),
      },
      notes: result.notes ?? null,
      findings,
    })
  }

  for (const [name, entry] of nextEntries) ledger.items[name] = entry

  // 本轮全部审计完 → 进入下一轮
  ledger.round = Math.max(ledger.round, plan.round)
  const unaudited = graph.components.filter(name => (ledger.items[name]?.round ?? 0) < ledger.round)
  if (unaudited.length === 0) ledger.round += 1

  ledger.version = LEDGER_VERSION
  ledger.lastRunAt = now
  ledger.lastPicked = [...nextEntries.keys()]

  await writeLedgerAtomic(ledgerPath, ledger, rawLedger)
  return {
    picked: [...plan.picked],
    coReviewed: impacted,
    recorded: [...nextEntries.keys()],
    round: ledger.round,
    headSha: evidenceHeadSha,
  }
}

// —— 证据校验:在任意树(PR synthetic merge tree 或 main)上重算 digest ——
//
// holds   verified 且 digest 一致:证据成立;在 canonical main 上即 landed
// stale   scope-v1 的 item/scope 已变化:证据失效,无论 status 都 fail closed(exit 1)
// legacy  v1 迁移产物,无 digest:下次审计该组件时补齐,不判失败
// deferred 仍单独列出 open finding,但其 scope-v1 evidence 也必须可重算
export async function verifyLedger({ repoRoot, ledger, graph }) {
  const report = { holds: [], stale: [], legacy: [], deferred: [], unaudited: [] }
  for (const [name, entry] of Object.entries(ledger.items).sort(([a], [b]) => a.localeCompare(b))) {
    if (entry.status === null) {
      report.unaudited.push(name)
      continue
    }
    const item = graph.byName.get(name)
    if (!item || item.type !== 'registry:component') {
      report.stale.push({ name, reason: 'registry item 已删除、改名或不再是 component' })
      continue
    }
    const deferred = entry.status === 'deferred'
    if (deferred) {
      report.deferred.push({ name, openFindings: (entry.findings ?? []).filter(finding => finding.disposition === 'open').length })
    }
    if (entry.evidence.kind === 'legacy-v1') {
      report.legacy.push(name)
      continue
    }
    if (registryItemDigest(item) !== entry.evidence.itemDigest) {
      report.stale.push({ name, reason: 'registry item 拓扑或公开 metadata 已变化' })
      continue
    }
    let digest = null
    try {
      digest = await computeScopeDigest(repoRoot, entry.evidence.scope)
    }
    catch {
      report.stale.push({ name, reason: 'scope 文件缺失或不可读' })
      continue
    }
    if (digest !== entry.evidence.scopeDigest) {
      report.stale.push({ name, reason: 'scope 内容与审计时不一致' })
    }
    else if (!deferred) {
      report.holds.push(name)
    }
  }
  return report
}
