# Kit：API 文档场景

一组用于「API 参考文档」页面的领域组件，用「组件规格模板」（`method/component-spec-template.md`：anatomy → states → accessibility → interaction）设计，**全部基于 Nuxt UI 原语与 Geist token 组合而成**，自包含、无内容管线依赖。

> **这是可选领域包（kit），不属于通用基座。** 只有当项目是 API 文档 / 开发者门户这类场景时才加载并装入。做 dashboard、营销站等其它项目时忽略本目录。

## 何时用

- 需要展示 REST/HTTP 端点、请求参数、多语言调用示例、响应体的页面。
- 开发者文档站、API 参考、SDK 门户。

> **搭真实项目前先读 `project-setup.md`**：本场景推荐的领域模块（i18n / content / sitemap / og-image 等）、i18n 接线方式、以及 `@nuxt/content` 的取舍都在那里。基座只给 UI，领域配置在消费项目侧完成。

## 组件清单

| 组件 | 组件名 | 职责 | 详细文档 |
|---|---|---|---|
| `CodeBlock.vue` | `<CodeBlock>` | 近单色多语言代码块基座（USelect 语言 + 复制 + 换行，无高亮器） | `code-sample.md` |
| `RequestExample.vue` | `<RequestExample>` | 按业务场景切换的请求示例（委托 CodeBlock） | `request-example.md` |
| `ResponseExample.vue` | `<ResponseExample>` | 响应示例：场景+状态切换，也覆盖单一固定响应（委托 CodeBlock） | `response-example.md` |

> **组件名不带目录前缀**：starter 的 `nuxt.config.ts` 默认 `components: [{ path: '~/components', pathPrefix: false }]`，所以 `app/components/api/CodeBlock.vue` 的模板名就是 `<CodeBlock>`（不是 `<ApiCodeBlock>`）。保持文件 basename 唯一即可。

> **端点头 / 参数表**（原 EndpointHeader / ParamsTable）已移除，待重新设计。新造时按 `method/component-spec-template.md` 走 anatomy → states → accessibility 规格，再沉淀回本 kit。

配套依赖（**已在通用基座 starter 里**，无需从 kit 复制）：
- `components/CopyButton.vue` —— 共享复制按钮：`UButton` + 可选 `UTooltip` + `useCopy`，`CodeBlock` 的复制委托给它。
- `composables/useCopy.ts` —— 剪贴板逻辑单一来源：写入委托给 VueUse 的 `useClipboard({ legacy: true })`（异步 Clipboard API + iframe/execCommand 兜底），外层保留 `copied` 态 + Geist voice toast。依赖 `@vueuse/core`（starter 已声明）。

配套 composable（随 kit 一起复制）：`composables/useCodeWrap.ts` —— 所有 CodeBlock 共享+持久化的换行状态（`useState` + cookie，SSR 安全）。

> **行内富文本：`ProseText` 递归 tokenizer + 委托 Prose 组件，别手写 `<a>` / `<code>`**。spec 作者的字段描述里会带行内 markdown。`ProseText` 是一个**极小、同步、零依赖**的行内 tokenizer（`h()` 递归渲染，不是正则一次性 replace），把字符串切成 token 后分派到设计系统组件：
>
> | 标记 | 渲染为 |
> |---|---|
> | `` `code` `` | `InlineCode` → Nuxt UI `ProseCode`（内容**不再**二次解析） |
> | `[label](url)` | **`ProseA` → `ULink`**（label 会递归解析） |
> | `**bold**` | `ProseStrong` |
> | `*em*` / `_em_` | `ProseEm` |
> | `~~del~~` | 原生 `<del>`（Nuxt UI 无对应 Prose 组件） |
>
> 要点：①**递归**解析，所以标记可嵌套（`**粗里有 `码`**`、`**[粗链接](/p)**`）。②链接是重点——手写 `<a href="/x">` 会让站内链接整页刷新；`ProseA`/`ULink` 自动判断内/外链，站内走 `NuxtLink` 客户端路由 + 预取，外链才用原生 `<a>` 并自动补 `rel`，消费方只需为外链显式传 `target="_blank"`。③`_` 斜体规则必须带**词边界前瞻/后顾**（`(?<![A-Za-z0-9])_…_(?![A-Za-z0-9])`），否则 `snake_case_name`、URL 里的下划线会被误斜体；`*` 斜体则要求内侧非空白，挡掉孤星（`func(a, b) *`）。**反例**：结构性标识符（字段名、端点 path）用的是带删除线 / truncate 的裸 `<code>`，那是刻意的领域样式，不要套 `ProseCode`。
>
> **为什么不用 `<MDC>` / 完整 markdown 引擎**（踩过的坑）：先核实真实数据——payment spec 的 194 条富文本描述**全是行内**（`code`/`link`，0 条 `**`、0 条块级 `>`/列表）。`<MDC>` 是为文件型内容管线设计的：它 per-instance 走 `useAsyncData`（异步），在一页渲染上百个实例时会 SSR→客户端 **hydration mismatch**（`<code>` 节点被包进 `<!--[-->…<!--]-->` fragment 锚点，改 props / `cacheKey` / 关 Shiki 都修不掉），且徒增体积。`markdown-it` 则输出 `v-html` 裸串，**绕过整个 Prose 组件体系**并丢掉 ULink 路由，与"复用设计系统"方向相悖。结论：**行内需求就用同步 tokenizer**（贴合设计系统、SSR 稳定、无异步）；只有当块级 markdown（引用/列表）成为真实需求时，才回头评估 MDC，别上 `markdown-it`。

### 可拖动分栏（通用基座，非本 kit 独有）

典型 API 参考页是「左文档 / 右代码栏」两栏，右栏再纵向分成 Request / Response。通用基座（starter，不在 kit 里）提供三层，从高到低：

- **`components/SplitPane.vue`（`<SplitPane>`）—— 首选入口，声明式的自包含分栏容器**。内部自己持有 `useSplitPane` + `<SplitPaneHandle>`，把断点门控、SSR 安全 sizing、min/max 钳制、键盘 + 指针接线、cookie 持久化全部封装掉。消费方只用**原始值 prop** + `#start`/`#end` 两个具名 slot：

  ```vue
  <SplitPane
    direction="row"          <!-- row=左右(竖分隔) / column=上下(横分隔) -->
    mode="fixed"             <!-- fixed=一侧固定px可拖 / ratio=按比例分 -->
    fixed-pane="end"         <!-- 哪一侧持有固定尺寸 -->
    sticky sticky-top="5rem" <!-- 把手钉成视口高长条(仅 row)，配合 sticky 内容栏 -->
    storage-key="geist-api-rail-width"
    :default-size="460" :min-size="360" :max-size="720" :min-opposite="360"
    label="Resize documentation and code panels"
  >
    <template #start> 左侧文档/指南正文 </template>
    <template #end> 右侧代码栏 </template>
  </SplitPane>
  ```

  **MDC / Nuxt Content 友好**：所有 prop 都是 `string|number|boolean` 字面量（不传函数、不传 computed ref），slot 名为 `start`/`end`，所以同一个组件在 `.vue` 页面和 markdown `::split-pane` 块里用法完全一致——将来装 `@nuxt/content` 做 guide 页零改造：

  ```md
  ::split-pane{direction="row" mode="fixed" fixed-pane="end" :default-size="460"}
  #start
  接入指南正文（**可直接写 markdown**）
  #end
  右侧代码示例
  ::
  ```

  设计边界：`SplitPane` 只管**空间分割 + 拖动**。它不知道 slot 里是什么，所以「左 Tab 切换 → 右代码联动」这类内容协调由页面持有 `activeTab`、两个 slot 各自读它来做，`SplitPane` 无需参与。**内容优先重分配（见下）刻意不折进 `SplitPane`**——那与代码卡片的封顶+滚动强耦合，属 api-docs 页专属，留在页面里，`SplitPane` 保持纯净通用。

  以下两个是 `SplitPane` 的**内部零件**，需要脱离容器单独用（比如手写更特殊的布局）时才直接碰：

- `components/SplitPaneHandle.vue`（`<SplitPaneHandle>`）—— 纯展示 + a11y 的分隔把手：1px 分隔线（`border-default` 即 `--ui-border`）+ 居中 grip 药丸。**grip 默认隐藏（`opacity-0`），hover / 拖动中（`active`）/ 键盘 `focus-visible` 时才浮现**——静止时只剩一条素净的 hairline，符合 Geist 克制观感。药丸 hover/drag 转 `bg-primary`。`role="separator"` + `aria-orientation`/`aria-valuenow/min/max`、focus-visible 紫环、方向键/Home/End/Enter 键盘操作、`col/row-resize` 光标。**只报告意图（`dragstart`/`step`/`jump` 事件），不持有任何数值**。主轴尺寸交由消费方（纵向把手可 `self-stretch` 填满，或传 `sticky h-[calc(...)]` 做视口高钉住）。
  - **坑**：`group-hover:` 在 Tailwind v4 会被包进 `@media (hover:hover)`，所以 grip 的 hover 浮现只在有鼠标的设备上生效（触屏/无头浏览器 `hover:none` 不触发，属预期）；触屏与键盘用户靠 `active`（拖动中，非 hover 门控）和 `group-focus-visible`（非 hover 门控）两条路径拿到 grip，affordance 不会丢。别用 `transition-[opacity,background-color]` 这种带逗号的 arbitrary value——逗号会打断 Tailwind 的类名扫描、导致其后同一 `class` 里的工具类（含 `group-hover:*`）不被生成；用普通 `transition` 即可。
- `composables/useSplitPane.ts` —— 轴无关的拖动状态：持有一个数值（栏宽 px、分栏比 0–1…）+ min/max 钳制 + cookie 持久化（`useCookie`+`useState`，同 `useCodeWrap`）+ `Escape` 取消 + rAF 节流。附纯函数 `computeSplitBudgets(H, natTop, natBottom, ratio, minPane)` 实现**内容优先重分配**。

  **为什么不复用 Nuxt UI 的 `useResizable`**：`useResizable(key, options)` 是给 Dashboard 面板做的，只支持**横向**拖宽（写死读 `el.parentElement.offsetWidth` + `clientX`）、支持 `%/rem/px` 单位与 collapsible 折叠，但**没有纵向、没有键盘操作（方向键/Home/End）、没有 Escape 取消、没有内容优先重分配**，而且依赖把手包裹一个真实面板 `el`。我们的需求这三块（纵向 Request/Response、键盘 a11y、`computeSplitBudgets`）它都缺，横向那一半即便能用也会造成两条边界行为不一致，所以另建一套轴无关原语。命名用 `useSplitPane` 而非 `useResizable` 只是为了和 Nuxt UI 的同名自动导入 API 区分、避免认知混淆——两者签名不同，真撞名是类型错误而非静默遮蔽。

**内容优先重分配（避免内容少时留空）**：不要给短代码块强行分半高——那会在卡片里留下大片空白。规则是：

1. 两栏自然高度之和 ≤ 可用高度（fit 态）→ 两栏各按自然高度渲染，右栏整体收缩贴合内容，横向把手设 `disabled`（不可拖、无 grip）。
2. 溢出时（和 > 可用高度）→ 总高封顶为可用高度，按比例分，且**较短的一栏封顶到自然高度、把富余让给溢出的另一栏**；此时横向把手激活，拖动调比例。

实现要点：用 ResizeObserver 量两栏内部 `<pre>` 的自然高度（滚动容器封顶时 `<pre>` 仍报告完整内容高）；`RequestExample`/`ResponseExample` 已支持接收 `maxHeight` 预算，非 fill 态下 CodeBlock 先长到内容高再封顶滚动。断点上只在 `lg+` 启用拖动，`<lg` 回退为堆叠 + 自然高、无把手。`:style` 绑定**始终返回对象（用空串占位），绝不 `undefined`**——否则 SSR 水合时 `undefined→对象` 的过渡会被 Vue 跳过、宽/高静默不生效。断点判断用手写 `matchMedia` 监听（`onMounted` 建立），别用 VueUse `useMediaQuery`（此处水合后同步不可靠）。

  - **坑（务必）：RO 回调里的 `measure()` 必须 `requestAnimationFrame` 延迟，不能同步调用**。虽然 `<pre>` 的内容高不受 budget 影响，但 RO 同时也观察了 pane **包裹层**，而包裹层高度正是 `measure()` 通过 `budgets`→`reqStyle/resStyle` 写入的——同步重测就构成「写高度→同帧再触发观察」的闭环，浏览器会抛 `ResizeObserver loop completed with undelivered notifications`。把回调合并进单个 rAF（并 `cancelAnimationFrame` 去抖、`onBeforeUnmount` 清理）即可打断同步投递链，且重分配仍在下一帧内完成、视觉无感。同理，`SplitPane` 内部量容器宽算 `max` 时也必须 rAF 延迟写入——注意**别用 VueUse 的 `useElementSize`**：它在自己的 RO 回调里同步写 ref，在这种「量尺寸→改 flex→再触发」的场景里照样闭环。直接用 `useResizeObserver` 拿 `contentRect`、在 rAF 里写自己的 `mainSize` ref 才安全。

## 如何装入项目

组件源码在 `assets/kits/api-docs/`（不在通用基座里）。装入方式：

1. 把 `assets/kits/api-docs/components/*.vue` 复制到项目的 `app/components/api/`。
2. 把 `assets/kits/api-docs/composables/useCodeWrap.ts` 复制到项目的 `app/composables/`（`CodeBlock` / `RequestExample` / `ResponseExample` 都依赖它）。
3. 确认 `CopyButton.vue` 与 `useCopy.ts` 在位——它们来自通用基座 starter（`app/components/CopyButton.vue`、`app/composables/useCopy.ts`），`CodeBlock` 的复制依赖它们。若项目不是从 starter 起的，从 `assets/starter/app/` 补齐这两份。
4. 如需组合演示，一并复制 `assets/kits/api-docs/ApiDocsSection.vue` 到 `app/components/sections/`。
5. 无需为本 kit 额外装包——组件只用 `@nuxt/ui` 原语 + Nuxt 内置 composable；唯一的第三方依赖是 `useCopy` 用到的 `@vueuse/core`，而它已在 starter 的 `package.json` 里声明。**不要**装 Shiki / `@nuxt/content`。

> **组件名不带前缀**：starter 默认 `pathPrefix: false`，所以 `app/components/api/CodeBlock.vue` 在模板里就是 `<CodeBlock>`。保持所有组件 basename 唯一，避免解析冲突。

## 组合示例：`ApiDocsSection.vue`

```vue
<template>
  <section id="api-docs" class="space-y-8">
    <CodeBlock :variants="requestSamples" />
    <ResponseExample :scenarios="responseScenarios" />
  </section>
</template>
```

`requestSamples` 形如 `[{ label: 'cURL', language: 'bash', code: '...' }, ...]`。

## Accessibility（无障碍）

- CodeBlock 的复制委托给共享 `CopyButton`：动态 `aria-label`（Copy / Copied）+ `role=status aria-live=polite` 播报；语言 USelect 的键盘导航与 `aria-*` 由 Reka UI 内置。
- ResponseExample：状态码色 + 文本双通道，不单靠颜色传达含义。
- 全部组件的色彩用 Geist 语义 token（`text-highlighted` / `text-muted` / `bg-elevated` / `border-default`），随 color-mode 明暗切换。

### 页面级结构 / 语义（review 沉淀）

装配整页时容易漏掉、但 review 必查的几条：

- **标题层级不跳级**。页面只有一个 `<h1>`（operation 标题，在 `OperationHeader`，加 `text-balance` 防孤字）；其下的字段分组标题（`FieldGroup`）必须是 `<h2>`，不要图视觉小就写成 `<h3>`/`<h4>` 造成 `h1→h3` 跳跃。**用原生语义标题 `<h1>/<h2>`，不要用 Nuxt UI 的 `ProseH*`**——`ProseH*` 是 markdown 内容管线组件（读 `mdc.headings` 配置决定是否注入 `#` 锚点、排版是长文正文尺度），本 kit 刻意不装 MDC，用它只会退化成带正文尺度的普通标题并引入隐式 MDC 依赖。这些标题是「应用界面结构」而非「渲染出的 markdown 正文」，属不同层。
- **站内链接一律 `NuxtLink`/`ULink`，页面模板里也不例外**。不止 `ProseText` 内部——页面骨架里的 logo、面包屑、"Learn more" 之类引用链接同样别手写 `<a href="/x">`（会整页刷新、丢预取）。这是基座决策表「单链接用 ULink」的延伸，最易在 header / 摘要区被漏掉。
- **提供 skip link**。`header + main` 结构要在最顶部放一个聚焦前 `sr-only`、`focus:not-sr-only` 的「Skip to content」锚点，`href="#main-content"` 指向 `<main id="main-content">`，让键盘 / AT 用户跳过 header。
- **`<img>` 显式 `width`/`height`**。即使有 `size-*` 兜底，也要写死内在尺寸防 CLS。
- **flex 子项要截断先加 `min-w-0`**。像端点 path 的 `<code class="flex-1 truncate">` 必须配 `min-w-0`，否则 flex item 默认 `min-width:auto` 不会收缩、`truncate` 失效。

### 数据层 / 类型分层（review 沉淀）

当把这几个展示组件接到**真实数据源**（自定义 spec DSL、OpenAPI 等）而不只是演示数据时，下面几条是踩过坑后的定式。注意：**kit 只 ship 这 3 个自包含展示组件（类型内联在组件里），不 ship adapter 或 `types/*`**——以下是「整页接真实数据」时在项目侧的架构建议，不是把代码塞回 kit。

- **类型分三层，依赖单向 `components → types ← adapter`**。① authoring 输入契约（spec/DSL 长什么样，如 `types/spec.ts`：`EndpointSpec` + 各 `Raw*` + `Localized`）——文档项目可直接 import 它给 `defineEndpointSpec` 做类型约束；② 领域输出类型（组件渲染 / adapter 产出，如 `types/reference.ts`：`FieldNode`、示例展示类型 `CodeVariant`/`RequestScenario`/`ResponseScenario` 等）；③ adapter 逻辑（`spec-adapter.ts`：只留转换函数 + `AdaptedSpec`）。**adapter 绝不 `import` 任何 `.vue`**——展示类型该下沉到 `types/`，让组件和 adapter 都从类型模块取，否则数据层反向依赖 UI 层，组件一改就断。
- **组件间不互相借类型**。示例场景 / 变体类型放共享 `types/`，`RequestExample`/`ResponseExample`/`CodeBlock` 各自从 `types/reference` import，别从兄弟 `.vue` 里 import（那会织成组件互相依赖的网）。
- **可空性用判别联合，让非法状态不可表达**。字段「值可空」建模成 `type Nullability = { nullable: false } | { nullable: true, when?: string }`，而不是 `value: { empty?, when? }` 这种把布尔和条件糊在一起的形状——后者能写出「不可空却带为空条件」的矛盾态。语义锁定为「字段结构上恒在、只是值可能为空」（CSV 列/JSON 键都适用），不要用它兼职表达「字段可省略」（那是请求侧 `required` 的活）。判别联合还会在 typecheck 阶段逼你把 note 生成函数的参数收窄到 `nullable: true` 分支，天然防错。
- **examples 必须走 adapter，spec 是唯一数据源**。整体 request/response 示例（`request.examples` / `response.examples`）要在 adapter 里映射成 `scenarios` 喂给组件，**别在页面里硬编码场景常量**——踩过：页面用写死的假数据，改 spec 毫无反应，因为数据链路根本没接。spec 的单一 body 就按原样渲染成一个 `json` 变体，不要伪造 spec 里不存在的 curl/node/python 变体。
- **字段锚点 id 用 slug 分段 + `.` 连接**。真实字段名带空格（`Settlement Date`）或下划线（`Order_Currency`）时，别直接拿 `name` 当 DOM id：会产生含空格的 id（`querySelector` 会崩）和与分隔符 `_` 撞车的歧义。每段 slugify（小写、非字母数字→`-`）再用 `.` 连父路径（`response-body.csv.batch.settlement-date`），fixture 实测 0 空格、0 冲突、0 前缀歧义；`name` 只留作展示，保真原始拼写。

## 为什么不用 @nuxt/content 走内容管线？

试过——content v3 靠构建时生成、运行时导入的 SQLite dump 建表，在托管 dev server 上每次重启不能稳定 re-seed（`decompressSQLDump ... Received undefined` / `no such table`），导致页面时好时坏。对一个要被分发、套用到新对话的 starter 是不可接受的可靠性风险。且 brief 本就要求「用规格模板做领域组件」，组件式组合才是正解。

## 源码参考（skill 内）

- `assets/kits/api-docs/components/CodeBlock.vue`
- `assets/kits/api-docs/components/RequestExample.vue`
- `assets/kits/api-docs/components/ResponseExample.vue`
- `assets/kits/api-docs/composables/useCodeWrap.ts`
- `assets/kits/api-docs/ApiDocsSection.vue` — 组合演示
- 基座依赖：`assets/starter/app/components/CopyButton.vue`、`assets/starter/app/composables/useCopy.ts`
- 可拖动分栏（基座）：`assets/starter/app/components/SplitPane.vue`（首选入口）、`assets/starter/app/components/SplitPaneHandle.vue`、`assets/starter/app/composables/useSplitPane.ts`

## 不要臆造

- 不引入 `@nuxt/content` / Shiki / SQLite 来渲染这些代码块——组件式自包含即可。
- 新增领域组件前，按 `method/component-spec-template.md` 先写 anatomy → states → accessibility 规格。
- prop 名严格对齐：CodeBlock **只认 `variants`**（`{ language, code, label? }[]`，无 `samples`、无单 `code` 快捷；单块也传单元素数组）；Request/ResponseExample 用 `scenarios`（单一固定响应即传单场景单状态，select 自动隐藏）。
- CodeBlock 语言切换用 `USelect`（非 UTabs），换行状态经 `useCodeWrap` 共享，chrome 文案经 `labels` 本地化；复制不要在 CodeBlock 里重写，用共享 `CopyButton`。
