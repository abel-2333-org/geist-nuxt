# ApiDocsSchemaComposition `<ApiDocsSchemaComposition>`

忠实呈现 OpenAPI / JSON Schema 的**组合**（composition）：`oneOf`（恰好一个 variant 成立）、`anyOf`（至少一个成立）、`allOf`（全部成立），以及可选的 `discriminator`（payload property + wire-value 映射的**提示**，不改变验证语义）。普通字段树（`ApiDocsFieldGroup` / `ApiDocsFieldItem`）只能表达「并存的字段」——把互斥的 variants flatten 成普通字段会把**互斥读成并存**、生成 `card.token` 这类**虚构 wire path**、并丢掉三种 kind 的语义差异。本组件是那道缺口的专用件。

> 真源在 `kits/api-docs/components/SchemaComposition.vue`；根 registry target 保留 `app/components/api-docs/SchemaComposition.vue`，故模板名是 `<ApiDocsSchemaComposition>`。数据无关：只接收 presentation-neutral 的**显示模型**（`CompositionNode`），不解析 OpenAPI document、不依赖任何 consumer 的 contract 类型，所有 chrome 文案经 props 注入（i18n-ready）。

## 三种入口形态

| 场景 | 装配 |
|---|---|
| **顶层组合**（request body 本身是 oneOf） | `ApiDocsFieldGroup` 下直接放 `<ApiDocsSchemaComposition>` |
| **字段级组合**（某字段的值是 oneOf） | 给 `FieldNode` 设 `composition?: CompositionNode`；`ApiDocsFieldItem` 在子字段 collapsible **之后**委托本组件渲染 |
| **嵌套组合**（variant 内再套一层） | `CompositionVariant.composition` 递归，heading level 自动 +1（封顶 6） |

这是「组合 recipe」而非把逻辑塞进 FieldItem：flatten 进 FieldItem 会破坏其「一行字段」心智（正是 issue #31 反对的做法），纯独立组件又覆盖不了字段级嵌套，组合 recipe 与 kit 现有惯例一致（EnumTable 被 FieldItem 组合）。

## 三种 kind 的呈现

| kind | 形态 | 语义标注（eyebrow + assistive 句） |
|---|---|---|
| `oneOf` | `UTabs`（pill、xs，与 EnumTable variant tabs 同语言）+ `unmount-on-hide=false` 保留 panel DOM；一次只看一个 variant | `ONE OF (N)` + "Exactly one of the following applies." |
| `anyOf` | 纵向堆叠的 `UCollapsible` 分区，独立开合、默认收起（deep link 自动展开）；**绝不渲染成互斥 selector** | `ANY OF (N)` + "One or more of the following may apply." |
| `allOf` | 顺序全展开的分段列表（variant label 作分段小标题，无开合、无选择器）；**绝不渲染成 tabs** | `ALL OF (N)` + "All of the following apply." |

- eyebrow 用 FieldGroup 的 mono uppercase + `(N)` 计数语法；variant 的 `(N)` = 顶层字段数 + 嵌套 composition 块（**description 不计**），为 0 时隐藏，避免把「仅有说明文字」读成空内容。
- assistive 句是**可见正文**（非仅靠布局/颜色传意），`labels` 可覆盖。
- variant 顺序 = 数组顺序，渲染层不重排。
- 空 `variants` 显示空态框（`labels.empty`，英文默认 `No variants documented`）。

## Discriminator（仅 oneOf / anyOf）

**discriminator 渲染为真实字段行**（Stripe 同款），不额外发明词汇：它本就是 payload property，故合成一个 `FieldNode` 插到每个 mapped variant 的**首行**。

- 单值映射 → `type` · string · required · description "Always \`google_pay\`."；N:1 映射**聚合全部 wire values**（含空字符串 `""`）按 mapping 顺序显示为 "One of …"。`discriminatorDescription(values)` label factory 可覆盖。
- 若 caller 已提供同名字段，**保留**其 path / type / examples 等 richer metadata，把 mapping 说明并入 description，并把该行移到首行；不重复合成第二行。
- 合成行**不带 `path`**（跨 variant 重复，不可单独 deep link）；`(N)` 计数包含该行。
- 当前显示模型不表达 OpenAPI 3.2 的 `defaultMapping`：映射到 variant 的 discriminator property 一律按 OAS 3.0 / 3.1 契约**归一为 required**（caller 传 `required: false` 也会被忽略）。若未来要支持 3.2 可选 discriminator，必须先扩展模型显式表达 `defaultMapping`，不能复用这个布尔暗示版本语义。
- discriminator 只**选择** alternatives，故 typed contract 只允许它出现在 `oneOf` / `anyOf`；`allOf` 不接收 discriminator（`discriminator?: never`）。文案不得暗示 discriminator 决定校验。

## Anchor / deep-link 策略

- **不虚构 wire path**：UI 里字段名与层级只体现真实 payload 结构（`type`、`token`），任何位置不显示 `card.token` 拼接路径。
- **anchor id 是 identity 层、不是展示层**：唯一性由显示模型的 `path` 保证，约定以 variant id 做命名空间段（`request-body_card_token` vs `request-body_wallet_token`）。
- **deep link 进隐藏 variant**：`useFieldAnchor` 同时维护目标 `active` 与导航事件 `revision`，每次 `goTo(path)` 递增 revision，故同一路径在用户手动切走 tab / 收起分区后再次触发仍会重新揭示。组件 watch 两者，用 variant 全量 path 集合（含嵌套 composition）判断落点：先匹配 `active === path`（精确），再选最长 `active.startsWith(path + '_')` 前缀（避免短前缀抢占更具体的 anchor）→ oneOf 切 tab、anyOf 展开分区；随后 `useFieldAnchor` 的 waitForElement / waitForElementStable 完成滚动 + 高亮。
- oneOf panel 靠 `unmount-on-hide=false` 常驻 DOM，hash 轮询能找到隐藏元素；切 tab 后元素可见、layout 稳定即滚动。**升级 Nuxt UI 时必须确认 panel DOM 仍常驻**，否则 deep link 失效。

## 显示模型（`~/utils/field`）

组合模型与字段模型同住 `kits/api-docs/utils/field.ts`（copy-in target `app/utils/field.ts`），经 Nuxt auto-import 全局可用，组件**裸引用不 import**（同 lifecycle / method preset 惯例）；类型消费者从 `~/utils/field` 取。

```ts
type CompositionKind = 'oneOf' | 'anyOf' | 'allOf'

interface CompositionVariant {
  id: string                    // 稳定 identity：tab 选中、discriminator 映射、anchor 命名空间段；不进 wire path 展示
  label: string                 // 已本地化的 variant 标题
  description?: string
  fields: FieldNode[]           // variant 的字段树；path 为真实 anchor id
  composition?: CompositionNode // variant 内再嵌套 composition（递归）
}

interface CompositionDiscriminator {
  propertyName: string          // 判别 property，如 'type'
  mapping: Array<{ value: string, variantId: string }>  // wire value → variant id，顺序保留
}

type CompositionNode =
  | { kind: 'oneOf' | 'anyOf', variants: CompositionVariant[], discriminator?: CompositionDiscriminator }
  | { kind: 'allOf',           variants: CompositionVariant[], discriminator?: never }
```

> **schema variant 与 example scenario 是两个概念**：组件 API 不假设两者 id 相同，也不联动 scenario state（issue #31 非目标）。

## Props

| prop | 类型 | 说明 |
|---|---|---|
| （展开 `CompositionNode`） | `kind` + `variants` + `discriminator?` | 组合显示模型，直接 `v-bind` 一个 `CompositionNode` |
| `labels` | `SchemaCompositionLabels` | chrome 文案覆盖（英文默认，对齐 FieldItem 惯例）：`oneOf`/`anyOf`/`allOf` eyebrow、`oneOfHint`/`anyOfHint`/`allOfHint` assistive 句、`discriminatorDescription(values)`、`empty` |
| `fieldLabels` | `FieldItemLabels` | 透传给内部 `ApiDocsFieldItem` 行的本地化文案 |
| `headingLevel` | `3 \| 4 \| 5 \| 6` | anyOf / allOf 分区小标题的 outline 层级，默认 `4`；嵌套自动 +1、封顶 6 |

## Accessibility

- oneOf 用 `UTabs` 完整语义（tablist / tab / tabpanel、方向键、`aria-selected`），复用 Reka 内置而非重写。
- anyOf / allOf 分区标题经 `headingLevel` 进文档 outline（3–6，默认 4，嵌套 +1 封顶 6），与 FieldGroup 的 headingLevel 惯例一致。
- anyOf 的 `aria-expanded` / `aria-controls` 由真实 `<button>` 持有，`aria-controls` 指向对应内容 id；heading 只做 outline、不承担交互状态。**按钮不加 "Show/Hide" 的 sr-only 状态文本**，避免与 `aria-expanded` 重复宣告；accessible name = variant label + 非零计数。
- assistive 句是可见文本，屏幕阅读器按阅读顺序自然读到 kind 语义与 discriminator 合成行；deep link `goTo(path, { focus: true })` 把焦点落到目标行。

## 用法

```vue
<script setup lang="ts">
import type { CompositionNode } from '~/utils/field'

const paymentMethod: CompositionNode = {
  kind: 'oneOf',
  discriminator: {
    propertyName: 'type',
    mapping: [
      { value: 'card', variantId: 'card' },
      { value: 'wallet', variantId: 'wallet' },
    ],
  },
  variants: [
    {
      id: 'card',
      label: 'Card payment',
      // 不手写 type 行：组件按 mapping 合成 discriminator 字段
      fields: [
        { path: 'request-body_card_token', name: 'token', type: 'string', required: true },
      ],
    },
    { id: 'wallet', label: 'Wallet payment', fields: [/* … */] },
  ],
}
</script>

<template>
  <!-- 顶层组合：request body 本身是 oneOf -->
  <ApiDocsFieldGroup label="Request body" :heading-level="3">
    <ApiDocsSchemaComposition v-bind="paymentMethod" :heading-level="4" />
  </ApiDocsFieldGroup>
</template>
```

字段级组合交给 `ApiDocsFieldItem`——给字段设 `composition`，它在子字段之后委托本组件：

```ts
const destination: FieldNode = {
  path: 'transfer_destination', name: 'destination', type: 'object', required: true,
  children: [{ path: 'transfer_destination_reference', name: 'reference', type: 'string', required: true }],
  composition: { kind: 'oneOf', discriminator: { /* … */ }, variants: [/* bank / card */] },
}
// <ApiDocsFieldItem v-bind="destination" />
```

## 相关组件

- `<ApiDocsFieldItem>` — 本 kit 兄弟切片，渲染每个 variant 的字段行、并通过 `FieldNode.composition` 委托本组件做字段级组合。`registryDependencies` 声明 `api-docs-field-item`，其闭环（enum-table / lifecycle-badge / use-field-anchor / inline-code / inline-markdown）随 copy-in 一起拉入。
- `<ApiDocsFieldGroup>` — 顶层组合的容器（mono 大写组标题 + 计数）。
- `useFieldAnchor` — 深链接 composable（`active` + `revision` 事件驱动的重新揭示）。
- `<UTabs>` / `<UCollapsible>` — Nuxt UI 原语（oneOf tabs / anyOf 分区）。

## 规格与源码

- 规格模板见 `method/component-spec-template.md`。
- 源码：`kits/api-docs/components/SchemaComposition.vue`；显示模型在 `kits/api-docs/utils/field.ts`（与 FieldItem 共用）。组件测试见 `tests/component/schema-composition.spec.ts`。
