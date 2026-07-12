# ApiDocsRequestExample `<ApiDocsRequestExample>`

按**业务场景**切换的请求示例（如 收银台支付 / 预授权支付 / 跳转支付）。本组件只负责场景选择，把 body + 语言切换 + 复制 + 换行全部委托给 `<ApiDocsCodeBlock>`：场景 `USelect` 通过 `#controls` 注入到 CodeBlock 的统一工具栏，保持单行对齐。

> 文件放在 `components/api-docs/RequestExample.vue`。约定 `pathPrefix: true`，模板名 = 目录 + 文件名 = `<ApiDocsRequestExample>`。

## Props

| prop | 类型 | 说明 |
|---|---|---|
| `scenarios` | `RequestScenario[]` | 业务场景列表 |
| `title` | `string` | 覆盖标题（默认 `labels.title` / `'Request'`） |
| `defaultWrap` | `boolean` | 传给 CodeBlock |
| `maxHeight` | `string` | 传给 CodeBlock |
| `labels` | `ApiRequestLabels` | `ApiCodeLabels` + `title` + `scenario` |
| `languageLabels` | `Record<string,string>` | 传给 CodeBlock |

```ts
interface RequestScenario { id: string; label: string; variants: CodeVariant[] }
```

- `label` 已在上游本地化（如 `'收银台支付'`），逐字渲染。
- `variants` 为空 → 该场景显示 CodeBlock 的空态，但场景选择器仍可见（可切回）。
- 场景 ≤1 个时不渲染场景选择器。

## 用法

```vue
<ApiDocsRequestExample :scenarios="[
  { id: 'checkout', label: '收银台支付', variants: [{ language: 'curl', code: 'curl ...' }] },
  { id: 'preauth',  label: '预授权支付', variants: [{ language: 'curl', code: 'curl ...' }] },
]" :labels="{ title: '请求示例', scenario: '选择场景', copy: '复制代码' }" />
```

## 源码

- `packages/kits/api-docs/app/components/api-docs/RequestExample.vue`（依赖同目录 `CodeBlock.vue` + `composables/useCodeWrap.ts`）。
