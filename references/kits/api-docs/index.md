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

## 不要臆造

- 不引入 `@nuxt/content` / Shiki / SQLite 来渲染这些代码块——组件式自包含即可。
- 新增领域组件前，按 `method/component-spec-template.md` 先写 anatomy → states → accessibility 规格。
- prop 名严格对齐：CodeBlock **只认 `variants`**（`{ language, code, label? }[]`，无 `samples`、无单 `code` 快捷；单块也传单元素数组）；Request/ResponseExample 用 `scenarios`（单一固定响应即传单场景单状态，select 自动隐藏）。
- CodeBlock 语言切换用 `USelect`（非 UTabs），换行状态经 `useCodeWrap` 共享，chrome 文案经 `labels` 本地化；复制不要在 CodeBlock 里重写，用共享 `CopyButton`。
