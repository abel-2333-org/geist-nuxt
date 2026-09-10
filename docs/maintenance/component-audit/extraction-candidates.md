# 组件抽取候选登记

跨组件重复实现的候选与**已否决结论**的常驻登记表。审计的两种扫描都往这里写:

- **每日反向横扫**(`SKILL.md` §5):当日簇的特征模式在全仓反查,命中簇外重复时在此登记评估;
  重复本身**不产生 finding**——只有重复确实导致行为契约不一致(如同一意图的两处实现对同一输入给出不同结果)时,才另记 finding 走 ledger;
- **轮末横切扫描**(`SKILL.md` §5b,每轮首日 `roundRollover`):不按依赖图,横向比对全部分发组件。

采纳标准见 `references/method/component-reflow.md`。抽取跨多个组件、属破坏性改动,**采纳与否一律由人工决定**;
扫描本身不改代码、不写 `ledger.json`。

## 为什么在仓库里而不在 GitHub issue 里

历史上这份登记是 tracking issue [#93「组件抽取候选」](https://github.com/abel-2333-org/geist-nuxt/issues/93)(已于 2026-09-10 关闭,关闭说明指回本文件)。
问题在于**每日**反向横扫读不到它——issue 只在每轮首日被打开一次,日常扫描命中重复时只能重新推导,
或按日期交叉引用历史报告,记忆随报告堆积而退化。放进仓库后,任何一次扫描都能直接读到已否决结论,
不必发网络请求,也与本目录 `ledger.json` / `reports/` 的「证据进仓库、可重算」一致。

本文件位于 `docs/maintenance/component-audit/**`,该前缀被 evidence scope 明确排除(见 `README.md`),
因此每轮追加**不会**让任何 item 的 scope digest 变 stale,也不触发 co-review。

**issue 的职责收窄为纯 backlog**:只在存在「待人工拍板的实现候选」时开启;已否决结论不再写回 issue。
待决策候选清空后由**人工**关闭,scheduled task 只在简报里提出建议,不自行关闭 issue。

## 状态图例

| 状态 | 含义 |
|---|---|
| 已落地 | 人工采纳并由实现 PR 完成,保留条目仅供追溯 |
| wont-fix | 人工明确否决,不再重新评估 |
| 不建议抽取 | 扫描已完整评估、结论为净收益不足,**不再重新评估**;新增反例才重开 |
| 待决策 | 有待人工拍板,同时应在 GitHub backlog issue 中出现 |

当前**无待决策候选**。

## 已了结候选(追溯)

| # | 候选 | 状态 | 去向 |
|---|---|---|---|
| 1 | rAF 合并的测量调度器 → `useRafTask` | 已落地 | issue #95 / PR #96 |
| 2 | 路由路径 trailing-slash 归一化 | wont-fix | 人工判定 2026-08-14;`'//'` 无已知消费者,新增共享 registry item 与两条 dependency/co-review 的长期成本高于该异常输入风险 |
| 5 | scenario 受控选择 seam → `useExampleScenarioSelection` | 已落地 | issue #102 / PR #103,finding `f-a35a4e313b64` resolved |

## 已评估:不建议抽取

以下条目**已完整评估过,后续扫描不要重复评估**。只有出现新的调用点或新反例时才重开。

### 3. chrome labels 合并 idiom

- **涉及**:11 个分发组件(AnnotationPopover、TermAnnotation、DocAnnotation、FieldAnnotation、FieldItem、CodeBlock、RequestExample、ResponseExample、OperationTarget、SchemaComposition、RelationSourcePath)
- **重复的是**:`const t = computed(() => ({ ...defaults, ...props.labels }))` 约 5 行样板
- **不建议的理由**:每处真正的价值在 per-component 的 `Required<Pick<…>>` 类型收窄与透传键排除,抽通用 composable 后类型仍需逐组件声明,净节省 < 3 行、多一层间接
- **登记于**:Round 2 首日横切(2026-08-14)

### 4. requiredness 标记 markup

- **涉及**:`FieldItem.vue` 与 `FieldAnnotation.vue` 的 `text-error / text-warning` uppercase 标记(2 处)
- **不建议的理由**:派生逻辑已共享(`utils/field.ts` `fieldRequiredState`,references 明确「行与 popover 不漂移」钉在共享派生上);视觉 markup 每处 2 行,抽原子组件收益为负
- **登记于**:Round 2 首日横切(2026-08-14)

### 6. FieldItem constraints 表 × EnumTable 值表的 bordered subgrid 模板

- **涉及**:`kits/api-docs/components/FieldItem.vue`(≥2 条 constraint 的带计数表)、`kits/api-docs/components/EnumTable.vue`(允许值表)
- **重复的是**:`grid grid-cols-[fit-content(…)_1fr] gap-x-4 divide-y divide-default` 外框 + 行级 `col-span-2 grid grid-cols-subgrid items-baseline gap-y-1 bg-muted/40 px-3 py-2.5` 的双列 subgrid fact 表模板
- **不建议的理由**:仅 2 个调用点且语义分叉——列宽上限不同(8rem vs 12rem)、dt 内容不同(uppercase label vs `InlineCode` 值 + Default 标记)、EnumTable 外层滚动框另持有 border / 焦点 / tab-stop 职责,抽共享原子后这些差异仍需逐点参数化;需新 registry item 且两个 item 拓扑变化,净收益约 10 行。「两个表读作同一语言」的对齐已由 EnumTable 源码注释与 `LABEL (N)` 计数 grammar 钉住,漂移会被 review 面直接看到
- **登记于**:Round 3 首日横切(2026-08-29)

### 7. 溢出探测 `scrollSize > clientSize + 1`

- **涉及**:`kits/api-docs/components/EnumTable.vue`(纵向,`useRafTask` 合帧 + ResizeObserver)、`kits/api-docs/components/OperationTarget.vue`(横向,ResizeObserver 回调同步测量)
- **重复的是**:「实测 DOM 溢出才加 affordance」的一行比较式(含 `+1` 容差)
- **不建议的理由**:rAF 调度样板已由候选 1(PR #96 `useRafTask`)收敛,残余重复只剩一行比较;两处轴向、调度时机与下游写入(键盘 tab stop vs 右缘渐隐)全部不同,抽 `useOverflowProbe` 之类的 composable 需要参数化的差异点多于共享行数
- **登记于**:Round 3 首日横切(2026-08-29)

### 8. 框内空态面板模板

- **涉及**:`kits/api-docs/components/CodeBlock.vue` 空态、`kits/api-docs/components/ResponseExample.vue` 的 `empty` / `unavailable` 面板(逐类相同)与 `file` 面板(近变体:`gap-3 py-10` + 文件名 + 下载链接),共 3+1 处
- **重复的是**:`flex flex-col items-center justify-center gap-2 px-6 py-12 text-center` + `UIcon size-8 text-dimmed` + `p text-sm font-medium text-highlighted` + `p max-w-xs text-sm text-muted`
- **不建议的理由**:核证 `@nuxt/ui` 4.9.0 已带的 `UEmpty` 原语**不能**直接替换——其 title 硬编码为 `<h2>`(每个空代码块都会向 API 文档大纲注入一个「No example available」标题,a11y 回退)、icon 经 `UAvatar` 带圆形底、根节点自带 `rounded-lg ring` 与响应式 `p-4 → p-8`,面向页面 / 面板级空态而非框内 body 面板。若抽 kit 内部原子需新增 registry item 且两个 item 拓扑变化,净收益约 15 行,与候选 6 / 7 的尺度同构
- **登记于**:2026-09-08 每日反向横扫(评估与依据见 `reports/2026-09-08.md`)

## 扫描覆盖史

轮末横切按此记录做**增量**比对,不必每轮重跑全量维度。

| 轮次 | 日期 | base | 覆盖 |
|---|---|---|---|
| Round 2 首日 | 2026-08-14 | `f56dd74` | class 组合(eyebrow / fact-row / wrap 族)、labels 契约形状、live region(7 处)、键盘 / 焦点(集中于 SplitPaneHandle / AnnotationPopover / useSplitPane)、测量副作用(ResizeObserver / matchMedia / rAF)、utils 格式化逻辑 |
| Round 3 首日 | 2026-08-29 | `085b77d` | subgrid / dl 表格族(含 internal `FactList` / `FactRow` 归属确认)、溢出测量副作用、eyebrow class 两档分层、demo/gallery 私有组件重复、`foundation/compositions` 结构相似度 |

- **live region(7 处)**:契约已刻意统一为 results-announcement 家族,实现语义各异,不建议抽。
  2026-09-10 后 `CopyButton` / `OperationTarget` 的复制播报改由应用级 toast 承担(PR #120),该家族成员减少,结论不变。
- **demo / gallery 私有组件**(`app/components/demo/api-docs/` DocsShell×4):四个文件各司其职(壳 chrome / 指南子页 / 参考正文 / 域切换器),
  与 gallery 参考页之间的相似段落属 copy-and-adapt recipe 分层的刻意成本(「组合方式不作为切片分发」);抽取会把 demo 变成抽象层,与分层规则相悖,不抽取。
- **`foundation/compositions` 结构相似度**:目前仅 `AppHeader.vue` 一个文件,无相似度可比,维度闭合。
- **截至 Round 3**:分发面全量维度已过一遍,无未比对维度遗留。Round 4 起按此后新增 / 晋升的组件做增量比对。
