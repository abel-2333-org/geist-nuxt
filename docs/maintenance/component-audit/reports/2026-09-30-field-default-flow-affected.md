# 默认值布局修改的受影响组件共审

日期：2026-09-30。功能快照：`d33f696633a5f091362ff8d6db1a99ba81a58405`；canonical base：`bfb47ec7b2cbaf5f60b2452b2349ce67cc4f76d9`。关联 PR #166。

## 范围与方法

本次只调整 FieldItem 的类型、format、默认值分组及自然换行，并更新结构测试和共享 API Docs 规范。共享规范按完整文件纳入 scope，因此 recorder 自动推导出 21 个 required co-review owner：17 项只命中该规范；FieldItem、LifecycleBadge、SchemaComposition、RelationSourcePath 还命中 FieldItem 实现或测试。

三组审查分别完整核对各 owner 实现、既有 scope、公开契约、相关测试和依赖。base 的 scope 证据均成立；registry、依赖锁文件及非本次功能 scope 内容保持不变。没有手工重算或修改 ledger digest；使用 `audit-plan.mjs --record --affected` 记录功能快照。未删 scope、未推进 scheduled audit round、lastRunAt 或 lastPicked。

## 结论

默认值仍以 `undefined` 区分缺失，保留空字符串、0、false、本地化标签、literal/translate=no、长值内部换行。类型、format、默认值属于同组；required/lifecycle 继续作为组外原子信息组。锚点、复制、递归、折叠及 native Find 逻辑保持原有边界。强化后的结构测试会拒绝缺少独立类型信息组的旧布局。

| Owner | 本轮状态 | Open finding 数 |
| --- | --- | --- |
| `api-docs-code-block` | verified | 0 |
| `api-docs-code-rail` | verified | 0 |
| `api-docs-enum-table` | verified | 0 |
| `api-docs-event-badge` | verified | 0 |
| `api-docs-field-annotation` | verified | 0 |
| `api-docs-field-group` | verified | 0 |
| `api-docs-field-item` | deferred | 1 |
| `api-docs-lifecycle-badge` | verified | 0 |
| `api-docs-lifecycle-notice` | verified | 0 |
| `api-docs-method-badge` | verified | 0 |
| `api-docs-operation-header` | verified | 0 |
| `api-docs-operation-target` | verified | 0 |
| `api-docs-relation-source-path` | verified | 0 |
| `api-docs-request-example` | verified | 0 |
| `api-docs-response-example` | verified | 0 |
| `api-docs-schema-composition` | deferred | 1 |
| `api-docs-site-search` | verified | 0 |
| `api-docs-webhook-protocol` | verified | 0 |
| `foundation-copy-button` | verified | 0 |
| `foundation-split-pane` | deferred | 1 |
| `foundation-split-pane-handle` | verified | 0 |

FieldItem 与 SchemaComposition 的历史 open findings 原样保留，既有 resolved/wont-fix 历史由 recorder 继承。本轮新增的 SplitPane finding 为存量问题：`useSplitPane.ts` 在 pointermove 后将坐标留到 RAF，若 owner pointerup 先到，stop 会取消该 RAF 并清 pending。实际源码时序 probe 为 start=100、move=124、RAF 前 up，最终仍为 100。相关实现的 base/HEAD blob 相同，本 PR 不修复该独立拖拽问题。SplitPaneHandle 的 intent-only API 无独立根因，不重复登记。

## 验证边界

- 默认值修复的主线候选相关 3 个组件测试文件 / 74 个测试及 typecheck 通过；补强后的结构测试通过。
- 相同运行时布局在固定基线完成 build 和 1440px/320px 浏览器观察。类型与默认值保持相邻；信息组内部仍可因长值或更窄容器继续换行，不承诺永远同一行。
- WebhookProtocol 独立纯函数测试 9/9 通过。
- 本机扩展组件测试出现 5 秒时间限制失败后已取消；该运行不计通过。静态 co-review 结论不替代新 head 的完整 CI、对比度、浏览器与人工视觉验收。
- PR 保持 Draft。后续 CI 结果以 PR 当前 head 的 checks 为准；本报告不授予合并、发布或部署权限。
