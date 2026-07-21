# ApiDocsResponseExample `<ApiDocsResponseExample>`

按**业务场景 + HTTP 状态 + body 形态（media type）**三级切换的响应示例，带彩色状态 badge 与 status 级描述条；代码展示 + 语言 + 复制 + 换行委托给 `<ApiDocsCodeBlock>`。场景/状态/media 选择器注入 `#controls`：宽容器内联显示，窄容器折成一个显示当前场景名的触发按钮，点击后在 popover 中平铺各维度的 labelled radio groups（每次切换一步到位，无嵌套下拉）。状态 badge 注入 `#leading`，描述注入 `#notice`，非代码 body 面板注入 `#body`。

> 覆盖响应的所有形态：多场景/多状态/多 media 交互切换，也包括**单一固定响应**——各维度 ≤1 时对应选择器自动隐藏，只剩状态 badge + body。
> 展示模型由消费方提供且已本地化，组件**不解析 OpenAPI**。
> 文件放在 `components/api-docs/ResponseExample.vue`。约定 `pathPrefix: true`，模板名 = 目录 + 文件名 = `<ApiDocsResponseExample>`。

## Anatomy

```text
<ApiDocsCodeBlock>（统一框架）
├─ toolbar：icon · title · 状态 badge（#leading）
│           宽：场景 / 状态 / media 选择器（#controls）· 语言 · 换行 · 复制
│           窄：场景名触发 radio-group popover（#controls）· 语言 · 换行 · 复制
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
`title` · `scenario` · `status` · `mediaType`（media 选择器 aria-label）· `responseOptions`（窄容器触发按钮的可访问名前缀 / 极端空标签时的视觉兜底）· `codeBodyTitle`（code body 缺少 `mediaType` 且没有可用 variant 时的最终兜底）· `emptyBodyTitle` / `emptyBodyHint` · `unavailableTitle` / `unavailableHint` · `fileTitle`（无文件名时的兜底标题）· `download`（下载链接文本）。`note` 字段逐条覆盖对应 hint。

## State

- 三级选择：场景 → 状态 → body；切场景时**始终**回到新场景的首个 status 与首个 body，即使两个场景共享相同 status code；切状态时 body 归位到第一个。
- 状态色：2xx `success` · 3xx `info` · 4xx `warning` · 5xx `error` · `'default'` `neutral`（**文本+颜色双通道**，不单靠颜色）。`'default'` badge 直接显示等宽 `default` 文本。
- 状态码在彩色 badge（`#leading`）里；多 status 时选择器只带 `statusText`，合起来读作 "200 · OK" 不重复；固定 status 没有选择器时，badge 自身同时显示 code 与 `statusText`。
- media 选择器标签优先用 `mediaType`；未提供时，code body 回退到首个 variant 的 label / 语言显示名 / `codeBodyTitle`——语言显示名与 CodeBlock 语言选择器共用 `langLabel`（`utils/lang-preset.ts`，`languageLabels` 覆盖优先），同一语言 id 两处渲染一致；其他 kind 回退到各自面板标题。显式 `bodies: []` 保持空列表且不会复活 legacy `variants`。各维度 ≤1 时不渲染对应选择器。
- 组件根以命名 container 观测自身宽度：`@xl/response` 以上保持三个 inline selects；更窄时改为单个触发按钮，不按页面 viewport 猜测卡片可用宽度。触发器只显示当前场景名（信息量最高的一项）——状态码由相邻 badge 承担，media type 点开即见；场景不可切换时依次回退到 media 标签 / `statusText`。popover 内不嵌套 select，各维度平铺为 radio group，任何切换两步（开 popover → 点选项）完成。
- 语言/换行/复制仅在 `code` 形态出现（内容绑定控件随 CodeBlock 隐藏）。

## A11y

- 非代码面板为静态文本描述（图标 `aria-hidden`），容器 `role="status"`（自带 polite live region，不重复写 `aria-live`），切换时播报。
- 下载控件是真实链接（`UButton :to` + `download`），可访问名包含文件名。
- 固定 status 的 badge 同时包含 code 与 `statusText`，确保没有 status selector 时仍能视觉呈现并被读屏读取。
- 三个选择器均带 `aria-label`（`scenario` / `status` / `mediaType` labels 键）；窄容器触发按钮的 `aria-label` 串起当前场景、状态和 media type，popover 内每组 `URadioGroup` 以 `legend` 提供可见分组 label，radiogroup 语义与方向键导航由原语承担。点击、tap、Enter、Esc 与 focus-visible 同样继承 Nuxt UI / Reka UI 原语。

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

- `kits/api-docs/components/ResponseExample.vue`（依赖同目录 `CodeBlock.vue` + `kits/api-docs/composables/useCodeWrap.ts` + `kits/api-docs/utils/lang-preset.ts`，由根 registry 展开）。
