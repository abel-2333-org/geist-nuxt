# 存量组件每日审计

每天早上 7:00（Asia/Shanghai）由本地 scheduled task `geist-component-audit` 触发，扫描 registry 分发组件，
判断是否需要**晋升、精简、优化、重构**，产出一个可评审的 PR。

目标不是「今天改了什么」，而是让 `foundation/` 与 `kits/` 长期保持干净优雅，
使下游通过 registry copy-in 的消费项目使用体验持续变好。

## 为什么需要 ledger

每次触发都是全新 session，没有昨天的记忆。连贯性完全由本目录的 `ledger.json` 承载：
它记录每个组件的审计轮次、时间、结论和遗留待办，`scripts/audit-plan.mjs` 据此推导今天该审计谁。

## 选簇算法

关联关系直接取自 `registry.json` 的 `registryDependencies`，不靠猜：

| 关系 | 分数 |
|---|---|
| A 直接依赖 B（或反向） | 3 |
| A、B 共享同一个非 hub 依赖 | 2 ×（共享数，最多计 2 个） |
| 同命名空间（`foundation-*` / `api-docs-*`） | 1 |

被超过 6 个 item 依赖的 item 视为 hub（如 `geist-foundation`），不产生「兄弟」关系边 ——
否则所有组件都会因为共享它而彼此「相关」，关系图失去区分度。

每天的取法：

1. **seed** — 在本轮未审计的组件里，取与「上次审计集合」关系分最高的那个；冷启动时取被依赖最多的组件（改动收益面最大）。
2. **扩张** — 沿关系图继续取分数最高的邻居，直到 3 个组件或 1100 行源码预算触顶（下限 2 个）。
3. **不留孤儿** — 若取完后本轮只剩 1 个组件，直接并入本批。

这样「今天审计 A、B，B 与 C 关联，明天优先 C」是算法保证的结果，不是启发式。
实测一轮 10 天覆盖全部 28 个分发组件。

排序并列时依次比较：被依赖数 → 源码行数 → 名称，保证同一 ledger 状态下计划完全可复现。

## 命令

```bash
pnpm audit:plan                          # 人读：打印今天该审计哪几个组件
node scripts/audit-plan.mjs --json       # 机读：routine 消费这个
node scripts/audit-plan.mjs --record <result.json>
```

取 JSON 时直接调 node，不要走 `pnpm audit:plan -- --json`：pnpm 会在前面加三行脚本横幅，输出就不是合法 JSON 了。

`--record` 的输入是一个数组：

```json
[{ "item": "api-docs-field-item", "verdict": "improved", "notes": "...", "openFindings": ["..."] }]
```

`verdict` 取值：

- `clean` — 已符合规范，本次无改动
- `improved` — 本次有实际改动
- `deferred` — 发现问题但本次未改（原因写进 `notes`，待办写进 `openFindings`，下次审计该组件时会带出来）

## 产物

- `reports/YYYY-MM-DD.md` — 当日审计报告（每个组件的结论、依据的规则源、改了什么、为什么没改）
- `ledger.json` — 状态，由 `--record` 维护，不要手改
- PR 分支 `chore/component-audit-YYYY-MM-DD`

## 可调策略

`scripts/audit-plan.mjs` 顶部的常量：`TARGET_SIZE` / `MIN_SIZE` / `LOC_BUDGET` / `HUB_DEGREE` 与三个 `SCORE_*`。
调完跑一遍 `pnpm audit:plan` 确认计划仍然合理。
