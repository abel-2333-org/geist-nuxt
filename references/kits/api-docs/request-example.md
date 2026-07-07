# RequestExample `<ApiRequestExample>`

按**业务场景**切换的请求示例（如 收银台支付 / 预授权支付 / 跳转支付）。本组件只负责场景选择，把 body + 语言切换 + 复制 + 换行全部委托给 `<ApiCodeSample>`：场景 `USelect` 通过 `#controls` 注入到 CodeSample 的统一工具栏，保持单行对齐。

> 文件名 `components/api/RequestExample.vue`，自动导入名 `<ApiRequestExample>`。

## Props

| prop | 类型 | 说明 |
|---|---|---|
| `scenarios` | `RequestScenario[]` | 业务场景列表 |
| `title` | `string` | 覆盖标题（默认 `labels.title` / `'Request'`） |
| `defaultWrap` | `boolean` | 传给 CodeSample |
| `maxHeight` | `string` | 传给 CodeSample |
| `labels` | `ApiRequestLabels` | `ApiCodeLabels` + `title` + `scenario` |
| `languageLabels` | `Record<string,string>` | 传给 CodeSample |

```ts
interface RequestScenario { id: string; label: string; variants: CodeVariant[] }
```

- `label` 已在上游本地化（如 `'收银台支付'`），逐字渲染。
- `variants` 为空 → 该场景显示 CodeSample 的空态，但场景选择器仍可见（可切回）。
- 场景 ≤1 个时不渲染场景选择器。

## 用法

```vue
<ApiRequestExample :scenarios="[
  { id: 'checkout', label: '收银台支付', variants: [{ language: 'curl', code: 'curl ...' }] },
  { id: 'preauth',  label: '预授权支付', variants: [{ language: 'curl', code: 'curl ...' }] },
]" :labels="{ title: '请求示例', scenario: '选择场景', copy: '复制代码' }" />
```

## 源码

- `assets/kits/api-docs/components/RequestExample.vue`（依赖 `CodeSample.vue` + `composables/useCodeWrap.ts`）。
