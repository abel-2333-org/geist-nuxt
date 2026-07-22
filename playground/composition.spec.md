# SchemaComposition（playground 候选 spec）

> 私有 spec：随候选组件留在 `playground/`，晋升时按 component-reflow 处置（采纳 → 精华并入 references，删除本文件）。对应 issue #31。

## 目标

忠实呈现 OpenAPI / JSON Schema composition：`oneOf`（恰好一个 variant 成立）、`anyOf`（至少一个成立）、`allOf`（全部成立）、`discriminator`（payload property + wire-value mapping 的提示，不改变验证语义）。当前 `ApiDocsFieldItem` / `ApiDocsFieldGroup` 只能呈现普通字段树；把 variants flatten 成普通字段会把互斥读成并存、生成 `card.token` 这类虚构 wire path、丢失三种 kind 的语义差异。

## 形态裁决（issue 设计目标三选一 → 选 3：组合 recipe）

| 组件 | 归属目标 | 职责 |
|---|---|---|
| `SchemaComposition`（→ `ApiDocsSchemaComposition`） | kits/api-docs | composition 块的全部呈现：kind 语义头、discriminator、variant 分形态、递归 |
| `ApiDocsFieldItem`（晋升时扩展） | kits/api-docs | `FieldNode` 增加 `composition?: CompositionNode`，字段级 composition（某字段的值是 oneOf）委托给 SchemaComposition 渲染 |
| `ApiDocsFieldGroup` | 不改 | 顶层 composition（request body 本身是 oneOf）由 FieldGroup 下直接放 SchemaComposition |

理由：flatten 进 FieldItem 会破坏其"一行字段"心智且正是 issue 反对的做法；纯独立组件覆盖不了字段级嵌套；组合 recipe 与 kit 现有切片惯例一致（EnumTable 被 FieldItem 组合）。

## Display model（presentation-neutral）

组件只接收显示模型，不解析 OpenAPI document，也不依赖任一 consumer 的 Contract 类型：

```ts
type CompositionKind = 'oneOf' | 'anyOf' | 'allOf'

interface CompositionVariant {
  /** 稳定 identity：tab 选中、discriminator mapping 与 anchor 命名空间；不进入 wire path 展示 */
  id: string
  /** 已本地化的 variant 标题 */
  label: string
  description?: string
  /** variant 的字段树；path 为真实 anchor id（见 anchor 策略） */
  fields: FieldNode[]
  /** variant 内再嵌套 composition（递归） */
  composition?: CompositionNode
}

interface CompositionDiscriminator {
  /** payload 中的判别 property，如 `type` */
  propertyName: string
  /** wire value → variant id 的完整 mapping，顺序保留 */
  mapping: Array<{ value: string, variantId: string }>
}

interface CompositionNode {
  kind: CompositionKind
  /** 顺序保留、id 稳定 */
  variants: CompositionVariant[]
  discriminator?: CompositionDiscriminator
}
```

- props = `CompositionNode` 展开 + `labels?`（chrome 文案，英文默认，对齐 FieldItem 惯例）+ `fieldLabels?`（透传 FieldItem）+ `headingLevel`。
- **schema variant 与 example scenario 是两个概念**：组件 API 不假设两者 id 相同，也不联动 scenario state（issue 非目标）。

## 三种 kind 的呈现

| kind | 形态 | 语义标注 |
|---|---|---|
| `oneOf` | `UTabs`（pill、xs，与 EnumTable variant tabs 同语言）+ `unmount-on-hide=false` 保留 panel DOM；一次只看一个 variant | eyebrow `ONE OF (N)` + "Exactly one of the following applies." |
| `anyOf` | 纵向堆叠的 `UCollapsible` 分区，独立开合，默认收起（deep link 自动展开）；**绝不渲染成互斥 selector** | eyebrow `ANY OF (N)` + "One or more of the following may apply." |
| `allOf` | 顺序全展开的分段列表（variant label 作分段小标题，无开合、无选择器）；**绝不渲染成 tabs** | eyebrow `ALL OF (N)` + "All of the following apply." |

- eyebrow 用 FieldGroup 的 mono uppercase + `(N)` 计数语法；assistive 句是可见正文（非仅靠布局/颜色传意），labels 可覆盖。
- variant 顺序 = 数组顺序，渲染层不重排。

## Discriminator（仅 oneOf/anyOf 会出现）

- **单一词汇原则**（评审修订）：初版曾用 `DISCRIMINATED BY` 头 + wire-value mapping 表 + variant panel 内 `SENT AS` 三层标注，与 `ONE OF` eyebrow 并存四套词汇；mapping 表枚举的 variant 与 tabs 完全重复，点击行为也相同。收敛为：
  - discriminator 并入 assistive 句成一句话："Exactly one of the following applies. `type` selects the variant."（`discriminatorHint` label 可覆盖后半句）。
  - **不再渲染独立 mapping 表**——variant 选择器（tabs / 分区）本身就是完整枚举。
  - variant 的 wire 形态保留为无标签 code chip：oneOf panel 首行 `type = "card"`，anyOf 分区标题内联同款 chip。头部句已建立 `type` 的语境，chip 无需再引入 `SENT AS` 词汇。
- 文案不得暗示 discriminator 决定校验——它只是提示，验证语义仍由 kind 表达。

## Anchor / deep-link 策略

- **不虚构 wire path**：UI 中字段名、层级只体现真实 payload 结构（`type`、`token`），任何位置不显示 `card.token` 拼接路径。
- **anchor id 是 identity 层，不是展示层**：唯一性由 display model 的 `path` 保证，约定以 variant id 做命名空间段（`request-body_card_token` vs `request-body_wallet_token`），两层分离在此明确。
- **deep link 进隐藏 variant**：组件 watch `useFieldAnchor().active`，用 variant 全量 path 集合（含嵌套 composition）做 `=== p || startsWith(p + '_')` 判断目标落点 → oneOf 切 tab、anyOf 展开分区；随后 `useFieldAnchor` 现有 waitForElement/waitForElementStable 完成滚动+高亮，**不改 composable**。
- oneOf panel 靠 `unmount-on-hide=false` 保留 DOM，hash 轮询能找到隐藏元素；切 tab 后元素可见、layout 稳定即滚动。

## Anatomy

| 部位 | 是否使用 | 映射到 |
|---|---|---|
| container | 是 | `<section>` 纵向堆叠：语义头 → discriminator → variants |
| label | 是 | kind eyebrow（mono uppercase + count）+ assistive 句 |
| value | 是 | variant panel：wire 标注 → description → `ApiDocsFieldItem` 列表 → 嵌套 composition（递归） |
| icon | 可选 | anyOf 分区 chevron，装饰性 `aria-hidden` |
| action | 可选 | anyOf 分区开关 |
| helper text | 是 | assistive 句（含 discriminator 后半句，labels 可覆盖） |
| error text | — | 无网络/异步，不需要 |
| affordance | 是 | tabs pill 选中态；anyOf chevron 旋转 |
| focus target | 是 | 真实 button（tab / 分区开关），`focus-visible` 环 |

## State model

| 状态 | 表现 |
|---|---|
| default | oneOf 显示首个 variant；anyOf 全收起；allOf 全展开 |
| tab selected | UTabs pill 选中；未选 panel `hidden`（DOM 保留） |
| open / closed | anyOf 分区 chevron 旋转 + 内容显隐（`unmount-on-hide=false`） |
| active-anchor | 目标行高亮（FieldItem 现有行为）；祖先 variant 自动切换/展开 |
| focus-visible | tabs（reka 内置）与自绘 button `outline-primary` 环 |
| 空 variants | 空态框（`labels.empty`，英文默认） |
| 长 label | tab / 分区标题截断不破版；CJK 正常换行 |

## Accessibility

- oneOf 用 UTabs 完整语义（tablist/tab/tabpanel、方向键、`aria-selected`）——确认 reka 内置而非重写。
- anyOf/allOf 分区标题经 `headingLevel` 进文档 outline（默认 4，嵌套自动 +1，封顶 6），与 FieldGroup 的 headingLevel 惯例一致。
- assistive 句为可见文本，屏幕阅读器按阅读顺序自然读到 kind 语义与 discriminator。
- reading order：语义头（含 discriminator 句）→ variants；deep link `goTo(path, { focus: true })` 把焦点落到目标行（composable 现有行为）。

## 晋升注意事项

- **必做**：`CompositionNode` 等类型与组件一起晋升时，同步把 `FieldNode` 抽到 `kits/api-docs/utils/field.ts`（annotation.spec.md 已记录同一要求，合并处理）；`FieldNode` 增加 `composition?: CompositionNode`，FieldItem 在 children collapsible 之后委托 `ApiDocsSchemaComposition` 渲染字段级 composition。
- registry 新切片 `api-docs-schema-composition`：registryDependencies 含 field-item（及其闭环 enum-table / lifecycle-badge / use-field-anchor / inline-code / inline-markdown）。
- component tests 覆盖：full（oneOf + discriminator + nested）/ partial（无 discriminator、无 description、空 variants）/ anyOf 非互斥（两分区可同开）/ allOf 无选择器 / discriminator 句与 wire chip 渲染 / deep link 进隐藏 variant / anchor 唯一性。
- isolated consumer fixture（payment-method）只经 display model 接入，不 import 任何 OpenAPI 解析物。
- oneOf panel 目前依赖 UTabs `unmount-on-hide=false`；晋升时确认 Nuxt UI 版本升级不回归（panel DOM 必须常驻，否则 deep link 失效）。

## Playground 验证清单（component-reflow §2）

三 kind 语义互不混淆 / discriminator 句 + wire chip 可读 / deep link 进隐藏 tab 与收起分区（切换 + 滚动 + 高亮）/ 嵌套 composition 递归 / 空 variants 空态 / light / dark / 390 / 960 / 1440 / 键盘（tabs 方向键、分区 Enter/Space）/ reduced-motion 不闪 / console 无错误。
