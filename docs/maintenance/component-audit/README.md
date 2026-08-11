# 存量组件每日审计

每天 7:00 由本地 scheduled task `geist-component-audit` 触发,按依赖簇扫描 registry 分发组件,
判断是否需要晋升、精简、优化、重构。每次触发都是全新 session,跨天连贯性全靠本目录的 `ledger.json`。

## 权限边界:main 只读,分支交付,人工合并

`main` 永远是 canonical truth。scheduled task 对 `main` 只读:

- 每次扫描从实时最新 `origin/main` 的精确 SHA 建独立 worktree + 独立分支;
- 允许执行到:scan → 分支/worktree → 实现 → tests → commit → push 分支 → 创建/更新 Draft PR,然后停止;
- 未经人工明确授权,不得:push `main`、merge PR、squash merge、close finding(`wont-fix` 判定属于人工)、
  删除远端分支、把 Draft PR 转 ready、启用 auto-merge;
- 审计报告与 `ledger.json` 更新也走 PR 分支,**禁止直推 main**;PR 合并后才进入 canonical main。

> main protection 的强制执行还需要 GitHub 仓库侧的 branch protection / ruleset(禁止直推、要求 PR 与
> checks),那部分只能由仓库管理员在 GitHub 设置,不在本仓库代码内。

## 状态模型（v2：change、status 与 evidence）

v1 的单一 `verdict`(clean / improved / deferred)混淆了「改没改」和「审没审完」,v2 拆成两轴:

| 字段 | 取值 | 含义 |
|---|---|---|
| `change` | `none` / `modified` | 本次审计是否改了代码 |
| `status` | `deferred` / `verified` | `deferred` = 尚有 open finding；`verified` = 没有 open finding 且证据完整 |
| `evidence` | `legacy-v1` / `scope-v1` | 历史来源，或绑定基线、功能提交、registry item 与 scope 的可验证证据 |

状态机是严格的：存在 `open` finding 必须为 `deferred`；`verified` 不得含 `open` finding。
`landed` 是派生态，不落盘：`verified` 且 evidence 在 canonical main 上重算一致，即为 landed。
开放 PR 的状态不会提前出现在 main 的 ledger 里 —— ledger 更新随 PR 走,合并才算数。

finding 是结构化对象：`{ id, severity(critical/high/medium/low), claim, evidence, disposition(open/resolved/wont-fix) }`。
`id` 由 `sha256(item + evidence)` 前 12 位派生,稳定可追踪;`claim` 记录被违反的公开声明
(universal claim:never / always / safe / all / 绝不 / 所有 / 始终 / 完全安全)。存在已知反例时,
要么修实现补证据,要么收窄公开 claim;不得一边记录 deferred 反例一边把同一 claim 判为 verified。

已有 `open` finding 在下一次 record 中必须按原 `id` 显式保留或标记 `resolved`，不能靠省略删除；
新 finding 只能以 `open` 建立。`wont-fix` 仅限人工明确授权的
`--allow-wont-fix`，scheduled task 不得使用。

## 证据：绑定精确功能提交与 registry 拓扑

`lastAuditedSha` 单独证明不了完成状态（base 前进、squash merge 都会让它失真）。新的
`scope-v1` evidence 同时记录：

- `baseSha`：审计计划来源的精确 main SHA；
- `headSha`：已提交的功能快照；`--record` 从这个 commit 的 Git blob 计算证据；
- `itemDigest`：registry item 的名称、类型、公开 metadata、`files[]`、registry/package dependencies；
- `scope` / `scopeDigest`：owning files、相关 tests、gallery、权威 references 的内容摘要。

scope 强制并入该 item 当前的全部 registry `files[]`，拒绝非规范路径、symlink 与
`docs/maintenance/component-audit/**`。CI 在 PR synthetic merge tree 上重算 scope 与 item digest：
内容或 registry 拓扑变化会成为 stale，删除/改名也不能让旧证据继续成立。squash merge 虽会改变
commit SHA，但内容和 item 拓扑相同，证据仍成立。
`scope-v1` digest 对 `verified` 与 `deferred` 都会重算；`deferred` 只表示仍有 open finding，
不能让已记录的 evidence 绕过 stale 检查。

当计划内的功能改动命中其他条目在 base ledger 中已记录的 `scope-v1` scope，或改变其 registry
item topology / 公开 metadata 时，这些条目会成为 **required co-review owner**。recorder 从 base
evidence、当前 registry 与 `base..HEAD` 的已提交 Git diff 自动推导完整 owner 集合；调用方必须在
同一 results JSON 中为每个 owner 提交带 `coReview: true` 的完整复审结果。
计划项与 required owner 共用同一个 evidence `headSha`，并一同计入当前审计 round 与 `lastPicked`。
`deferred` owner 也必须复审；`legacy-v1`
与未审计条目没有可验证的 scope，不能借 co-review 扩入本批。

普通功能 PR 不应为刷新 stale evidence 被迫执行当天的随机排程。此时使用 `--record --affected`：
recorder 仍按同一规则自动推导 required owner，但 results 必须**恰好**等于该集合，不接收手工 owner
名单或额外条目。只因当日排程出现、却未受当前功能 diff 影响的 item 不属于该集合；若同一 item
既在当日计划中、又是 required owner，则按 affected owner 复审。该模式只更新 owner 的
审计结论、时间与 evidence；owner 原有 `round` 和全局 `round` / `lastRunAt` / `lastPicked` 均保持不变，
因此不会消费或扰动 scheduled audit 进度。
若 diff 没有命中任何 `scope-v1` owner，命令会拒绝空记账；新增未审计组件本身也不会凭空成为 owner。

v1 迁移产物使用 `{ "kind": "legacy-v1", "sha": ... }`，只保留历史来源；它不会把旧分支 SHA
误称为 main SHA，也不会用当前树伪造过去的 scope，下一次审计该组件时再升级为 `scope-v1`。

## 选簇算法

关联关系取自 `registry.json` 的 `registryDependencies`,不靠猜:

| 关系 | 分数 |
|---|---|
| A 直接依赖 B(或反向) | 3 |
| A、B 共享同一个非 hub 依赖 | 2 ×(共享数,最多计 2 个) |
| 同命名空间(`foundation-*` / `api-docs-*`) | 1 |

被超过 6 个 item 依赖的视为 hub(如被 19 个依赖的 `geist-foundation`),不产生「兄弟」边 ——
否则所有组件都因共享它而彼此「相关」,关系图失去区分度。

每天:**seed** 取本轮未审计中与上次审计集合关系分最高的(冷启动取被依赖最多的);**扩张** 沿关系图取
分最高的邻居,至 3 个组件或 1100 行源码触顶(下限 2 个);**不留孤儿** 若取完只剩 1 个则并入本批。
并列时依次比被依赖数 → 源码行数 → 名称,保证同一 ledger 状态下计划完全可复现。

在此之上,open finding 有两级优先:

- 带 `open` finding 的组件**立即重回 pool**,不因「已经扫描过」而等完整 round 结束才重新出现;
- 其中最高 severity 为 `critical` / `high` 的**插队**,排在新扫描之前(`unknown` 是 v1 迁移产物,
  不能凭空声称高优先级,只走 pool 重入)。若下一个 high item 会超过 LOC 预算,本批提前结束,
  不会拿普通新扫描填空而跳过它。

## 命令

```bash
pnpm audit:plan                          # 人读
node scripts/audit-plan.mjs --json --base <mainSha> # 机读，按该 Git 树生成计划
node scripts/audit-plan.mjs --record <result.json> --base <mainSha>
node scripts/audit-plan.mjs --record <result.json> --affected --base <mainSha>
pnpm audit:verify                        # 重算 scope + item digest（CI 同款）
node scripts/audit-plan.mjs --migrate    # 把磁盘上的 v1 ledger 原子迁移为 v2
```

取 JSON 别走 `pnpm audit:plan -- --json`:pnpm 会加三行横幅,输出不是合法 JSON。

`--record` 在 PR 分支的 worktree 里跑。普通结果必须与 `--base` Git 树推导出的计划 item
集合**严格一致**；若 recorder 推导出 required co-review owner，还必须逐项显式附加：

```json
[{
  "item": "foundation-x",
  "change": "none | modified",
  "status": "deferred | verified",
  "notes": "一句话结论",
  "scope": ["tests/component/x.spec.ts", "app/components/gallery/X.vue", "references/components/…"],
  "findings": [{ "id": "既有 finding 必填", "severity": "high", "claim": "被违反的公开声明(可选)", "evidence": "复现输入/反例", "disposition": "open | resolved" }]
}]
```

co-review 与普通结果使用同一状态机，但必须完整提供 `notes`、`scope` 与 `findings`：

```json
{
  "item": "foundation-x",
  "coReview": true,
  "change": "modified",
  "status": "deferred",
  "notes": "复审受影响的共享 scope，保留仍成立的 open finding。",
  "scope": ["foundation/components/X.vue", "references/components/x.md"],
  "findings": [{ "id": "既有 finding", "severity": "low", "claim": "…", "evidence": "…", "disposition": "open" }]
}
```

scheduled record 中的 planned item 不得标 `coReview`；计划外结果必须恰好等于 recorder 自动推导的
required owner 集合，
不能漏项、夹带无关 owner，或从 result scope 删除 HEAD 中仍存在的受影响 base scope 路径（判定
始终读取 base evidence scope）。旧路径若在 HEAD 已删除、rename 或不再是普通文件，可从新 scope
移除，但 owner 仍必须复审。co-review 是完整复审，不是 digest refresh：recorder 不会自动生成 verdict，
也不接受单独的 CLI owner 名单。禁止手改 ledger / digest 绕过该边界。

`--affected` 面向普通功能 PR，其中每个 result 都隐式是完整 co-review，可省略 `coReview: true`；
结果仍须完整提供 `change: "modified"`、`status`、非空 `notes`、非空 `scope` 与 `findings` 数组。
它不会降低 finding、scope 或 Git blob 证据校验，只把“复审受影响 owner”与“推进每日排程”拆开。
item 即使同时出现在当日计划中，也只按 affected owner 更新 evidence，且不推进其审计 round。

记录前必须先把组件、tests 与 references 等功能改动提交，且工作区完全干净。record 只读取
`HEAD` Git blob 生成证据，然后修改 ledger；报告和 ledger 再作为第二个提交。这样 `headSha`
与 digest 永远指向同一个功能快照。

生成计划时，`--base` 必须精确等于实时 `origin/main`；record 时，它必须精确等于当前 audit
分支与 `origin/main` 的 merge-base，且当前 ledger 必须与该 base 上的 canonical ledger 一致。
ledger 损坏、版本不匹配、未知 CLI 参数、Git SHA 或 digest 获取失败一律 fail closed。写入使用
带 owner 的独占 lock 包住 stale 比较与原子替换，避免并发 writer 同时通过检查；owner metadata
先完整写入临时文件，再用 hard link 原子发布，正式 lock 不会出现半写状态。残留 lock 不自动回收：
必须由人工确认 owner 已退出后清理；崩溃遗留的 `.lock.owner-*` 已被 Git 忽略，也应在同一次人工确认后
清理。所有 cleanup 都会独立尝试，失败会显式保留原始错误。`ledger.json` 由脚本维护，不要手改。

## 可调策略

`scripts/lib/audit.mjs` 顶部:`TARGET_SIZE` / `MIN_SIZE` / `LOC_BUDGET` / `HUB_DEGREE` 与三个 `SCORE_*`。
核心逻辑都在该库中,`scripts/audit-plan.mjs` 只是 CLI 壳;focused tests 在 `tests/audit-plan.test.mjs`
(`pnpm test:audit`,也随 `pnpm test:registry` 进 CI)。
