# ApiDocsResponseExample `<ApiDocsResponseExample>`

按**业务场景 + HTTP 状态 + body 形态（media type）**三级切换的响应示例，带彩色状态 badge 与 status 级描述条；代码展示 + 语言 + 复制 + 换行委托给 `<ApiDocsCodeBlock>`。场景/状态/media 选择器注入 `#controls`，状态 badge 注入 `#leading`，描述注入 `#notice`，非代码 body 面板注入 `#body`。

> 覆盖响应的所有形态：多场景/多状态/多 media 交互切换，也包括**单一固定响应**——各维度 ≤1 时对应选择器自动隐藏，只剩状态 badge + body。
> 展示模型由消费方提供且已本地化，组件**不解析 OpenAPI**。
> 文件放在 `components/api-docs/ResponseExample.vue`。约定 `pathPrefix: true`，模板名 = 目录 + 文件名 = `<ApiDocsResponseExample>`。

## Anatomy

```text
<ApiDocsCodeBlock>（统一框架）
├─ toolbar：icon · title · 状态 badge（#leading）
│           场景 / 状态 / media 选择器（#controls）· 语言 · 换行 · 复制
├─ notice：status 级 description（#notice，可选）
└─ body：code → CodeBlock 代码面；empty / unavailable / file → #body 语义面板
```

## Body 语义（`ResponseBody` 联合类型）

| kind | 含义 | 展示 |
|---|---|---|
| `code` | 可渲染示例（JSON / text / CSV …） | CodeBlock 代码面，语言/复制/换行齐全 |
| `empty` | **协议约定的空正文**（如 204） | 「No response body」面板；绝不显示为「缺示例」 |
| `unavailable` | schema 有正文但**没有可展示示例** | 「Example not available」面板；绝不伪造空 body |
| `file` | 二进制 / 文件响应 | metadata 卡片（文件名 / mediaType / size）+ 可选下载链接；不伪装成 source code，无内嵌预览 |

```ts
type ResponseBody =
  | { kind: 'code'; mediaType?: string; variants: CodeVariant[] }
  | { kind: 'empty'; mediaType?: string; note?: string }
  | { kind: 'unavailable'; mediaType?: string; note?: string }
  | { kind: 'file'; mediaType: string; filename?: string; size?: string; downloadUrl?: string; note?: string }

interface ResponseStatus {
  status: number | 'default'   // 数字码或 OpenAPI 的 'default'
  statusText?: string
  description?: string         // status 级描述，显示在 body 面板上方（#notice）
  bodies?: ResponseBody[]      // 一到多个 body 形态；>1 时出 media 选择器
  variants?: CodeVariant[]     // 旧简写：内部归一化为 [{ kind: 'code', variants }]；bodies 优先
}
interface ResponseScenario { id: string; label: string; statuses: ResponseStatus[] }
```

## Props

| prop | 类型 | 说明 |
|---|---|---|
| `scenarios` | `ResponseScenario[]` | 场景列表，每个含一到多个状态 |
| `title` | `string` | 覆盖标题（默认 `labels.title` / `'Response'`） |
| `defaultWrap` / `maxHeight` / `languageLabels` | — | 传给 CodeBlock |
| `labels` | `ApiResponseLabels` | 见下 |
| `trustHighlightedHtml` | `boolean` | 透传给 CodeBlock；仅可信、预消毒的构建期 HTML 才开启 |

`ApiResponseLabels` = `ApiCodeLabels` + chrome 文案键（均有英文默认值，可整体本地化）：
`title` · `scenario` · `status` · `mediaType`（media 选择器 aria-label）· `emptyBodyTitle` / `emptyBodyHint` · `unavailableTitle` / `unavailableHint` · `fileTitle`（无文件名时的兜底标题）· `download`（下载链接文本）。`note` 字段逐条覆盖对应 hint。

## State

- 三级选择：场景 → 状态 → body；切场景时状态收敛到首个可用状态，切状态时 body 归位到第一个。
- 状态色：2xx `success` · 3xx `info` · 4xx `warning` · 5xx `error` · `'default'` `neutral`（**文本+颜色双通道**，不单靠颜色）。`'default'` badge 直接显示等宽 `default` 文本。
- 状态码在彩色 badge（`#leading`）里，状态选择器只带 `statusText`，合起来读作 "200 · OK" 不重复。
- media 选择器标签用 `mediaType`；未提供时回退到对应 kind 的面板标题。各维度 ≤1 时不渲染对应选择器。
- 语言/换行/复制仅在 `code` 形态出现（内容绑定控件随 CodeBlock 隐藏）。

## A11y

- 非代码面板为静态文本描述（图标 `aria-hidden`），容器 `role="status"` + `aria-live="polite"`，切换时播报。
- 下载控件是真实链接（`UButton :to` + `download`），可访问名包含文件名。
- 三个选择器均带 `aria-label`（`scenario` / `status` / `mediaType` labels 键）；键盘路径与 focus-visible 继承 Nuxt UI 原语。

## 用法

```vue
<ApiDocsResponseExample :scenarios="[
  { id: 'create', label: '创建部署', statuses: [
    { status: 200, statusText: 'OK', description: '返回存储后的完整记录。', bodies: [
      { kind: 'code', mediaType: 'application/json', variants: [{ language: 'json', code: '{ ... }' }] },
      { kind: 'code', mediaType: 'text/csv', variants: [{ language: 'csv', label: 'CSV', code: 'id,name' }] },
    ] },
    { status: 204, statusText: 'No Content', bodies: [{ kind: 'empty' }] },
    { status: 409, statusText: 'Conflict', bodies: [{ kind: 'unavailable', mediaType: 'application/json' }] },
    { status: 'default', statusText: '未预期错误', bodies: [
      { kind: 'code', mediaType: 'application/json', variants: [{ language: 'json', code: '{ ... }' }] },
    ] },
  ] },
  { id: 'export', label: '导出', statuses: [
    { status: 200, statusText: 'OK', bodies: [
      { kind: 'file', mediaType: 'application/zip', filename: 'export.zip', size: '2.4 MB', downloadUrl: '/exports/export.zip' },
    ] },
  ] },
]" :labels="{ title: '响应示例', scenario: '选择场景', status: '选择状态', mediaType: '选择格式' }" />
```

旧用法（仅 `variants`）继续可用，等价于单个 `code` body：

```vue
<ApiDocsResponseExample :scenarios="[
  { id: 'ok', label: '默认', statuses: [
    { status: 200, statusText: 'OK', variants: [{ language: 'json', code: '{ ... }' }] },
  ] },
]" />
```

## 源码

- `kits/api-docs/components/ResponseExample.vue`（依赖同目录 `CodeBlock.vue` + `kits/api-docs/composables/useCodeWrap.ts`，由根 registry 展开）。
