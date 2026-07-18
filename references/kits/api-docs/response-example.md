# ApiDocsResponseExample `<ApiDocsResponseExample>`

按**业务场景 + HTTP 状态**切换的响应示例（200 / 400 / 401 …），带彩色状态 badge，body + 语言 + 复制 + 换行委托给 `<ApiDocsCodeBlock>`。场景/状态选择器注入 `#controls`，状态 badge 注入 `#leading`。

> 覆盖响应的所有形态：多场景/多状态交互切换，也包括**单一固定响应**——传单场景单状态时选择器自动隐藏，只剩状态 badge + body。
> 文件放在 `components/api-docs/ResponseExample.vue`。约定 `pathPrefix: true`，模板名 = 目录 + 文件名 = `<ApiDocsResponseExample>`。

## Props

| prop | 类型 | 说明 |
|---|---|---|
| `scenarios` | `ResponseScenario[]` | 场景列表，每个含一到多个状态 |
| `title` | `string` | 覆盖标题（默认 `labels.title` / `'Response'`） |
| `defaultWrap` / `maxHeight` / `languageLabels` | — | 传给 CodeBlock |
| `labels` | `ApiResponseLabels` | `ApiCodeLabels` + `title` + `scenario` + `status` |
| `trustHighlightedHtml` | `boolean` | 透传给 CodeBlock；仅可信、预消毒的构建期 HTML 才开启 |

```ts
interface ResponseStatus { status: number; statusText?: string; variants: CodeVariant[] }
interface ResponseScenario { id: string; label: string; statuses: ResponseStatus[] }
```

- 状态色：2xx `success` · 3xx `info` · 4xx `warning` · 5xx `error`（**文本+颜色双通道**，不单靠颜色）。
- 数字码在彩色 badge（`#leading`）里，状态选择器只带 `statusText`，合起来读作 "200 · OK" 不重复。
- 切场景时状态自动收敛到该场景的第一个可用状态。
- 场景/状态各自 ≤1 时不渲染对应选择器。

## 用法

```vue
<ApiDocsResponseExample :scenarios="[
  { id: 'checkout', label: '收银台支付', statuses: [
    { status: 200, statusText: 'OK', variants: [{ language: 'json', code: '{ ... }' }] },
    { status: 400, statusText: 'Bad Request', variants: [{ language: 'json', code: '{ ... }' }] },
  ] },
]" :labels="{ title: '响应示例', scenario: '选择场景', status: '选择状态' }" />
```

## 源码

- `kits/api-docs/components/ResponseExample.vue`（依赖同目录 `CodeBlock.vue` + `kits/api-docs/composables/useCodeWrap.ts`，由根 registry 展开）。
