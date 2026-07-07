# Kit：API 文档场景

一组用于「API 参考文档」页面的领域组件，用「组件规格模板」（`method/component-spec-template.md`：anatomy → states → accessibility → interaction）设计，**全部基于 Nuxt UI 原语与 Geist token 组合而成**，自包含、无内容管线依赖。

> **这是可选领域包（kit），不属于通用基座。** 只有当项目是 API 文档 / 开发者门户这类场景时才加载并装入。做 dashboard、营销站等其它项目时忽略本目录。

## 何时用

- 需要展示 REST/HTTP 端点、请求参数、多语言调用示例、响应体的页面。
- 开发者文档站、API 参考、SDK 门户。

> **搭真实项目前先读 `project-setup.md`**：本场景推荐的领域模块（i18n / content / sitemap / og-image 等）、i18n 接线方式、以及 `@nuxt/content` 的取舍都在那里。基座只给 UI，领域配置在消费项目侧完成。

## 组件清单

| 组件 | 自动导入名 | 职责 | 详细文档 |
|---|---|---|---|
| `EndpointHeader.vue` | `<ApiEndpointHeader>` | HTTP method badge + 端点路径 + 描述 | `endpoint-header.md` |
| `ParamsTable.vue` | `<ApiParamsTable>` | 参数表：名称 / 类型 / required / 说明 | `params-table.md` |
| `CodeSample.vue` | `<ApiCodeSample>` | 自包含多语言代码块（UTabs + 复制） | `code-sample.md` |
| `ResponseBlock.vue` | `<ApiResponseBlock>` | 状态码 badge + 响应 body（复用 CodeSample） | `response-block.md` |

## 如何装入项目

组件源码在 `assets/kits/api-docs/`（不在通用基座里）。装入方式：

1. 把 `assets/kits/api-docs/components/*.vue` 复制到项目的 `app/components/api/`。
2. 如需组合演示，一并复制 `assets/kits/api-docs/ApiDocsSection.vue` 到 `app/components/sections/`。
3. 无需额外依赖——这些组件只用 `@nuxt/ui` 原语，通用基座已具备。

> **自动导入前缀**：`app/components/api/` 下的组件，自动导入名带 `Api` 前缀（`api/CodeSample.vue` → `<ApiCodeSample>`）。在模板里用短名 `<CodeSample>` 会静默解析为空。

## 组合示例：`ApiDocsSection.vue`

```vue
<template>
  <section id="api-docs" class="space-y-8">
    <ApiEndpointHeader method="POST" path="/v1/deployments" description="创建一个新的部署。" />
    <ApiParamsTable :params="params" />
    <ApiCodeSample :variants="requestSamples" />
    <ApiResponseBlock :status="200" status-text="部署已创建。" :body="responseBody" language="json" />
  </section>
</template>
```

`requestSamples` 形如 `[{ label: 'cURL', language: 'bash', code: '...' }, ...]`。

## Accessibility（无障碍）

- CodeSample 的复制按钮：动态 `aria-label`（Copy / Copied）+ `role=status aria-live=polite` 播报；UTabs 键盘导航与 `aria-selected` 由 Reka UI 内置。
- ParamsTable：`<th scope>` 关联表头；required 色 + 词双通道。
- EndpointHeader / ResponseBlock：method / 状态码色 + 文本双通道，不单靠颜色传达含义。
- 全部组件的色彩用 Geist 语义 token（`text-highlighted` / `text-muted` / `bg-elevated` / `border-default`），随 color-mode 明暗切换。

## 为什么不用 @nuxt/content 走内容管线？

试过——content v3 靠构建时生成、运行时导入的 SQLite dump 建表，在托管 dev server 上每次重启不能稳定 re-seed（`decompressSQLDump ... Received undefined` / `no such table`），导致页面时好时坏。对一个要被分发、套用到新对话的 starter 是不可接受的可靠性风险。且 brief 本就要求「用规格模板做领域组件」，组件式组合才是正解。

## 源码参考（skill 内）

- `assets/kits/api-docs/components/EndpointHeader.vue`
- `assets/kits/api-docs/components/ParamsTable.vue`
- `assets/kits/api-docs/components/CodeSample.vue`
- `assets/kits/api-docs/components/ResponseBlock.vue`
- `assets/kits/api-docs/ApiDocsSection.vue` — 组合演示

## 不要臆造

- 不引入 `@nuxt/content` / Shiki / SQLite 来渲染这些代码块——组件式自包含即可。
- 新增领域组件前，按 `method/component-spec-template.md` 先写 anatomy → states → accessibility 规格。
- prop 名严格对齐（`variants` 而非 `samples`；ResponseBlock 用 `body` 而非 `code`）。
