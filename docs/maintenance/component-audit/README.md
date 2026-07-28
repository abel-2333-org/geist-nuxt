# 存量组件每日审计

每天 7:00 由本地 scheduled task `geist-component-audit` 触发，按依赖簇扫描 registry 分发组件，
判断是否需要晋升、精简、优化、重构。每次触发都是全新 session，跨天连贯性全靠本目录的 `ledger.json`。

## 选簇算法

关联关系取自 `registry.json` 的 `registryDependencies`，不靠猜：

| 关系 | 分数 |
|---|---|
| A 直接依赖 B（或反向） | 3 |
| A、B 共享同一个非 hub 依赖 | 2 ×（共享数，最多计 2 个） |
| 同命名空间（`foundation-*` / `api-docs-*`） | 1 |

被超过 6 个 item 依赖的视为 hub（如被 19 个依赖的 `geist-foundation`），不产生「兄弟」边 ——
否则所有组件都因共享它而彼此「相关」，关系图失去区分度。

每天：**seed** 取本轮未审计中与上次审计集合关系分最高的（冷启动取被依赖最多的）；**扩张** 沿关系图取
分最高的邻居，至 3 个组件或 1100 行源码触顶（下限 2 个）；**不留孤儿** 若取完只剩 1 个则并入本批。
并列时依次比被依赖数 → 源码行数 → 名称，保证同一 ledger 状态下计划完全可复现。

「今天审计 A、B，B 与 C 关联，明天优先 C」由此是算法保证，不是启发式。实测一轮 10 天覆盖全部 28 个组件。

## 命令

```bash
pnpm audit:plan                          # 人读
node scripts/audit-plan.mjs --json       # 机读，routine 消费这个
node scripts/audit-plan.mjs --record <result.json>
```

取 JSON 别走 `pnpm audit:plan -- --json`：pnpm 会加三行横幅，输出不是合法 JSON。

`--record` 输入 `[{ "item", "verdict", "notes"?, "openFindings"? }]`，`verdict` 取 `clean`（达标未改）/
`improved`（有改动）/ `deferred`（发现问题未改，待办写进 `openFindings`，下次审计该组件时带出）。
`ledger.json` 由它维护，不要手改。

## 可调策略

`scripts/audit-plan.mjs` 顶部：`TARGET_SIZE` / `MIN_SIZE` / `LOC_BUDGET` / `HUB_DEGREE` 与三个 `SCORE_*`。
