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

### 可拖动分栏（通用基座，非本 kit 独有）

典型 API 参考页是「左文档 / 右代码栏」两栏，右栏再纵向分成 Request / Response。要让这两条边界可拖动，用通用基座里的两个原语（在 starter，不在 kit 里）：

- `components/SplitPaneHandle.vue`（`<SplitPaneHandle>`）—— 纯展示 + a11y 的分隔把手：1px 分隔线（`border-default` 即 `--ui-border`）+ 居中 grip 药丸。**grip 默认隐藏（`opacity-0`），hover / 拖动中（`active`）/ 键盘 `focus-visible` 时才浮现**——静止时只剩一条素净的 hairline，符合 Geist 克制观感。药丸 hover/drag 转 `bg-primary`。`role="separator"` + `aria-orientation`/`aria-valuenow/min/max`、focus-visible 紫环、方向键/Home/End/Enter 键盘操作、`col/row-resize` 光标。**只报告意图（`dragstart`/`step`/`jump` 事件），不持有任何数值**。主轴尺寸交由消费方（纵向把手可 `self-stretch` 填满，或传 `sticky h-[calc(...)]` 做视口高钉住）。
  - **坑**：`group-hover:` 在 Tailwind v4 会被包进 `@media (hover:hover)`，所以 grip 的 hover 浮现只在有鼠标的设备上生效（触屏/无头浏览器 `hover:none` 不触发，属预期）；触屏与键盘用户靠 `active`（拖动中，非 hover 门控）和 `group-focus-visible`（非 hover 门控）两条路径拿到 grip，affordance 不会丢。别用 `transition-[opacity,background-color]` 这种带逗号的 arbitrary value——逗号会打断 Tailwind 的类名扫描、导致其后同一 `class` 里的工具类（含 `group-hover:*`）不被生成；用普通 `transition` 即可。
- `composables/useSplitPane.ts` —— 轴无关的拖动状态：持有一个数值（栏宽 px、分栏比 0–1…）+ min/max 钳制 + cookie 持久化（`useCookie`+`useState`，同 `useCodeWrap`）+ `Escape` 取消 + rAF 节流。附纯函数 `computeSplitBudgets(H, natTop, natBottom, ratio, minPane)` 实现**内容优先重分配**。命名刻意避开 `useResizable`（Nuxt UI 已有同名自动导入 composable，会被遮蔽）。

**内容优先重分配（避免内容少时留空）**：不要给短代码块强行分半高——那会在卡片里留下大片空白。规则是：

1. 两栏自然高度之和 ≤ 可用高度（fit 态）→ 两栏各按自然高度渲染，右栏整体收缩贴合内容，横向把手设 `disabled`（不可拖、无 grip）。
2. 溢出时（和 > 可用高度）→ 总高封顶为可用高度，按比例分，且**较短的一栏封顶到自然高度、把富余让给溢出的另一栏**；此时横向把手激活，拖动调比例。

实现要点：用 ResizeObserver 量两栏内部 `<pre>` 的自然高度（滚动容器封顶时 `<pre>` 仍报告完整内容高，无反馈环）；`RequestExample`/`ResponseExample` 已支持接收 `maxHeight` 预算，非 fill 态下 CodeBlock 先长到内容高再封顶滚动。断点上只在 `lg+` 启用拖动，`<lg` 回退为堆叠 + 自然高、无把手。`:style` 绑定**始终返回对象（用空串占位），绝不 `undefined`**——否则 SSR 水合时 `undefined→对象` 的过渡会被 Vue 跳过、宽/高静默不生效。断点判断用手写 `matchMedia` 监听（`onMounted` 建立），别用 VueUse `useMediaQuery`（此处水合后同步不可靠）。

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

## 为什么不用 @nuxt/content 走内容管线？

试过——content v3 靠构建时生成、运行时导入的 SQLite dump 建表，在托管 dev server 上每次重启不能稳定 re-seed（`decompressSQLDump ... Received undefined` / `no such table`），导致页面时好时坏。对一个要被分发、套用到新对话的 starter 是不可接受的可靠性风险。且 brief 本就要求「用规格模板做领域组件」，组件式组合才是正解。

## 源码参考（skill 内）

- `assets/kits/api-docs/components/CodeBlock.vue`
- `assets/kits/api-docs/components/RequestExample.vue`
- `assets/kits/api-docs/components/ResponseExample.vue`
- `assets/kits/api-docs/composables/useCodeWrap.ts`
- `assets/kits/api-docs/ApiDocsSection.vue` — 组合演示
- 基座依赖：`assets/starter/app/components/CopyButton.vue`、`assets/starter/app/composables/useCopy.ts`
- 可拖动分栏（基座）：`assets/starter/app/components/SplitPaneHandle.vue`、`assets/starter/app/composables/useSplitPane.ts`

## 不要臆造

- 不引入 `@nuxt/content` / Shiki / SQLite 来渲染这些代码块——组件式自包含即可。
- 新增领域组件前，按 `method/component-spec-template.md` 先写 anatomy → states → accessibility 规格。
- prop 名严格对齐：CodeBlock **只认 `variants`**（`{ language, code, label? }[]`，无 `samples`、无单 `code` 快捷；单块也传单元素数组）；Request/ResponseExample 用 `scenarios`（单一固定响应即传单场景单状态，select 自动隐藏）。
- CodeBlock 语言切换用 `USelect`（非 UTabs），换行状态经 `useCodeWrap` 共享，chrome 文案经 `labels` 本地化；复制不要在 CodeBlock 里重写，用共享 `CopyButton`。
