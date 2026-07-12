# ApiDocsCodeBlock `<ApiDocsCodeBlock>`

自包含多语言代码块——近单色、无语法高亮器。这是 API 文档代码块的**可复用基座**：`ApiDocsRequestExample` / `ApiDocsResponseExample` 把 body 委托给它。

> 文件放在 `components/api-docs/CodeBlock.vue`。约定 `pathPrefix: true`，组件名 = 目录名 + 文件名，所以模板名是 `<ApiDocsCodeBlock>`。`api-docs/` 目录前缀让 kit 组件天然与消费者自己的组件隔离、不撞名。

## Props

| prop | 类型 | 说明 |
|---|---|---|
| `variants` | `{ language; label?; code }[]` | 多语言变体；空数组 → 不可用（空态） |
| `title` | `string` | 工具栏标题 / 文件名 |
| `icon` | `string` | 左侧图标，默认 `i-lucide-terminal` |
| `defaultWrap` | `boolean` | 首次访问的换行初值（之后走共享+持久化） |
| `maxHeight` | `string` | 代码区最大高度，默认 `24rem` |
| `labels` | `ApiCodeLabels` | 可本地化的 chrome 文案（见下） |
| `languageLabels` | `Record<string,string>` | 覆盖/扩展 语言 id → 显示名 |

### `ApiCodeLabels`（chrome 文案，用于 i18n）

`language` · `copy` · `copied` · `wrapOn` · `wrapOff` · `emptyTitle` · `emptyHint`。默认英文，传入即覆盖。内容类文本（语言标签、标题、代码本身）来自 data props，逐字渲染。

## 关键点

- **无语法高亮器**：Geist 代码块偏冷静近单色，`<pre><code>` 直出即可，**不引入 Shiki**（避免 content/SQLite 那套重量级依赖，也是刻意的视觉取向）。空 `variants` 渲染空态。
- **多语言用 `variants`**（不是 `samples`；每个 variant 一个 `language`+`code`，可选 `label`）。空 `variants` 渲染空态。
- **语言切换用 `USelect`**（不是 UTabs）——单行工具栏内与其它控件对齐，窄容器下可收缩+截断触发器，下拉面板仍开满内容宽度。
- **换行状态共享+持久化**：所有 CodeBlock 共用 `useCodeWrap`（同一 `useState` key + cookie），切一个全联动，SSR 安全、无 localStorage。
- **工具栏恒为单行**：左 icon·title·`#leading`（如状态 badge）；右 `#controls`（场景/状态选择器）·语言·换行·复制。标题优先截断，图标按钮不收缩。
- **`#controls` 空态仍可见**：注入的场景/状态选择器在空态下不隐藏，读者始终能切回有内容的选择；只有内容相关控件（语言/换行/复制）在无 code 时隐藏。
- **复制委托给共享 `CopyButton`**：不在 CodeBlock 内重写剪贴板逻辑。CopyButton（`UButton` + `useCopy`）自带 copied 态图标切 check、动态 `aria-label`、`role=status` live region 播报；`useCopy` 内部把写入交给 VueUse `useClipboard({ legacy: true })`，天然覆盖 iframe/insecure-context 的 execCommand 兜底 + toast。

## 用法

```vue
<!-- 多语言基座 -->
<ApiDocsCodeBlock :variants="[
  { language: 'curl', label: 'cURL', code: 'curl ...' },
  { language: 'js',   label: 'JavaScript', code: 'await fetch(...)' },
]" title="request" />

<!-- 单块（如响应体）：传单元素 variants -->
<ApiDocsCodeBlock :variants="[{ language: 'json', code: '{ \"ok\": true }' }]" title="response.json" />

<!-- 本地化 chrome 文案 -->
<ApiDocsCodeBlock :variants="variants" :labels="{ copy: '复制代码', copied: '已复制' }" />
```

## 相关组件

- `<ApiDocsRequestExample>` — 场景切换的请求示例（见 `request-example.md`）。
- `<ApiDocsResponseExample>` — 响应示例（多场景/多状态切换，也覆盖单一固定响应；见 `response-example.md`）。
- `<CopyButton>` — 通用复制按钮（基座组件，根目录裸名），ApiDocsCodeBlock 的复制委托给它。

## 规格与源码

- 规格模板见 `method/component-spec-template.md`。
- 源码：`packages/kits/api-docs/app/components/api-docs/CodeBlock.vue`、`composables/useCodeWrap.ts`；复制依赖 `packages/core/app/components/CopyButton.vue` + `composables/useCopy.ts`。
