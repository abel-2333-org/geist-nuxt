# Kit：API 文档场景

一组用于「API 参考文档」页面的领域组件，用「组件规格模板」（`method/component-spec-template.md`：anatomy → states → accessibility → interaction）设计，**全部基于 Nuxt UI 原语与 Geist token 组合而成**，自包含、无内容管线依赖。

> **这是可选领域包（kit），不属于通用基座。** 只有当项目是 API 文档 / 开发者门户这类场景时才加载并装入。做 dashboard、营销站等其它项目时忽略本目录。

## 何时用

- 需要展示 REST/HTTP 端点、请求参数、多语言调用示例、响应体的页面。
- 开发者文档站、API 参考、SDK 门户。

> **搭真实项目前先读 `project-setup.md`**：本场景推荐的领域模块（i18n / content / sitemap / og-image 等）、i18n 接线方式、以及 `@nuxt/content` 的取舍都在那里。基座只给 UI，领域配置在消费项目侧完成。

## 组件清单

| 文件 | 组件名 | 职责 | 详细文档 |
|---|---|---|---|
| `components/CodeBlock.vue` | `<ApiDocsCodeBlock>` | 多语言代码块基座（USelect 语言 + 复制 + 换行；默认 raw code，可选可信构建期 highlighted HTML；无运行时高亮器；`#notice`/`#body` 槽供包装组件注入语义面板） | `code-sample.md` |
| `components/RequestExample.vue` | `<ApiDocsRequestExample>` | 按业务场景切换的请求示例（委托 ApiDocsCodeBlock）；场景可选经 `v-model:scenario` 受控 | `request-example.md` |
| `components/ResponseExample.vue` | `<ApiDocsResponseExample>` | 响应示例：场景+状态切换 + body 语义显式建模（code/empty/unavailable/file、多 media type、`'default'` 状态；委托 ApiDocsCodeBlock）；场景可选经 `v-model:scenario` 受控，status 保持内部 | `response-example.md` |
| `components/MethodBadge.vue` | `<ApiDocsMethodBadge>` | HTTP method 色标（GET/POST/PUT/PATCH/DELETE），mono 字体；preset 包装 foundation `SemanticBadge` | — |
| `components/EventBadge.vue` | `<ApiDocsEventBadge>` | Webhook 身份标：统一词 `EVENT`（neutral+subtle、mono），与 MethodBadge 同形态位——方法色标说「你调平台」，EVENT 标说「平台回调你」；单值词汇，preset 退化为内联常量 | 本页「Operation identity 分层」 |
| `components/LifecycleBadge.vue` | `<ApiDocsLifecycleBadge>` | 生命周期色标（new/beta/active/maintenance/deprecated/sunset）；preset 包装 foundation `SemanticBadge`；`label` prop 覆盖 preset 默认文案（i18n） | — |
| `components/LifecycleNotice.vue` | `<ApiDocsLifecycleNotice>` | 生命周期横幅：`UAlert` 薄包装，与 LifecycleBadge 共用 `lifecyclePreset` 词表与色调（徽章标记一行，横幅解释「发生了什么+怎么办」）；置于 OperationHeader 之后、字段区之前；不可 dismiss | — |
| `components/OperationHeader.vue` | `<ApiDocsOperationHeader>` | 操作身份头（identity/header）：`kind="endpoint"\|"webhook"` 单组件分派到 MethodBadge/EventBadge——identity 行（徽章 + mono 标识 + 右对齐 `#actions` 槽）→ 标题（`heading-level` 定层级，默认 h2；可选 lifecycle 徽章，`lifecycle` 收 `EndpointLifecycle`（含 beta），`lifecycle-label` 覆盖徽章文案）→ `#description` 槽 → 默认槽收尾部块（OperationTarget 等，正交不内嵌） | 本页「Operation identity 分层」 |
| `components/OperationTarget.vue` | `<ApiDocsOperationTarget>` | 端点的「往哪调」行（actions/target）：环境 host 切换（`USelect`，单 host 自动省略）+ mono 完整地址 + `CopyButton` 复制；面向 endpoint——webhook 的 target 是消费方自己的回调地址，一句话说明即可 | 本页「Operation identity 分层」 |
| `components/WebhookProtocol.vue` | `<ApiDocsWebhookProtocol>` | webhook 三段协议事实（Verification / Acknowledgement / Delivery），OperationHeader（kind="webhook"）的正文伙伴：FieldGroup 段头 + `<dl>` 事实行；三段各自独立省略（没写进契约的段整段不出现）；ACK body 三语义由数据形状表达（literal → CodeBlock example、echo / intentional empty → facts 行文字）；重试节奏总结句为可访问真源、chips 纯视觉且长序列折叠可展开。派生纯函数在 `utils/webhook-protocol.ts`（有 node --test 覆盖） | `webhook-protocol.md` |
| `components/CodeRail.vue` | `<ApiDocsCodeRail>` | 纵向双例码轨道：上下两栏（典型为 Request/Response）+ 可拖横向把手 + 内容优先重分配；耦合本 kit 代码卡内部 DOM（`.code-surface`/`pre.raw-pre`）量自然高，故归 kit 而非 foundation；`storage-key` prop 让多实例互不串扰；把手 aria-label 经 `resize-label` prop 可本地化（同 `SidebarNav` 惯例） | 本页「可拖动分栏」 |
| `components/EnumTable.vue` | `<ApiDocsEnumTable>` | enum 值表（扁平 `values` + 分组 `variants` 两种形态，标题常带计数 `(N)` 与约束表对称，长表带筛选+滚动；传 `defaultValue` 则该行尾标 Default，与字段行的 DEFAULT pill 连线）；结构文案 `label`/`default-label`/`search-placeholder`/`empty-label` 与未命名 variant 兜底 `variant-label`（函数，收 0 基 index，默认 `Option N`）均可覆盖（i18n） | — |
| `components/FieldGroup.vue` | `<ApiDocsFieldGroup>` | 字段分组容器：mono 大写组标题（`heading-level` 定层级，默认 `<h2>`）+ 可选计数，包裹一列字段行 | — |
| `components/FieldItem.vue` | `<ApiDocsFieldItem>` | 递归字段行：名/类型/必填标记（只标 Required/Conditional，可选缺省不标——省略即可选）/默认值/条件/enum/约束注记/lifecycle + 可折叠子字段；门控前置到**描述之前**、按强度排序：deprecated 迁移提示（该不该用）最先，其次条件 callout（何时必填），然后才是描述；条件做成淡琥珀��容纳 callout（左琥珀边 + `bg-warning/10` + 琥珀分支图标）——把琥珀收进一个有边界的块，与 Beta 徽章成两个独立琥珀物件而非散落；单条约束降级为 inline 行（`LABEL + 文本`，不套带框表格，≥2 条才升级成带计数的表），lifecycle callout 引导标签用 `SINCE`（版本标记，不复读徽章里的状态词，保留 tone 颜色回连徽章）；new/beta 保持在 band 末位;深链接由 `useFieldAnchor` 驱动。字段值本身是 oneOf/anyOf/allOf 时,`composition` prop 在子字段之后委托 `<ApiDocsSchemaComposition>` 渲染，`FieldItemLabels.composition` 注入其 chrome。数据模型 `FieldNode`/`FieldNote`/`FieldItemLabels` 及 composition 类型族全部下沉到 `utils/field.ts`(kit auto-import,组件裸引用),`EnumValue`/`EnumVariant` 来自 `utils/enum.ts`、`FieldLifecycle` 来自 `utils/lifecycle-preset.ts`;全部 chrome(含内部 LifecycleBadge / EnumTable / SchemaComposition 与递归子行)经单个 `labels` 对象本地化,见「Display-model seam → FieldItem 的通用交互约束」 | — |
| `components/SchemaComposition.vue` | `<ApiDocsSchemaComposition>` | 忠实呈现 OpenAPI / JSON Schema 的 `oneOf`/`anyOf`/`allOf`:oneOf 用 `UTabs`(`unmount-on-hide=false` 保留隐藏 panel DOM,深链接可揭示)、anyOf 用可折叠分区、allOf 全展开;discriminator 合成为每个 variant 的**首行真实字段**(而非扁平化丢失语义);variant 递归(variant 内可再嵌 composition),`heading-level` 定标题层级;chrome 文案(kind 眉标 / hint / discriminator 描述工厂 / 空态)经 `labels` 本地化,`field-labels` 透传给内部字段行。字段行渲染委托 `ApiDocsFieldItem`,故切片依赖它 | `schema-composition.md` |
| `components/FieldAnnotation.vue` | `<ApiDocsFieldAnnotation>` | Annotation 家族的**字段形态**(壳在 foundation `AnnotationPopover`,与概念形态 `TermAnnotation` / 文档形态 `DocAnnotation` 同族;字段形态因绑 `FieldNode`+`useFieldAnchor` 落本 kit):把字段引用嵌进叙事文本,hover/click 预览字段摘要(名/类型/必填/描述),动作深链接到字段行。两种绑定——`field` 直传 `FieldNode`,或 `field-ref` 经 `useFieldSource`(随切片分发的 provide/inject)解析(叙事 markdown 只引 id);同页 ref 省略 `page`,委托 `useFieldAnchor` 滚动+展开祖先+高亮;跨页 ref 声明 `page`,渲染为 `{page}#{path}` 链接,目标页 `initFromHash()` 接管。未命中 ref **降级为纯文本**(同 TermAnnotation 策略),chrome 文案经 `labels`(继承 `AnnotationPopoverLabels`)本地化。依赖 `api-docs-field-item`(带入 `FieldNode`+`useFieldAnchor` 闭包)+ 三个 foundation item | 本页「Display-model seam」 |
| `components/SiteSearch.vue` | `<ApiDocsSiteSearch>` | app 顶栏的 `⌘K` 全站搜索：静态导航 groups 始终可用，可选异步 `search(query)` 接正文索引；结果支持 method/scenario facet、额外 groups、可配置快捷键与同页 hash 焦点交接。只认 display model，不绑定 `@nuxt/content` | 本页「SiteSearch 契约」 |
| `components/SidebarNav.vue` | `<ApiDocsSidebarNav>` | 文档/门户侧边栏导航：一个菜单容纳���个可折叠板块（指南文字链接 vs 按用途命名的接口链接）。接口不严格遵循 REST、一个接口常服务多个业务场景，故它只出现一次：行首前置请求方法色标（单个动词，「怎么调」）、中间用途名、行尾中性场景标签（订阅/授权…，「用在哪」）。分组层（eyebrow 标题 + 分隔线）+ 板块 `kind`（guide 柔和 sans / endpoints 大写等宽 mono，chrome 中性、颜色只交给 active 态与方法色标）让两类界限分明；多板块可同时展开、各带计数，顶部单一树内过滤（`/` 聚焦，同时匹配用途名、方法与场景标签）。侧栏宽度可拖拽右边缘调整（键盘可操作、双击复位），宽度记入 localStorage。全站搜索由 `ApiDocsSiteSearch` 放在 app 顶栏；侧栏本身是全高无外框列，边框/圆角/高度由父布局拥有。数据模型 `SidebarNavGroup`/`SidebarNavSection`/`SidebarNavItem` 内联，接口行复用兄弟切片 `ApiDocsMethodBadge` | `sidebar-nav.md` |

### SiteSearch 契约

`ApiDocsSiteSearch` 的 anatomy 是 `UButton` trigger → `UModal` →
`UCommandPalette`。`UModal` 提供 dialog focus trap、Esc 与关闭后焦点恢复；结果选择
统一关闭面板，查询在每次关闭时清空。同页 hash 结果会把焦点和滚动交给目标 section，
并遵守 reduced motion。

主要输入：

- `groups: { id, label, items[] }[]`：静态指南/端点索引；item 接受
  `label / to / method? / scenarios? / icon? / suffix?`；
- `search(query)` + `searchGroupLabel`：可选异步正文结果，组件负责 debounce 与
  stale response cleanup，数据源排序不再被 Fuse 重排；异步源失败且没有可用结果时，
  用 `searchingLabel` / `searchErrorLabel` 区分加载、失败与零结果；
- `extraGroups`：消费项目自己的快捷入口；
- `shortcut` / `resultLimit` / `scenarioSeparator` 与全部可见文案：均可注入；结构性文案
  内置英文默认值，消费项目只在需要本地化或改写时覆盖。

registry item 为 `api-docs-site-search`，只声明
`api-docs-method-badge` 依赖；后者的 closure 自动带入 foundation。完整文档站装配看
`/kits/api-docs/docs-shell`，但该 shell 是 gallery-private recipe，不属于 copy-in 切片。

> **组件名 = 目录名 + 文件名**：约定 `components: [{ path: '~/components', pathPrefix: true }]`，所以 `app/components/api-docs/CodeBlock.vue` 的模板名是 `<ApiDocsCodeBlock>`。`api-docs/` 目录前缀既表达 kit 归属，也让这些组件与消费者自己的组件天然隔离、不撞名。

> **preset 型徽章（MethodBadge / EventBadge / LifecycleBadge）** = 在 foundation 的 `SemanticBadge`（tone 原子）之上，包一层"域词汇 → tone"映射。域词汇 + tone 校准住在 `kits/api-docs/utils/{method,lifecycle}-preset.ts`；对应 kit item 通过根 registry 依赖 foundation semantic-badge item。二者写法对称，改词汇只动 preset、不碰组件。**单值词汇的退化形态**：EventBadge 的词表只有一个值（`EVENT`），preset 退化为组件内联常量、不建 event-preset.ts——词表长出第二个值时再抽文件。**同词表的多形态**：LifecycleNotice 与 LifecycleBadge 共用 `lifecyclePreset`（badge 标记一行、notice 在正文成块解释），改词汇/色调一处生效两个形态。

> `FieldGroup` 管分组标题，`FieldItem` 管递归字段行与深链接。操作级 header 由 `<ApiDocsOperationHeader>` 承担（见「Operation identity 分层」）；页面唯一 `<h1>` 与站点信息架构仍由消费项目提供——OperationHeader 的 `heading-level` 让它挂进任何层级。

配套 foundation 依赖（由根 registry 的 `registryDependencies` 自动装入）：
- `foundation/components/CopyButton.vue` —— 共享复制按钮：`UButton` + 可选 `UTooltip` + `useCopy`，`CodeBlock` 的复制委托给它。
- `foundation/composables/useCopy.ts` —— 剪贴板逻辑单一来源：写入委托给 VueUse 的 `useClipboard({ legacy: true })`（异步 Clipboard API + iframe/execCommand 兜底），外层保留 `copied` 态 + Geist voice toast。推荐签名 `useCopy({ timeout?, failureMessage? })`，推荐动作 `copy(text, { label?, successMessage?, failureMessage? })`；成功/失败都允许调用方传完整句子独占本地化，省略时使用通用英文默认。为保证已 copy-in 消费者可安全升级，legacy positional `useCopy(timeout)` 与 `copy(text, label, { successMessage?, failureMessage? })` 仍兼容，但新代码不要继续扩散 positional 形式。依赖 `@vueuse/core`；消费项目必须有该直接依赖。

配套 composable（随 kit 一起复制）：`composables/useCodeWrap.ts` —— 所有 CodeBlock 共享+持久化的换行状态（`useState` + cookie，SSR 安全）。

> **行内富文本：`ProseText` 递归 tokenizer + 委托 Prose 组件，别手写 `<a>` / `<code>`**。spec 作者的字段描述里会带行内 markdown。`ProseText` 是一个**极小、同步、零依赖**的行内 tokenizer（`h()` 递归渲染，不是正则一次性 replace），把字符串切成 token 后分派到设计系统组件：
>
> | 标记 | 渲染为 |
> |---|---|
> | `` `code` `` | `InlineCode` → Nuxt UI `ProseCode`（内容**不再**二次解析） |
> | `[label](url)` | **`ProseA` → `ULink`**（label 会递归解析） |
> | `**bold**` | `ProseStrong` |
> | `*em*` / `_em_` | `ProseEm` |
> | `~~del~~` | 原生 `<del>`（Nuxt UI 无对应 Prose 组件） |
>
> 要点：①**递归**解析，所以标记可嵌套（`**粗里有 `码`**`、`**[粗链接](/p)**`）。②链接是重点——手写 `<a href="/x">` 会让站内链接整页刷新；`ProseA`/`ULink` 自动判断内/外链，站内走 `NuxtLink` 客户端路由 + 预取，外链才用原生 `<a>` 并自动补 `rel`，消费方只需为外链显式传 `target="_blank"`。③`_` 斜体规则必须带**词边界前瞻/后顾**（`(?<![A-Za-z0-9])_…_(?![A-Za-z0-9])`），否则 `snake_case_name`、URL 里的下划线会被误斜体；`*` 斜体则要求内侧非空白，挡掉孤星（`func(a, b) *`）。**反例**：结构性标识符（字段名、端点 path）用的是带删除线 / truncate 的裸 `<code>`，那是刻意的领域样式，不要套 `ProseCode`。
>
> **为什么不用 `<MDC>` / 完整 markdown 引擎**（踩过的坑）：先核实真实数据——payment spec 的 194 条富文本描述**全是行内**（`code`/`link`，0 条 `**`、0 条块级 `>`/列表）。`<MDC>` 是为文件型内容管线设计的：它 per-instance 走 `useAsyncData`（异步），在一页渲染上百个实例时会 SSR→客户端 **hydration mismatch**（`<code>` 节点被包进 `<!--[-->…<!--]-->` fragment 锚点，改 props / `cacheKey` / 关 Shiki 都修不掉），且徒增体积。`markdown-it` 则输出 `v-html` 裸串，**绕过整个 Prose 组件体系**并丢掉 ULink 路由，与"复用设计系统"方向相悖。结论：**行内需求就用同步 tokenizer**（贴合设计系统、SSR 稳定、无异步）；只有当块级 markdown（引用/列表）成为真实需求时，才回头评估 MDC，别上 `markdown-it`。

### Operation identity 分层（endpoint 与 webhook 的身份表面）

API 参考里「这是哪个接口 / webhook」由四层承担，词汇与组件一一对应（OpenAPI 3.1 视 endpoint operation 与 webhook 同为 operation，故统一用 Operation 词根）：

| 层 | 回答的问题 | endpoint 形态 | webhook 形态 |
|---|---|---|---|
| **identity 原子** | 怎么调 / 什么方向 | `<ApiDocsMethodBadge>`（五色方法标）+ mono path | `<ApiDocsEventBadge>`（统一 `EVENT` 中性标）+ mono 事件名 |
| **identity/header** | 这是哪个操作 | `<ApiDocsOperationHeader kind="endpoint">` | `<ApiDocsOperationHeader kind="webhook">` |
| **actions/target** | 往哪调 / 页面级操作 | `<ApiDocsOperationTarget>`（host 切换 + 地址 + 复制）+ header 的 `#actions` 槽 | 无 target 组件——订阅目标是消费方自己的回调地址，一句话说明���可；`#actions` 槽仍可用 |
| **lifecycle presentation** | 现在还能用吗 | `<ApiDocsLifecycleBadge>`（标记一行）+ `<ApiDocsLifecycleNotice>`（正文成块解释） | 同 endpoint |

设计决策（造新表面前先读，避免重新发明）：

- **MethodBadge / EventBadge 是平行原子，不合并成 `OperationBadge kind=…`**——两者词表来源不同（HTTP 动词封闭集 vs 事件标识开放集），合并会让 props 类型变糊。EVENT 用统一词 + neutral tone：方法五色说「你调平台」，中性 EVENT 说「平台回调你」，方向差异用色彩系统区隔，对齐 Stripe 等主流范式。**不按事件动词尾段（succeeded/failed…）着色**——词表开放、映射难穷尽。
- **OperationHeader 是单组件双形态**——两形态结构 90% 同构（identity 行 → 标题 → 描述 → 尾部块），拆成两个组件会重复。`kind` 只切换 identity 行的徽章与标识字段（`method`+`path` vs `event`）。
- **OperationTarget 与 OperationHeader 正交**——target 放 header 的默认槽而非内嵌 prop，因为不是每个 endpoint 都要地址栏（stub 就没有），webhook 则根本没有。
- **surface（整块参考区域的 frame + slots）刻意不做组件**——横向 `SplitPane` + `<ApiDocsCodeRail>` 的装配变量多（sticky offset、断点、storage key、单卡 vs 双例），封装成组件会僵化；以 `reference.vue` 活骨架 + 下方「可拖动分栏」pattern 文档交付��
- **侧栏 / ⌘K 的 webhook 身份是过渡态**——`SidebarNav` 条目暂以 `method: 'EVENT'` 走 MethodBadge 的 fallback（neutral+subtle，渲染效果与 EventBadge 一致）。这是数据层 stopgap；`item.kind` 泛化（一等 webhook 条目）是已知后续事项，见 `sidebar-nav.md`。

### 可拖动分栏（分割原语在 foundation；重分配在本 kit 的 CodeRail）

典型 API 参考页是「左文档 / 右代码栏」两栏，右栏再纵向分成 Request / Response。空间分割与拖动由 foundation 提供三层原语（从高到低），内容优先重分配则由本 kit 的 `<ApiDocsCodeRail>` 承载（见下）：

- **`components/SplitPane.vue`（`<SplitPane>`）—— 首选入口，声明式的自包含分栏容器**。内部自己持有 `useSplitPane` + `<SplitPaneHandle>`，把断点门控、SSR 安全 sizing、min/max 钳制、键盘 + 指针接线、cookie 持久化全部封装掉。消费方只用**原始值 prop** + `#start`/`#end` 两个具名 slot：

  ```vue
  <SplitPane
    direction="row"          <!-- row=左右(竖分隔) / column=上下(横分隔) -->
    mode="fixed"             <!-- fixed=一侧固定px可拖 / ratio=按比例分 -->
    fixed-pane="end"         <!-- 哪一侧持有固定尺寸 -->
    sticky sticky-top="5rem" <!-- 把手钉成视口高长条(仅 row)，配合 sticky 内容栏 -->
    storage-key="geist-api-rail-width"
    :default-size="460" :min-size="360" :max-size="720" :min-opposite="360"
    label="Resize documentation and code panels"
  >
    <template #start> 左侧文档/指南正文 </template>
    <template #end> 右侧代码栏 </template>
  </SplitPane>
  ```

  **MDC / Nuxt Content 友好**：所有 prop 都是 `string|number|boolean` 字面量（不传函数、不传 computed ref），slot 名为 `start`/`end`，所以同一个组件在 `.vue` 页面和 markdown `::split-pane` 块里用法完全一致——将来装 `@nuxt/content` 做 guide 页零改造：

  ```md
  ::split-pane{direction="row" mode="fixed" fixed-pane="end" :default-size="460"}
  #start
  接入指南正文（**可直接写 markdown**）
  #end
  右侧代码示例
  ::
  ```

  设计边界：`SplitPane` 只管**空间分割 + 拖动**。它不知道 slot 里是什么，所以「左 Tab 切换 → 右代码联动」这类内容协调由页面持有 `activeTab`、两个 slot 各自读它来做，`SplitPane` 无需参与。**内容优先重分配（见下）刻意不折进 `SplitPane`**——那与本 kit 代码卡片的封顶+滚动强耦合，由 kit 的 `<ApiDocsCodeRail>` 承载，`SplitPane` 保持纯净通用。

  以下两个是 `SplitPane` 的**内部零件**，需要脱离容器单独用（比如手写更特殊的布局）时才直接碰：

- `components/SplitPaneHandle.vue`（`<SplitPaneHandle>`）—— 纯展示 + a11y 的分隔把手：1px 分隔线（`border-default` 即 `--ui-border`）+ 居中 grip 药丸。**grip 默认隐藏（`opacity-0`），hover / 拖动中（`active`）/ 键盘 `focus-visible` 时才浮现**——静止时只剩一条素净的 hairline，符合 Geist 克制观感。药丸 hover/drag 转 `bg-primary`。`role="separator"` + `aria-orientation`/`aria-valuenow/min/max`、focus-visible 紫环、方向键/Home/End/Enter 键盘操作、`col/row-resize` 光标。**只报告意图（`dragstart`/`step`/`jump` 事件），不持有任何数值**。主轴尺寸则由消费方（纵向把手可 `self-stretch` 填满，或传 `sticky h-[calc(...)]` 做视口高钉住）。
  - **坑**：`group-hover:` 在 Tailwind v4 会被包进 `@media (hover:hover)`，所以 grip 的 hover 浮现只在有鼠标的设备上生效（触屏/无头浏览器 `hover:none` 不触发，属预期）；触屏与键盘用户靠 `active`（拖动中，非 hover 门控）和 `group-focus-visible`（非 hover 门控）两条路径拿到 grip，affordance 不会丢。别用 `transition-[opacity,background-color]` 这种带逗号的 arbitrary value——逗号会打断 Tailwind 的类名扫描、导致其后同一 `class` 里的工具类（含 `group-hover:*`）不被生成；用普通 `transition` 即可。
- `composables/useSplitPane.ts` —— 轴无关的拖动状态：持有一个数值（栏宽 px、分栏比 0–1…）+ min/max 钳制 + cookie 持久化（`useCookie`+`useState`，同 `useCodeWrap`）+ `Escape` 取消 + rAF 节流。**只管拖动状态，不含任何布局重分配**——内容优先重分配是 api-docs kit 的领域逻辑，由 kit 的 `<ApiDocsCodeRail>` 承载（见下），不进 foundation。

  **为什么不复用 Nuxt UI 的 `useResizable`**：`useResizable(key, options)` 是给 Dashboard 面板做的，只支持**横向**拖宽（写死读 `el.parentElement.offsetWidth` + `clientX`）、支持 `%/rem/px` 单位与 collapsible 折叠，但**没有纵向、没有键盘操作（方向键/Home/End）、没有 Escape 取消、没有内容优先重分配**，而且依赖把手包裹一个真实面板 `el`。我们的需求这三块（纵向 Request/Response、键盘 a11y、内容优先重分配）它都缺，横向那一半即便能用也会造成两条边界行为不一致，所以另建一套轴无关原语。命名用 `useSplitPane` 而非 `useResizable` 只是为了和 Nuxt UI 的同名自动导入 API 区分、避免认知混淆——两者签名不同，真撞名是类型错误而非静默遮蔽。

**内容优先重分配（kit 的 `<ApiDocsCodeRail>` 承载，不在 foundation）**：这是与代码卡片「封顶 + 滚动」强耦合的布局逻辑，故不折进 `SplitPane`/`useSplitPane`（foundation 只提供拖动状态）。它由 kit 的 `kits/api-docs/components/CodeRail.vue`（`<ApiDocsCodeRail>`）承载：纵向分 Request/Response、内含下面这段重分配纯函数，通过 slot scope 把 `maxHeight` 预算下发给 `ApiDocsRequestExample`/`ApiDocsResponseExample`。**归 kit 而非 foundation 的理由**：它量自然高时耦合本 kit 代码卡的内部 DOM（`.code-surface`、`pre.raw-pre`），这种耦合是 kit 内部事务，foundation 不应知晓。根 gallery 的 `app/pages/kits/api-docs/reference.vue` 已按此接线：横向 `SplitPane`（左字段树文档流 / 右代码栏）+ `<ApiDocsCodeRail>`。多实例（如端点轨道 + webhook 轨道同页）各传独立 `storage-key`，避免比例互相覆盖。

> **gallery 私有 demo 组件按 `demo/<kit>/` 分组**：只服务某个 kit demo 页、既非 foundation 也非 kit 切片的组件，统一落到 `app/components/demo/<kit>/`（调用名 `<Demo{Kit}{Name}>`）。这样 kit 归属编码进目���与调用名，同时与可 copy-in 的 `ApiDocs*` 命名空间和消费侧领域组件区隔。（`CodeRail` 曾是此类，后因下游要重建同等逻辑成本过高而提升进 kit——「demo 私有 → kit 切片」的提升以此为准：当组件承载的不是页面装配而是可复用的领域行为时就该提升。）

不要给短代码块强行分半高——那会在卡片里留下大片空白。规则是：

1. 两栏自然高度之和 ≤ 可用高度（fit 态）→ 两栏各按自然高度渲染，右栏整体收缩贴合内容，横向把手设 `disabled`（不可拖、无 grip）。
2. 溢出时（和 > 可用高度）→ 总高封顶为可用高度，按比例分，且**较短的一栏封顶到自然高度、把富余让给溢出的另一栏**；此时横向把手激活，拖动调比例。

kit 内部纯函数（`<ApiDocsCodeRail>` 持有，随 `api-docs-code-rail` 切片分发；下面列出以便理解行为，不需要单独 copy）：

```ts
/**
 * 内容优先重分配：给定去掉把手后的固定总高 H 与两栏自然（未封顶）高度，
 * 返回各栏高度预算。仅在溢出态（H < natTop + natBottom）调用；两栏都放得下
 * 时按自然高渲染、根本不用它。
 * - 基线按 ratio : 1-ratio 分 H，各栏不低于 minPane。
 * - 若一栏内容用不满其份额 → 封顶到自然高，把富余让给溢出的另一栏。
 */
export function computeSplitBudgets(
  H: number, natTop: number, natBottom: number, ratio: number, minPane: number,
): { top: number, bottom: number } {
  if (H <= 0) return { top: 0, bottom: 0 }
  const min = Math.min(minPane, Math.floor(H / 2))
  let top = Math.max(min, Math.min(Math.round(ratio * H), H - min))
  let bottom = H - top
  if (natTop < top) {               // 上栏有富余 → 匀给下栏
    top = Math.max(min, Math.round(natTop)); bottom = H - top
  }
  else if (natBottom < bottom) {    // 下栏有富余 → 匀给上栏
    bottom = Math.max(min, Math.round(natBottom)); top = H - bottom
  }
  return { top, bottom }
}
```

实现要点：用 ResizeObserver 量两栏内部 `<pre>` 的自然高度（滚动容器封顶时 `<pre>` 仍报告完整内容高）；`RequestExample`/`ResponseExample` 已支持接收 `maxHeight` 预算，非 fill 态下 CodeBlock 先长到内容高再封顶滚动。断点 gate 走 `enabled-from` prop（默认 `lg`），gate 之下回退为堆叠 + 自然高、无把手——**必须与外围 SplitPane 的 gate 保持同一断点**（docs-shell 因外层侧栏挤占宽度而统一用 `xl`），内外层断点不同步会出现「分栏启用但放不下最小宽」或反之的错位。`:style` 绑定**始终返回对象（无值时用空对象 `{}` 占位），绝不 `undefined`**——否则 SSR 水合时 `undefined→对象` 的过渡会被 Vue 跳过、宽/高静默不生效。断点判断用手写 `matchMedia` 监听（`onMounted` 建立），别用 VueUse `useMediaQuery`（此处水合后同步不可靠）。

  - **坑（务必）：RO 回调里的 `measure()` 必须 `requestAnimationFrame` 延迟，不能同步调用**。虽然 `<pre>` 的内容高不受 budget 影响，但 RO 同时也观察了 pane **包裹层**，而包裹层高度正是 `measure()` 通过 `budgets`→`reqStyle/resStyle` 写入的——同步重测就构成「写高度→同帧再触发观察」的闭环，浏览器会抛 `ResizeObserver loop completed with undelivered notifications`。把回调合并进单个 rAF（并 `cancelAnimationFrame` 去抖、`onBeforeUnmount` 清理）即可打断同步投递链，且重分配仍在下一帧内完成、视觉无感。同理，`SplitPane` 内部量容器宽算 `max` 时也必须 rAF 延迟写入——注意**别用 VueUse 的 `useElementSize`**：它在自己的 RO 回调里同步写 ref，在这种「量尺寸→改 flex→再触发」的场景里照样闭环。直接用 `useResizeObserver` 拿 `contentRect`、在 rAF 里写自己的 `mainSize` ref 才安全。

## 如何装入项目

组件源码在 `kits/api-docs/`。**装入以根 `registry.json` 切片为单位**，只运行公开 copy-in 工具：

1. 先运行 `pnpm geist:copy -- geist-foundation <item...> --target <consumer> --to <checkout-40-char-sha>` 查看 dry-run plan；确认后用同一命令追加 `--write`。工具会展开 `registryDependencies`，将 kit 与 foundation 依赖的 component / composable / util / CSS / config 完整写入 target；不带 `--write` 不会复制任何文件。
2. `CopyButton` / `useCopy` / `SemanticBadge` 等 foundation 能力也是显式 registry item，不存在 layer 隐式依赖。
3. 组合方式（怎么把请求 + 响应 + 徽章 + 字段树拼成一页）不作为切片分发——kit 只 ship 数据无关积木（代码块/请求/响应/method·lifecycle 徽章/enum 表/字段树/导航/全站搜索）。组合示例见 gallery 五个互补 demo 页，按需在自己项目里照着拼。
4. 组件使用 `@nuxt/ui` 与 `@vueuse/core`；消费项目必须显式具备 registry 所声明的外部依赖。**不要**为了代码块安装 Shiki / `@nuxt/content`。

> **组件名 = 目录名 + 文件名**：约定 `pathPrefix: true`，所以 `app/components/api-docs/CodeBlock.vue` 在模板里是 `<ApiDocsCodeBlock>`。切片必须整体落到消费者的 `app/components/api-docs/`（保留目录），前缀才成立，也才与消费者自有组件隔离。

## 组合示例（demo 在 gallery，不在 kit）

组合方式是 demo/story，按 geist-nuxt「demo 归 gallery、kit 只 ship 数据无关积木」的分层。
gallery 有**六个 api-docs demo 页，职责互补**：

| 页面 | nav 标签 | 定位 | 演示什么 |
|---|---|---|---|
| `app/pages/kits/api-docs/index.vue` | 组件目录 | **逐个陈列**（catalog） | 每个 kit 组件在带标签的分区里单独展示：代码块 / 请求 / 响应 / method·lifecycle 徽章 / enum 表 / 字段树（含紧凑 + 高密度两组压力用例） |
| `app/pages/kits/api-docs/reference.vue` | 参考页组合 | **整页级场景组合** | 招牌两栏参考页：横向 `SplitPane`（左字段树 / 右代码栏）+ kit 的 `<ApiDocsCodeRail>`（纵向分 Request/Response、内容优先重分配）。是下游消费页 copy & adapt 的活骨架 |
| `app/pages/kits/api-docs/sidebar-nav.vue` | 侧边栏导航 | **导航交互专项** | 多分组导航、method/scenario 过滤、折叠、拖拽宽度、窄屏与 app 顶栏全站搜索的职责边界 |
| `app/pages/kits/api-docs/webhook-protocol.vue` | Webhook 协议 | **协议事实专项** | 三段齐全的内联中性 fixture + 变体区：section 省略规则、ACK 三语义（literal/echo/intentional empty）、无 steps schedule 与 `maxScheduleSteps=1` 边界 |
| `app/pages/kits/api-docs/schema-composition.vue` | Schema 组合 | **composition 专项** | 三种 kind（oneOf/anyOf/allOf)、带 discriminator 的 oneOf、字段级 composition 委托(payment-method 风格)、嵌套 composition、空态；deep link 揭示隐藏 variant 与 anchor 唯一性压力用例 |
| `app/pages/kits/api-docs/docs-shell/`（`index.vue` 重定向、`[domain]/index.vue` 域首页、`[domain]/[slug].vue` 指南子页） | 文档站外壳 | **文档门户外壳 recipe（最小示范）** | gallery-private 的 header、domain switcher、`ApiDocsSiteSearch`、`ApiDocsSidebarNav` 与 reference-style 正文装配，路径分段路由 + 指南分页；**未覆盖多资源参考子页**（见 `project-setup.md`「域内怎么拆页」与 ADR-009 投入边界）；用于组合验证，不是 registry 切片 |

> 各页都由 gallery 的假 ViewModel 驱动，数据不写进 kit。**新增单组件陈列进 `index.vue`；参考页布局进 `reference.vue`；组件的交互/状态边界多到需要独立变体压力区时开专项页（先例：`sidebar-nav.vue`、`webhook-protocol.vue`）；整站壳层组合进 `docs-shell/` 路由树**。

最小拼法（单区块，index.vue 风格）：

```vue
<template>
  <section id="api-docs" class="space-y-8">
    <ApiDocsCodeBlock :variants="requestSamples" />
    <ApiDocsResponseExample :scenarios="responseScenarios" />
  </section>
</template>
```

`requestSamples` 形如 `[{ label: 'cURL', language: 'bash', code: '...', highlightedHtml?: '...' }, ...]`。`code` 始终是复制真源；HTML 只接受消费项目在构建期生成并预消毒的可信结果，且页面必须显式开启 `trust-highlighted-html`。数据一律由消费方（页面 / adapter）注入，不写进 kit。

## Accessibility（无障碍）

- CodeBlock 的复制委托给共享 `CopyButton`：动态 `aria-label`（Copy / Copied）+ `role=status aria-live=polite` 播报；成功/失败 toast 接受完整本地化消息；语言 USelect 的键盘导航与 `aria-*` 由 Reka UI 内置。
- ResponseExample：状态码色 + 文本双通道，不单靠颜色传达含义。
- 全部组件的色彩用 Geist 语义 token（`text-highlighted` / `text-muted` / `bg-elevated` / `border-default`），随 color-mode 明暗切换。
- **配色按含义分配（跨 FieldItem 全体生效）**：
  - **必填强度轴**：红=REQUIRED（硬必填）、琥珀=`CONDITIONAL`（仅特定情况必填）、无标记=optional。conditional 用琥珀**不是中性**——它和 red 同属"必填强度轴"的一档，若洗成中性会混进旁边 type/format 那些说明性灰字里，读者分不清它是"必填态的一档"还是"又一个类型注记"。
  - **琥珀="有前提/需留意"**：`CONDITIONAL` 标签、条件 callout、成熟度 beta、caution 约束。同一字段 conditional + beta 也不糊，靠**形态区分**：条件是琥珀 callout **块**、summary row 的 CONDITIONAL 是琥珀**文字标签**且指向下方那个块（label → block 同义呼应）、beta 是**徽章**。三种形态各异，不会读成"一片琥珀"。真正要避免的是"两个**无关**含义共用一色"，同一含义的多形态呼应不算过载。
  - 紫=交互（锚点、展开、focus 环）；中性灰阶=类型、format、SINCE 版本号等纯说明性元数据。
  - **约束注记（`FieldNote.tone`）的使用边界**：普通校验规则（长度、字符集、格式）一律**中性**（省略 tone）——违反它只是校验失败，没有隐藏的坑，和 RANGE 同性质；`caution`（琥珀）只留给**行为性 caveat**——请求不会被拒绝、但不知道就会踩坑的注记（如"值明文存储，勿放秘密""对 preview 部署不生效"）。给格式规则标 caution 属于误用，会稀释琥珀轴。

### 页面级结构 / 语义（review 沉淀）

装配整页时容易漏掉、但 review 必查的几条：

- **标题层级不跳级**。页面只有一个 `<h1>`（由消费项目的页面 header 提供，并加 `text-balance` 防孤字）；字段分组标题（`FieldGroup`）用 `heading-level` 接进所在层级——直接挂在 h1 之下用默认 `2`，挂在 `<h2>` 端点标题之下传 `3`。层级由文档结构决定，不要图视觉小而跳级（视觉尺寸是固定的 mono 小字，与层级无关）。**用原生语义标题 `<h1>/<h2>`，不要用 Nuxt UI 的 `ProseH*`**——`ProseH*` 是 markdown 内容管线组件（读 `mdc.headings` 配置决定是否注入 `#` 锚点、排版是长文正文尺度），本 kit 刻意不装 MDC，用它只会退化成带正文尺度的普通标题并引入隐式 MDC 依赖。这些标题是「应用界面结构」而非「渲染出的 markdown 正文」，属不同层。
- **站内链接一律 `NuxtLink`/`ULink`，页面模板里也不例外**。不止 `ProseText` 内部——页面骨架里的 logo、面包屑、"Learn more" 之类引用链接同样别手写 `<a href="/x">`（会整页刷新、丢预取）。这是基座决策表「单链接用 ULink」的延伸，最易在 header / 摘要被漏掉。
- **提供 skip link**：`header + main` 结构要在最顶部放一个聚焦前 `sr-only`、`focus:not-sr-only` 的「Skip to content」锚点，`href="#main-content"` 指向 `<main id="main-content">`，让键盘 / AT 用户跳过 header。
- **`<img>` 显式 `width`/`height`**。即使有 `size-*` 兜底，也要写死内在尺寸防 CLS。
- **flex 子项要截断先加 `min-w-0`**。像端点 path 的 `<code class="flex-1 truncate">` 必须配 `min-w-0`，否则 flex item 默认 `min-width:auto` 不会收缩、`truncate` 失效。

## Display-model seam

API Docs kit 只定义组件 props，以及组件为这些 props 暴露的 ViewModel / 辅助类型。OpenAPI、私有 DSL、compiler、adapter、i18n、路由与数据获取全部属于消费项目；本仓库不规定这些能力的文件名、类型层级或内部契约。

消费项目只需把自己的数据转换成组件 props，并保持 kit 不反向 import 消费项目模块。kit 内跨切片的类型复用必须与根 `registry.json` 的 `registryDependencies` 一致，确保 copy-in 后依赖闭包完整。

### FieldItem 的通用交互约束

- 字段深链接由随切片分发的 `useFieldAnchor` 管理。页面在 mounted 后调用 `initFromHash()`，让初始 hash 能展开祖先、滚动并高亮；消费项目可在自己的全局滚动策略中抑制首次 hash 跳动，但 kit 不覆盖全局 router 配置。
- 字段锚点必须是可查询、稳定且无歧义的 DOM id；按路径逐段 slugify，再用稳定分隔符连接。字段原名只用于展示，不直接拼进 selector。
- 复制反馈复用 foundation `useCopy()` 与应用级 toast live region；不要为字段表的每一行再创建 `role="status"`。纯图标锚点按钮提供随状态变化的 `aria-label`。
- 本地化复制提示时传入完整成功/失败消息，不在 foundation 与 kit 之间拼接半句；`FieldItemLabels.linkCopied` / `linkCopyFailed` 都接收字段名并返回完整句子。
- **nested chrome 本地化走同一个 `labels` 对象，不 fork 组件**：`FieldItemLabels` 除自身 chrome 键外还有一组**透传键**——`lifecycle`（按 status 覆盖徽章文案的映射）、`enumLabel` / `enumFilter` / `enumEmpty` / `enumVariant`（内部 EnumTable 的标题 / 筛选 placeholder / 空态 / 未命名 variant 兜底函数），以及 `composition`（字段级 SchemaComposition 的 kind / hint / discriminator / 空态文案）。透传键在 FieldItem **不设默认值**：省略时保持 `undefined`，由子组件自己的英文默认接管，英文默认字符串只存在一处、不会漂移；递归子行经同一 `labels` 对象获得同一套文案。操作级同理：`OperationHeader.lifecycle-label` 与 `LifecycleNotice.title` 覆盖对应徽章 / 横幅文案，二者共用 `EndpointLifecycle` 词表（含 beta）。

### FieldAnnotation 的字段引用约束

- `field-ref` 走 `useFieldSource` 的 provide/inject，与 `useGlossary`（foundation，服务 TermAnnotation）同构：页面/布局用 `provideFieldSource()` 注册 `id → { field, page? }`，叙事文本只引 id，不内联 `FieldNode`。同一份 `FieldNode` 应与下方字段树（`ApiDocsFieldItem`）共享单一真源。
- 跳转委托兄弟 `useFieldAnchor`，**不渲染** `<ApiDocsFieldItem>`——故与 field-item 只有 composable 依赖、无组件环。同页深链接目标即页面自身的字段树；跨页时 `page` 拼成 `{page}#{path}`，落地由目标页 `initFromHash()` 处理。
- registry item `api-docs-field-annotation` 经 `registryDependencies` 引入 `api-docs-field-item`（带来 `field.ts` 与 `useFieldAnchor`）与三个 foundation item；`useFieldSource` 随本组件切片分发，**不**在 `files[]` 重列已由依赖闭包传入的共享文件。

## 为什么不用 @nuxt/content 走内容管线？

试过——content v3 靠构建时生成、运行时导入的 SQLite dump 建表，在部分托管 preview 中重启后不能稳定 re-seed（`decompressSQLDump ... Received undefined` / `no such table`），会让 Source-first v0 snapshot 时好时坏。根 gallery 因此保持纯组件 preview；真实消费项目仍可按需引入 content 作为数据源。

## 源码参考（skill 内）

- `kits/api-docs/components/{CodeBlock,RequestExample,ResponseExample}.vue`
- `kits/api-docs/components/{MethodBadge,EventBadge,LifecycleBadge,LifecycleNotice}.vue` + `kits/api-docs/utils/{method,lifecycle}-preset.ts`
- `kits/api-docs/components/{OperationHeader,OperationTarget,CodeRail}.vue`
- `kits/api-docs/components/WebhookProtocol.vue` + `kits/api-docs/utils/webhook-protocol.ts`
- `kits/api-docs/components/{EnumTable,FieldGroup,FieldItem,SchemaComposition,SidebarNav,SiteSearch}.vue` + `kits/api-docs/utils/{enum,field}.ts`（字段 / composition 显示模型,kit auto-import）
- `kits/api-docs/components/FieldAnnotation.vue` + `kits/api-docs/composables/useFieldSource.ts`（Annotation 家族字段形态；壳复用 foundation `AnnotationPopover`）
- `kits/api-docs/composables/{useCodeWrap,useFieldAnchor}.ts`
- 组合演示（demo，不在 kit）：`app/pages/kits/api-docs/index.vue`、`reference.vue`、`sidebar-nav.vue`、`webhook-protocol.vue`、`docs-shell/`（`index.vue` + `[domain]/index.vue` + `[domain]/[slug].vue`）；页面 recipe 在 `app/components/demo/api-docs/`，fixture/adapter 在 `app/utils/demo/api-docs/`（均 gallery-private）
- foundation 依赖：`foundation/components/{CopyButton,SemanticBadge,InlineCode,InlineMarkdown,SplitPane,SplitPaneHandle}.vue`、`foundation/composables/{useCopy,useSplitPane}.ts`、`foundation/utils/{badge,breakpoints}.ts`

## 不要臆造

- 不引入 `@nuxt/content` / Shiki runtime / SQLite 来渲染这些代码块；需要语法高亮时由消费项目在构建期产出并预消毒 HTML，组件只负责显式可信渲染。
- 新增领域组件前，按 `method/component-spec-template.md` 先写 anatomy → states → accessibility 规格。
- prop 名严格对齐：ApiDocsCodeBlock **只认 `variants`**（`{ language, code, label?, highlightedHtml? }[]`，无 `samples`、无单 `code` 快捷；单块也传单元素数组）；ApiDocsRequestExample/ApiDocsResponseExample 用 `scenarios`（单一固定响应即传单场景单状态，select 自动隐藏）。
- ApiDocsCodeBlock 语言切换用 `USelect`（非 UTabs），换行状态经 `useCodeWrap` 共享，chrome 文案经 `labels` 本地化；复制不要在 ApiDocsCodeBlock 里重写，用共享 `CopyButton`。
