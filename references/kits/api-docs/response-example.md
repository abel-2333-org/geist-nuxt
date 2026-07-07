# ResponseExample `<ApiResponseExample>`

按**业务场景 + HTTP 状态**切换的响应示例（200 / 400 / 401 …），带彩色状态 badge，body + 语言 + 复制 + 换行委托给 `<ApiCodeSample>`。场景/状态选择器注入 `#controls`，状态 badge 注入 `#leading`。

> 这是单一固定响应组件 `<ApiResponseBlock>` 的**多状态兄弟**：一个固定响应用 `ApiResponseBlock`；要交互切换场景/状态时用本组件。
> 文件名 `components/api/ResponseExample.vue`，自动导入名 `<ApiResponseExample>`。

## Props

| prop | 类型 | 说明 |
|---|---|---|
| `scenarios` | `ResponseScenario[]` | 场景列表，每个含一到多个状态 |
| `title` | `string` | 覆盖标题（默认 `labels.title` / `'Response'`） |
| `defaultWrap` / `maxHeight` / `languageLabels` | — | 传给 CodeSample |
| `labels` | `ApiResponseLabels` | `ApiCodeLabels` + `title` + `scenario` + `status` |

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
<ApiResponseExample :scenarios="[
  { id: 'checkout', label: '收银台支付', statuses: [
    { status: 200, statusText: 'OK', variants: [{ language: 'json', code: '{ ... }' }] },
    { status: 400, statusText: 'Bad Request', variants: [{ language: 'json', code: '{ ... }' }] },
  ] },
]" :labels="{ title: '响应示例', scenario: '选择场景', status: '选择状态' }" />
```

## 源码

- `assets/kits/api-docs/components/ResponseExample.vue`（依赖 `CodeSample.vue` + `composables/useCodeWrap.ts`）。
