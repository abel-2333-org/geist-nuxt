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
| `trustHighlightedHtml` | `boolean` | 透传给 CodeBlock；仅可信、预消毒的构建期 HTML 才开启 |
| `v-model:scenario` | `string` | 可选受控口：当前场景 id；用户切换时发 `update:scenario` |

```ts
interface RequestScenario { id: string; label: string; variants: CodeVariant[] }
```

- `label` 已在上游本地化（如 `'收银台支付'`），逐字渲染。
- `variants` 为空 → 该场景显示 CodeBlock 的空态，但场景选择器仍可见（可切回）。
- 场景 ≤1 个时不渲染场景选择器。

## 受控选择

- **默认 uncontrolled**：不绑定 `v-model:scenario` 时组件持有本地状态，默认第一个场景，行为与旧版一致。
- **受控**：绑定后场景由父级驱动；父级更新 → 可预测切换，用户切换 → 发一次 `update:scenario`。
- **fallback 只派生不回写**：绑定值为未知 id、场景列表变化后失配时，展示确定性收敛到第一个场景，但不修改绑定值、不发事件——无更新循环，SSR 安全。
- **linked 联动**：请求 / 响应共用稳定场景 id 时，父级一个 ref 同时绑两侧即可联动，两个选择器互为镜像；scenario 间的 mapping 归 consumer，kit 不做。

```vue
<script setup>
const scenario = ref('checkout')
</script>

<ApiDocsRequestExample v-model:scenario="scenario" :scenarios="requestScenarios" />
<ApiDocsResponseExample v-model:scenario="scenario" :scenarios="responseScenarios" />
```

## 用法

```vue
<ApiDocsRequestExample :scenarios="[
  { id: 'checkout', label: '收银台支付', variants: [{ language: 'curl', code: 'curl ...' }] },
  { id: 'preauth',  label: '预授权支付', variants: [{ language: 'curl', code: 'curl ...' }] },
]" :labels="{ title: '请求示例', scenario: '选择场景', copy: '复制代码' }" />
```

## 源码

- `kits/api-docs/components/RequestExample.vue`（依赖同目录 `CodeBlock.vue` + `kits/api-docs/composables/useCodeWrap.ts`，由根 registry 展开）。
