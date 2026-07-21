# ApiDocsCodeBlock `<ApiDocsCodeBlock>`

自包含多语言代码块——默认近单色、无运行时语法高亮器，也可消费构建期产出的可信高亮 HTML。这是 API 文档代码块的**可复用基座**：`ApiDocsRequestExample` / `ApiDocsResponseExample` 把 body 委托给它。

> 文件放在 `components/api-docs/CodeBlock.vue`。约定 `pathPrefix: true`，组件名 = 目录名 + 文件名，所以模板名是 `<ApiDocsCodeBlock>`。`api-docs/` 目录前缀让 kit 组件天然与消费者自己的组件隔离、不撞名。

## Props

| prop | 类型 | 说明 |
|---|---|---|
| `variants` | `{ language; label?; code; highlightedHtml? }[]` | `code` 是复制/回退真源；可选 HTML 只负责展示；空数组 → 不可用（空态） |
| `title` | `string` | 工具栏标题 / 文件名 |
| `icon` | `string` | 左侧图标，默认 `i-lucide-terminal` |
| `defaultWrap` | `boolean` | 首次访问的换行初值（之后走共享+持久化） |
| `maxHeight` | `string` | 代码区最大高度，默认 `24rem` |
| `labels` | `ApiCodeLabels` | 可本地化的 chrome 文案（见下） |
| `languageLabels` | `Record<string,string>` | 覆盖/扩展 语言 id → 显示名（默认表在 `utils/lang-preset.ts`，与 ResponseExample 的 media 标签共用） |
| `trustHighlightedHtml` | `boolean` | 默认 `false`；显式确认 `highlightedHtml` 来自可信、预消毒的构建期管线后才开启 |

### `ApiCodeLabels`（chrome 文案，用于 i18n）

`language` · `copy` · `copied` · `copyToast` · `copySuccess` · `copyFailure` · `wrapOn` · `wrapOff` · `emptyTitle` · `emptyHint`。默认英文，传入即覆盖。`copySuccess` / `copyFailure` 接收完整句子；未传 `copySuccess` 时，已有的 `copied` 本地化句子也会用于成功 toast。内容类文本（语言标签、标题、代码本身）来自 data props。

## 关键点

- **无运行时语法高亮器**：默认用转义后的 `<pre><code>` 直出，不引入 Shiki runtime。消费项目可在构建期用 Shiki 等工具生成 `highlightedHtml`，但必须先消毒并显式传 `trust-highlighted-html`；用户输入、运行时 API 返回的 HTML 禁止直接传入。组件不负责解析 Markdown 或执行高亮。
- **raw code 永远是真源**：复制按钮始终写入 `variant.code`，`highlightedHtml` 只影响展示；未开启信任或 HTML 缺失时自动回退到转义后的 `code`。
- **多语言用 `variants`**（不是 `samples`；每个 variant 一个 `language`+`code`，可选 `label`）。空 `variants` 渲染空态。
- **语言切换用 `USelect`**（不是 UTabs）——单行工具栏内与其它控件对齐，窄容器下可收缩+截断触发器，下拉面板仍开满内容宽度。
- **换行状态共享+持久化**：所有 CodeBlock 共用 `useCodeWrap`（同一 `useState` key + cookie），切一个全联动，SSR 安全、无 localStorage。
- **工具栏恒为单行**：左 icon·title·`#leading`（如状态 badge）；右 `#controls`（场景/状态选择器）·语言·换行·复制。标题优先截断，图标按钮不收缩。
- **`#controls` 空态仍可见**：注入的场景/状态选择器在空态下不隐藏，读者始终能切回有内容的选择；只有内容相关控件（语言/换行/复制）在无 code 时隐藏。
- **`#notice` / `#body` 供包装组件注入语义面板**：`#notice` 在工具栏下渲染上下文条（如 status 级描述）；无 code 时 `#body` 替代通用空态，承载包装组件自有的语义面板（有意空正文 / 缺示例 / 文件 metadata，见 `ApiDocsResponseExample`）。两个 slot 缺省不渲染任何东西，均非破坏性。CodeBlock 只提供框架 chrome，不理解这些语义。
- **复制委托给共享 `CopyButton`**：不在 CodeBlock 内重写剪贴板逻辑。CopyButton（`UButton` + `useCopy`）自带 copied 态图标切 check、动态 `aria-label`、`role=status` live region 播报；`useCopy` 内部把写入交给 VueUse `useClipboard({ legacy: true })`，天然覆盖 iframe/insecure-context 的 execCommand 兜底 + toast。成功/失败 toast 均可通过完整消息注入，本地化不拼半句。

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
<ApiDocsCodeBlock :variants="variants" :labels="{
  copy: '复制代码',
  copied: '代码已复制',
  copyFailure: '无法复制，请手动选择代码',
}" />

<!-- 仅对可信、预消毒的构建期 HTML 开启；复制内容仍是 code -->
<ApiDocsCodeBlock :variants="[{
  language: 'json',
  code: '{ \"ok\": true }',
  highlightedHtml: '{ <span class=\"token-key\">&quot;ok&quot;</span>: true }',
}]" trust-highlighted-html />
```

## 相关组件

- `<ApiDocsRequestExample>` — 场景切换的请求示例（见 `request-example.md`）。
- `<ApiDocsResponseExample>` — 响应示例（多场景/多状态切换，也覆盖单一固定响应；见 `response-example.md`）。
- `<CopyButton>` — 通用复制按钮（基座组件，根目录裸名），ApiDocsCodeBlock 的复制委托给它。

## 规格与源码

- 规格模板见 `method/component-spec-template.md`。
- 源码：`kits/api-docs/components/CodeBlock.vue`、`kits/api-docs/composables/useCodeWrap.ts`、`kits/api-docs/utils/lang-preset.ts`；复制依赖 `foundation/components/CopyButton.vue` + `foundation/composables/useCopy.ts`，由根 registry 解析安装。
