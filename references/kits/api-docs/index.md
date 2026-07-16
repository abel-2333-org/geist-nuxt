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
| `api-docs/CodeBlock.vue` | `<ApiDocsCodeBlock>` | 近单色多语言代码块基座（USelect 语言 + 复制 + 换行，无高亮器） | `code-sample.md` |
| `api-docs/RequestExample.vue` | `<ApiDocsRequestExample>` | 按业务场景切换的请求示例（委托 ApiDocsCodeBlock） | `request-example.md` |
| `api-docs/ResponseExample.vue` | `<ApiDocsResponseExample>` | 响应示例：场景+状态切换，也覆盖单一固定响应（委托 ApiDocsCodeBlock） | `response-example.md` |
| `api-docs/MethodBadge.vue` | `<ApiDocsMethodBadge>` | HTTP method 色标（GET/POST/PUT/PATCH/DELETE），mono 字体；preset 包装 core `SemanticBadge` | — |
| `api-docs/LifecycleBadge.vue` | `<ApiDocsLifecycleBadge>` | 生命周期色标（new/beta/active/maintenance/deprecated/sunset）；preset 包装 core `SemanticBadge` | — |
| `api-docs/EnumTable.vue` | `<ApiDocsEnumTable>` | enum 值表（扁平 `values` + 分组 `variants` 两种形态，长表带筛选+滚动） | — |
| `api-docs/FieldGroup.vue` | `<ApiDocsFieldGroup>` | 字段分组容器：mono 大写组标题（`<h2>`）+ 可选计数，包裹一列字段行 | — |
| `api-docs/FieldItem.vue` | `<ApiDocsFieldItem>` | 递归字段行：名/类型/必填三态/默认值/条件/enum/约束注记/lifecycle + 可折叠子字段；深链接由 `useFieldAnchor` 驱动。数据模型 `FieldNode`/`FieldNote` 内联，`EnumValue`/`EnumVariant`/`FieldLifecycle` 从兄弟切片 enum-table/lifecycle-badge 导入 | — |
| `api-docs/SidebarNav.vue` | `<ApiDocsSidebarNav>` | 文档/门户侧边栏导航：一个菜单容纳多个可折叠板块（指南文字链接 vs 接口链接带 method 色标）。分组层（eyebrow 标题 + 分隔线）+ 板块 `kind`（guide 柔和 sans / endpoints 大写等宽 mono，chrome 中性、颜色只交给 method 色标与 active 态）让两类界限分明；多板块可同时展开、各带计数，顶部单一全局搜索跨板块过滤（`/` 聚焦）。数据模型 `SidebarNavGroup`/`SidebarNavSection`/`SidebarNavItem` 内联，接口行复用兄弟切片 `ApiDocsMethodBadge` | `sidebar-nav.md` |

> **组件名 = 目录名 + 文件名**：约定 `components: [{ path: '~/components', pathPrefix: true }]`，所以 `app/components/api-docs/CodeBlock.vue` 的模板名是 `<ApiDocsCodeBlock>`。`api-docs/` 目录前缀既表达 kit 归属，也让这些组件与消费者自己的组件天然隔离、不撞名。

> **preset 型徽章（MethodBadge / LifecycleBadge）** = 在 core 的 `SemanticBadge`（tone 原子）之上，包一层"域词汇 → tone"映射。域词汇 + tone 校准住在随切片一起复制的 `app/utils/{method,lifecycle}-preset.ts`；`SemanticBadge`/`BadgeTone` 由 core 经 `coreDeps` 天然在位。二者写法对称，改词汇只动 preset、不碰组件。

> **参数表**（原 ParamsTable）已按规格重造为 `FieldGroup` + `FieldItem` 两个切片并沉淀进本 kit（见上表）：`FieldGroup` 管分组标题，`FieldItem` 管递归字段行 + 深链接。**端点头**（原 EndpointHeader / `OperationHeader`）仍留在消费层——它是页面唯一 `<h1>` 且形状因项目而异，copy & adapt 更合适；待有稳定通用形态再评估沉淀。

配套依赖（**已在通用基座 starter 里**，无需从 kit 复制）：
- `components/CopyButton.vue` —— 共享复制按钮：`UButton` + 可选 `UTooltip` + `useCopy`，`CodeBlock` 的复制委托给它。
- `composables/useCopy.ts` —— 剪贴板逻辑单一来源：写入委托给 VueUse 的 `useClipboard({ legacy: true })`（异步 Clipboard API + iframe/execCommand 兜底），外层保留 `copied` 态 + Geist voice toast。签名 `copy(text, label?, { successMessage? })`：默认 `label` 填英文句，调用方可传完整 `successMessage` 独占整句以便本地化（见下「复制 toast 完整消息注入」契约）。依赖 `@vueuse/core`（starter 已声明）。

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
> **为���么不用 `<MDC>` / 完整 markdown 引擎**（踩过的坑）：先核实真实数据——payment spec 的 194 条富文本描述**全是行内**（`code`/`link`��0 条 `**`、0 条块级 `>`/列表）。`<MDC>` 是为文件型内容管线设计的：它 per-instance 走 `useAsyncData`（异步），在一页渲染上百个实例时会 SSR→客户端 **hydration mismatch**（`<code>` 节点被包进 `<!--[-->…<!--]-->` fragment 锚点，改 props / `cacheKey` / 关 Shiki 都修不掉），且徒增体积。`markdown-it` 则输出 `v-html` 裸串，**绕过整个 Prose 组件体系**并丢掉 ULink 路由，与"复用设计系统"方向相悖。结论：**行内需求就用同步 tokenizer**（贴合设计系统、SSR 稳定、无异步）；只有当块级 markdown（引用/列表）成为真实需求时，才回头评估 MDC，别上 `markdown-it`。

### 可拖动分栏（通用基座，非本 kit 独有）

典型 API 参考页是「左文档 / 右代码栏」两栏，右栏再纵向分成 Request / Response。通用基座（starter，不在 kit 里）提供三层，从高到低：

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

  设计边界：`SplitPane` 只管**空间分割 + 拖动**。它不知道 slot 里是什么，所以「左 Tab 切换 → 右代码联动」这类内容协调由页面持有 `activeTab`、两个 slot 各自读它来做，`SplitPane` 无需参与。**内容优先重分配（见下）刻意不折进 `SplitPane`**——那与代码卡片的封顶+滚动强耦合，属 api-docs 页专属，留在页面里，`SplitPane` 保持纯净通用。

  以下两个是 `SplitPane` 的**内部零件**，需要脱离容器单独用（比如手写更特殊的布局）时才直接碰：

- `components/SplitPaneHandle.vue`（`<SplitPaneHandle>`）—— 纯展示 + a11y 的分隔把手：1px 分隔线（`border-default` 即 `--ui-border`）+ 居中 grip 药丸。**grip 默认隐藏（`opacity-0`），hover / 拖动中（`active`）/ 键盘 `focus-visible` 时才浮现**——静止时只剩一条素净的 hairline，符合 Geist 克制观感。药丸 hover/drag 转 `bg-primary`。`role="separator"` + `aria-orientation`/`aria-valuenow/min/max`、focus-visible 紫环、方向键/Home/End/Enter 键盘操作、`col/row-resize` 光标。**只报告意图（`dragstart`/`step`/`jump` 事件），不持有任何数值**。主轴尺寸则由消费方（纵向把手可 `self-stretch` 填满，或传 `sticky h-[calc(...)]` 做视口高钉住）。
  - **坑**：`group-hover:` 在 Tailwind v4 会被包进 `@media (hover:hover)`，所以 grip 的 hover 浮现只在有鼠标的设备上生效（触屏/无头浏览器 `hover:none` 不触发，属预期）；触屏与键盘用户靠 `active`（拖动中，非 hover 门控）和 `group-focus-visible`（非 hover 门控）两条路径拿到 grip，affordance 不会丢。别用 `transition-[opacity,background-color]` 这种带逗号的 arbitrary value——逗号会打断 Tailwind 的类名扫描、导致其后同一 `class` 里的工具类（含 `group-hover:*`）不被生成；用普通 `transition` 即可。
- `composables/useSplitPane.ts` —— 轴无关的拖动状态：持有一个数值（栏宽 px、分栏比 0–1…）+ min/max 钳制 + cookie 持久化（`useCookie`+`useState`，同 `useCodeWrap`）+ `Escape` 取消 + rAF 节流。**只管拖动状态，不含任何布局重分配**——内容优先重分配是消费页专属逻辑，作为页面 recipe 下发（见下），不进 core。

  **为什么不复用 Nuxt UI 的 `useResizable`**：`useResizable(key, options)` 是给 Dashboard 面板做的，只支持**横向**拖宽（写死读 `el.parentElement.offsetWidth` + `clientX`）、支持 `%/rem/px` 单位与 collapsible 折叠，但**没有纵向、没有键盘操作（方向键/Home/End）、没有 Escape 取消、没有内容优先重分配**，而且依赖把手包裹一个真实面板 `el`。我们的需求这三块（纵向 Request/Response、键盘 a11y、内容优先重分配）它都缺，横向那一半即便能用也会造成两条边界行为不一致，所以另建一套轴无关原语。命名用 `useSplitPane` 而非 `useResizable` 只是为了和 Nuxt UI 的同名自动导入 API 区分、避免认知混淆——两者签名不同，真撞名是类型错误而非静默遮蔽。

**内容优先重分配（页面 recipe，不在 core）**：这是 api-docs 消费页专属的布局逻辑——它与代码卡片的「封顶 + 滚动」强耦合，故**留在页面里**，不折进 `SplitPane`/`useSplitPane`（core 只提供拖动状态）。gallery 的整页组合 demo `apps/gallery/app/pages/kits/api-docs/reference.vue` 已按此接线：横向 `SplitPane`（左字段树文档流 / 右代码栏）+ 页面私有的 `components/demo/api-docs/CodeRail.vue`（`<DemoApiDocsCodeRail>`，纵向分 Request/Response、内含下面这段重分配纯函数，通过 slot scope 把 `maxHeight` 预算下发给 `ApiDocsRequestExample`/`ApiDocsResponseExample`）。**`CodeRail` 是 gallery 页私有、数据无关的 recipe 载体，刻意不进 core、不入 kit 切片**——下游消费页照它在自己项目里重建即可（放页面同目录 `components`/`utils` 或页面内联，别塞回 core）。

> **gallery 私有 demo 组件按 `demo/<kit>/` 分组**：这类只服务某个 kit demo 页、既非 core 也非 kit 切片的组件，统一落到 `apps/gallery/app/components/demo/<kit>/`（如 `demo/api-docs/CodeRail.vue` → `<DemoApiDocsCodeRail>`）。这样 ① kit 归属编码进目录与调用名；② 与可 copy-in 的真·kit 切片 `ApiDocs*` 命名空间区隔；③ 也不与消费侧领域渲染组件目录 `app/components/reference/*.vue`（下文层 3）撞名。api-docs 后续再加页面级私有组件时一并放进 `demo/api-docs/`，不要按页面名（如 `reference/`）分组。

不要给短代码块强行分半高——那会在卡片里留下大片空白。规则是：

1. 两栏自然高度之和 ≤ 可用高度（fit 态）→ 两栏各按自然高度渲染，右栏整体收缩贴合内容，横向把手设 `disabled`（不可拖、无 grip）。
2. 溢出时（和 > 可用高度）→ 总高封顶为可用高度，按比例分，且**较短的一栏封顶到自然高度、把富余让给溢出的另一栏**；此时横向把手激活，拖动调比例。

页面私有纯函数 recipe：

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

实现要点：用 ResizeObserver 量两栏内部 `<pre>` 的自然高度（滚动容器封顶时 `<pre>` 仍报告完整内容高）；`RequestExample`/`ResponseExample` 已支持接收 `maxHeight` 预算，非 fill 态下 CodeBlock 先长到内容高再封顶滚动。断点上只在 `lg+` 启用拖动，`<lg` 回退��堆叠 + 自然高、无把手。`:style` 绑定**始终返回对象（用空串占位），绝不 `undefined`**��—否则 SSR 水合时 `undefined→对象` 的过渡会被 Vue 跳过、宽/高静默不生效。断点判断用手写 `matchMedia` 监听（`onMounted` 建立��，别用 VueUse `useMediaQuery`（此处水合后同步不可靠）。

  - **坑（务必）：RO 回调里的 `measure()` 必须 `requestAnimationFrame` 延迟，不能同步调用**。虽然 `<pre>` 的内容高不受 budget 影响，但 RO 同时也观��了 pane **包裹层**，而包裹层高度正是 `measure()` 通过 `budgets`→`reqStyle/resStyle` 写入的——同步重测就构成「写高度��同帧再触发观察」的闭环，浏览器会抛 `ResizeObserver loop completed with undelivered notifications`。把回调合并进单个 rAF（并 `cancelAnimationFrame` 去抖、`onBeforeUnmount` 清理）即可打断同步投递链，��重分配仍在下一帧内完成、视觉无感。同理，`SplitPane` 内部量容器宽算 `max` 时也必须 rAF 延迟写入——注意**别用 VueUse 的 `useElementSize`**：它在自己的 RO 回调里同步写 ref，在这种「量尺寸→改 flex→再触发」的场景里照样闭环。直接用 `useResizeObserver` 拿 `contentRect`、在 rAF 里写自己的 `mainSize` ref 才安全。

## 如何装入项目

组件源码在 `packages/kits/api-docs/`（不在通用基座里）。**装入以 `registry.json` 切片为单位**（权威清单：`packages/kits/api-docs/registry.json`），按条目把 `files` 列的文件**全部**拷进项目：

1. 按需要的条目整切片复制：如 `code-block` 切片 = `app/components/api-docs/CodeBlock.vue` + `app/composables/useCodeWrap.ts`，按各文件 `target` 拷到项目的 `app/components/api-docs/` 与 `app/composables/`（保留 `api-docs/` 目录）。`registryDependencies` 里列的切片要先拷（如 `request-example` 依赖 `code-block`）。
2. **core 依赖零动作**：`CopyButton` / `useCopy` 由 `@geist-nuxt/core` layer 提供（registry 条目的 `meta.coreDeps` 有声明），项目 `extends: ['@geist-nuxt/core']` 即天然在位，不需要复制。
3. 组合方式（怎么把请求 + 响应 + 徽章 + 字段树拼成一页）不作为切片分发——kit 只 ship 数据无关积木（代码块/请求/响应/method·lifecycle 徽章/enum 表/字段树），组合示例见 gallery 两个 demo 页：单组件陈列看 `index.vue`、整页两栏参考页装配看 `reference.vue`（含 `<DemoApiDocsCodeRail>` 重分配 recipe），按需在自己项目里照着拼。
4. 无需为本 kit 额外装包——组件只用 `@nuxt/ui` 原语 + Nuxt 内置 composable；唯一的第三方依赖是 `useCopy` 用到的 `@vueuse/core`，它是 core 包的依赖、随 core 自动就位。**不要**装 Shiki / `@nuxt/content`。

> **组件名 = 目录名 + 文件名**：约定 `pathPrefix: true`，所以 `app/components/api-docs/CodeBlock.vue` 在模板里是 `<ApiDocsCodeBlock>`。切片必须整体落到消费者的 `app/components/api-docs/`（保留目录），前缀才成立，也才与消费者自有组件隔离。

## 组合示例（demo 在 gallery，不在 kit）

组合方式是 demo/story，按 geist-nuxt「demo 归 gallery、kit 只 ship 数据无关积木」的分层。
gallery 有**两个 api-docs demo 页，职责互补**：

| 页面 | nav 标签 | 定位 | 演示什么 |
|---|---|---|---|
| `apps/gallery/app/pages/kits/api-docs/index.vue` | 组件目录 | **逐个陈列**（catalog） | 每个 kit 组件在带标签的分区里单独展示：代码块 / 请求 / 响应 / method·lifecycle 徽章 / enum 表 / 字段树（含紧凑 + 高密度两组压力用例） |
| `apps/gallery/app/pages/kits/api-docs/reference.vue` | 参考页组合 | **整页级场景组合** | 招牌两栏参考页：横向 `SplitPane`（左字段树 / 右代码栏）+ 页面私有 `<DemoApiDocsCodeRail>`（纵向分 Request/Response、内容优先重分配）。是下游消费页 copy & adapt 的活骨架 |

> 两页都用内联假 ViewModel 驱动，数据不写进 kit。**新增单组件的陈列进 `index.vue`；新增整页装配 recipe 进 `reference.vue`**（或另起一页）。

最小拼法（单区块，index.vue 风格）：

```vue
<template>
  <section id="api-docs" class="space-y-8">
    <ApiDocsCodeBlock :variants="requestSamples" />
    <ApiDocsResponseExample :scenarios="responseScenarios" />
  </section>
</template>
```

`requestSamples` 形如 `[{ label: 'cURL', language: 'bash', code: '...' }, ...]`。数据一律由消费方（页面 / adapter）注入，不写进 kit。

## Accessibility（无障碍）

- CodeBlock 的复制委托给共享 `CopyButton`：动态 `aria-label`（Copy / Copied）+ `role=status aria-live=polite` 播报；语言 USelect 的键盘导航与 `aria-*` 由 Reka UI 内置。
- ResponseExample：状态码色 + 文本双通道，不单靠颜色传达含义。
- 全部组件的色彩用 Geist 语义 token（`text-highlighted` / `text-muted` / `bg-elevated` / `border-default`），随 color-mode 明暗切换。

### 页面级结构 / 语义（review 沉淀）

装配整页时容易漏掉、但 review 必查的几条：

- **标题层级不跳级**。页面只有一个 `<h1>`（operation 标题，在 `OperationHeader`，加 `text-balance` 防孤字）；其下的字段分组标题（`FieldGroup`）必须是 `<h2>`，不要图视觉小就写成 `<h3>`/`<h4>` 造成 `h1→h3` 跳跃。**用原生语义标题 `<h1>/<h2>`，不要用 Nuxt UI 的 `ProseH*`**——`ProseH*` 是 markdown 内容管线组件（读 `mdc.headings` 配置决定是否注入 `#` 锚点、排版是长文正文尺度），本 kit 刻意不装 MDC，用它只会退化成带正文尺度的普通标题并引入隐式 MDC 依赖。这些标题是「应用界面结构」而非「渲染出的 markdown 正文」，属不同层。
- **站内链接一律 `NuxtLink`/`ULink`，页面模板里也不例外**。不止 `ProseText` 内部——页面骨架里的 logo、面包屑、"Learn more" 之类引用链接同样别手写 `<a href="/x">`（会整页刷新、丢预取）。这是基座决策表「单链接用 ULink」的延伸，最易在 header / 摘要被漏掉。
- **提供 skip link**：`header + main` 结构要在最顶部放一个聚焦前 `sr-only`、`focus:not-sr-only` 的「Skip to content」锚点，`href="#main-content"` 指向 `<main id="main-content">`，让键盘 / AT 用户跳过 header。
- **`<img>` 显式 `width`/`height`**。即使有 `size-*` 兜底，也要写死内在尺寸防 CLS。
- **flex 子项要截断先加 `min-w-0`**。像端点 path 的 `<code class="flex-1 truncate">` 必须配 `min-w-0`，否则 flex item 默认 `min-width:auto` 不会收缩、`truncate` 失效。

## 架构蓝图：spec 驱动的渲染栈（pattern，非 drop-in）

> **这一节是「怎么设计」的蓝图，不是可复制的资产。** kit ship 的是一组**数据无关的展示积木**（代码块 / 请求 / 响应 / method·lifecycle 徽章 / enum 表 / 字段树 `FieldGroup`·`FieldItem`，类型内联或依赖 core、拷贝即用）。而把它们接到**真实数据源**（自定义 spec DSL、OpenAPI 等）所需的 adapter、类型分层、以及页面唯一 `<h1>` 的端点头 `OperationHeader`，是**消费项目自己的一层**——因为每个项目的 spec 形状不同，adapter 必然要改。所以这里**沉淀设计决策与契约，不抄易腐的实现代码**；需要具体实现时看下方「参考实现真源」的指针。
>
> **本节按「层」组织，且刻意保持单文件多小节**：API 文档的架构层是稳定的少数几种（输入契约 / 领域模型 / 适配 / 字段渲染）。未来新增一层就在本节加一个 `###` 小节；只有当架构主题真的膨胀到 ~5+ 且彼此正交时，才拆成 `architecture/` 子目录 + index —— 拆分永远比预建便宜，别过早建目录。

### 分层总览（依赖方向图）

```
authoring 输入            适配                 领域输出              渲染
  spec.ts        ──►   spec-adapter.ts   ──►   domain.ts     ◄──   components/
 (Raw* + DSL)         (raw → resolved)      (FieldNode 等)        (reference/ + api/)

依赖只指向 types，绝不反向：
   components  ──►  domain.ts  ◄──  spec-adapter.ts
                        ▲
                        └── spec.ts（输入契约复用 domain 里的共享词汇枚举）
```

三条铁律：
1. **adapter 绝不 `import` 任何 `.vue`**。展示类型（`CodeVariant`/`RequestScenario`/`ResponseScenario` 等）下沉到 `domain.ts`，组件与 adapter 都从类型模块取；否则数据层反向依赖 UI 层，组件一改就断。
2. **组件间不互相借类型**。每个组件各自从 `~/types/domain` import，别从兄弟 `.vue` import（会织成互相依赖网）。
3. **类型文件成对命名，输入 vs 输出**：`spec.ts`（作者写的 authoring 输入）↔ `domain.ts`（UI 渲�� / adapter 产出的领域模型）。不要用 `reference.ts` 这种混「域」与「层」的名字。

### 层 1：authoring 输入契约（`types/spec.ts`）

- 内容：`EndpointSpec` + 各 `Raw*`（`RawField`/`RawEnum`/`RawConstraint`/`RawExample`…）+ `Localized`。
- 价值：文档项目 `import type { EndpointSpec }` 给 `defineEndpointSpec()` 做**类型约束**——spec 写错，authoring 时就报错，不用等运行。
- 纯 type-only 模块，import 它不会拉进 adapter 的运行时逻辑。
- **共享词汇枚举**（`FieldLifecycle`/`EndpointLifecycle`/`AuthRequirement`）放在 `domain.ts`、由 `spec.ts` 复用即可——它们输入输出同形（枚举是词汇表、Auth 是 passthrough），不值得为「纯粹」拆第三个文件。

### 层 2：适配（`utils/spec-adapter.ts`）

- 只留转换函数 + 产物类型 `AdaptedSpec`，输入从 `~/types/spec`、输出从 `~/types/domain` import。
- **examples 必须走 adapter，spec 是唯一数据源**：`request.examples`/`response.examples` 在此映射成组件要的 `scenarios`，**别在页面硬编码场景常量**（踩过：页面用写死假数据，改 spec 毫无反应，因为链路根本没接）。spec 的单一 body 原样渲染成一个 `json` 变体，不伪造 spec 里不存在的 curl/node/python 变体。
- i18n 收在这层：`loc()` 按 `LOCALE` 把 `Localized` 压成单语；切 `LOCALE='zh'` 全页转中文，组件无需改。

### 层 3：领域输出 + 字段渲染（`types/domain.ts` + `components/reference/`）

- `domain.ts`（消费层）：`FieldNode`（递归字段树）、`Nullability`、`EnumValue`/`EnumVariant`��`FieldContractNote`、lifecycle、以及示例展示类型。注：这些字段展示类型现已进 kit，按归属分散在各切片——`FieldNode`/`FieldNote` 在 field-item（`FieldContractNote` 在 kit 侧更名为更中性的 `FieldNote`），`EnumValue`/`EnumVariant` 在 enum-table，`FieldLifecycle` 在 lifecycle-badge，field-item 再导入后两者;消费层的 `domain.ts` 仍是 adapter 的输出真源，按需 adapt，两侧结构化兼容。
- 组件清单（各自职责，实现看真源）：

  | 组件 | 归属 | 职责 |
  |---|---|---|
  | `OperationHeader` | 消费层 | 页面唯一 `<h1>` + method/path + 端点 lifecycle（吃端点 domain，头因项目而异，copy & adapt） |
  | `ApiDocsFieldGroup` | **kit 切片** | 字段分组容器，组标题是 `<h2>` + 可选计数；零依赖，拷贝即用 |
  | `ApiDocsFieldItem` | **kit 切片** | 递归字段行：名/类型/必填三态/默认值/条件/enum/约束注记（`FieldNote`）/lifecycle/嵌套递归；`FieldNode`/`FieldNote` 内联定义，`EnumValue`/`EnumVariant`/`FieldLifecycle` 从所依赖的兄弟切片（enum-table / lifecycle-badge）**导入并 re-export**（编译期强制、防跨切片漂移）。深链接由 `useFieldAnchor`（随切片同 ship）驱动 |
  | `ApiDocsEnumTable` | **kit 切片** | enum 值表（扁平 `values` + 分组 `variants` 两种形态）；类型内联，拷贝即用 |
  | `ApiDocsMethodBadge` | **kit 切片** | HTTP method 色标（色+文本双通道）；preset 包装 core `SemanticBadge` |
  | `ApiDocsLifecycleBadge` | **kit 切片** | 字段/端点生命周期色标；preset 包装 core `SemanticBadge` |
  | `SemanticBadge` | **core** | tone 原子（色+图标+文本）；域→tone 映射留在上面的 preset 徽章里 |
  | `InlineCode` | **core** | 行内代码 token（ProseCode 校准到 Geist） |
  | `InlineMarkdown` | **core** | 字段描述的行内 markdown tokenizer（`code`/链接/粗斜/删除线） |

- **字段深链接（`useFieldAnchor`，随 `field-item` 切片同 ship）消费者须知**：
  - **必需**：在渲染字段树的页面 `onMounted` 里调 `useFieldAnchor().initFromHash()`，让带 `#field-path` 进入时自动展开祖先 + 滚动 + 高亮。
  - **可选打磨**：在自己的 `app/router.options.ts` 的 `scrollBehavior` 里加 `if (to.hash) return false`，消除冷启动深链接的一次滚动闪烁。**kit 不下发 `router.options.ts`**——它是全局单例、属消费层职责，多数消费者已有该文件，合并这一行即可。缺了它 composable 仍功能正确（只是冷启动会闪一下）。
  - composable 自足：`copyLink` 走 `history.replaceState`（不触发路由导航）、`goTo` 自管「展开→等布局稳→滚动→高亮」，均不依赖 Vue Router 的 scrollBehavior。

- **跨切片共享类型走「导入而非各抄一份」**：`FieldItem` 运行时就渲染 `<ApiDocsEnumTable>`/`<ApiDocsLifecycleBadge>`（已在 `registryDependencies` 声明），因此它直接 `import type` 这两个切片的 `EnumValue`/`EnumVariant`/`FieldLifecycle` 并 re-export，而不是重定义同形副本。导入只是让编译器承认这个既有依赖——某切片改了类型另一处立即报错，而非静默漂移；仍 copy-safe（依赖切片必随 field-item 一起复制，相对路径成立）。这正是 registry 依赖规则第 2 条的落地。
- **复制反馈不放 per-row live region**：字段深链接复制走 core `useCopy()`，它已 `toast.add(...)` 经 Nuxt UI 单一 app 级 polite region 播报，锚点按钮 `aria-label` 亦随 copied 切换。故 FieldItem **不**为每行放 `role="status"`——否则大表会堆几十个（多为空）region 且三重播报。新增 CodeBlock 之外的复制场景时沿用此约定：复制播报交给 toast，别在每个可复制元素上再加 live region。
- **复制 toast 文案走「完整消息注入」，不拼半句**：`useCopy().copy(text, label?, { successMessage? })`——默认用 `label` 填英文句 `<label> copied to clipboard`（共享 Geist voice）；需本地化整句的调用方传**完整** `successMessage` 独占所有权。FieldItem 即经其 `labels.linkCopied(fieldName)` 槽提供整句（与 `copyLink`/`required` 等 chrome 文案同一本地化面），`useFieldAnchor.copyLink(path, successMessage?)` 只透传、**不**在 composable 内拼字段名。原因：半句拼接（core 拥半句英文脚手架 + 调用方拼另半句）无法整体本地化、会造成「aria 中文 / toast 英文」混语；完整消息让每条文案要么完全由 core 默认拥有、要么完全由调用方 `labels` 拥有，无中间态。新增需要具名/本地化 toast 的复制场景时照此传 `successMessage`，勿回退到拼接。

### 契约规则（跨层，务必遵守）

- **可空性用判别联合，让非法状态不可表达**：`type Nullability = { nullable: false } | { nullable: true, when?: string }`，而非 `value: { empty?, when? }` 这种把布尔与条件糊在一起、能写出「不可空却带为空条件」的矛盾形状。语义锁定「字段结构上恒在、只是值可能为空」（CSV 列 / JSON 键都适用），不要兼职表达「字段可省略」（那是请求侧 `required` 的活）。判别联合还会在 typecheck 阶段逼你把 note 生成函数参数收窄到 `nullable: true` 分支，天然防错。
- **字段锚点 id 用 slug 分段 + `.` 连接**：真实字段名带空格（`Settlement Date`）或下划线（`Order_Currency`）时别直接拿 `name` 当 DOM id（会产生含空格 id 让 `querySelector` 崩、以及与分隔��� `_` 撞车的歧义）。每段 slugify（小写、非字母数字→`-`）再用 `.` 连父路径（`response-body.csv.batch.settlement-date`），fixture 实测 0 空格 / 0 冲突 / 0 前缀歧义；`name` 只留作展示、保真原始拼写。

### 参考实现真源（copy & adapt，别 drop-in）

具体实现不复制进 kit（会与项目漂移），去真源看最新版本，照着**重建**自己项目的 adapter/类型（spec 形状不同，本就该 adapt）：

- `abel-2333-org/geist-nuxt` 消费项目侧：`app/types/spec.ts`、`app/types/domain.ts`、`app/utils/spec-adapter.ts`、`app/components/reference/*.vue`、`app/composables/useFieldAnchor.ts`。

## 为什么不用 @nuxt/content 走内容管线？

试过——content v3 靠构建时生成、运行时导入的 SQLite dump 建表，在托管 dev server 上每次重启不能稳定 re-seed（`decompressSQLDump ... Received undefined` / `no such table`），导致页面时好时坏。对一个要被分发、套用到新对话的 starter 是不可接受的可靠性风险。且 brief 本就要求「用规格模板做领域组件」，组件式组合才是正解。

## 源码参考（skill 内）

- `packages/kits/api-docs/app/components/api-docs/CodeBlock.vue`
- `packages/kits/api-docs/app/components/api-docs/RequestExample.vue`
- `packages/kits/api-docs/app/components/api-docs/ResponseExample.vue`
- `packages/kits/api-docs/app/components/api-docs/MethodBadge.vue` + `app/utils/method-preset.ts`
- `packages/kits/api-docs/app/components/api-docs/LifecycleBadge.vue` + `app/utils/lifecycle-preset.ts`
- `packages/kits/api-docs/app/components/api-docs/EnumTable.vue`
- `packages/kits/api-docs/app/components/api-docs/FieldGroup.vue`
- `packages/kits/api-docs/app/components/api-docs/FieldItem.vue`（字段展示类型内联导出于此）
- `packages/kits/api-docs/app/composables/useCodeWrap.ts`
- `packages/kits/api-docs/app/composables/useFieldAnchor.ts`（字段深链接，随 field-item 切片同 ship）
- 组合演示（demo，不在 kit）：`apps/gallery/app/pages/kits/api-docs/index.vue`（组件目录，含 `router.options.ts` 演示可选打磨）、`apps/gallery/app/pages/kits/api-docs/reference.vue`（整页两栏参考页）+ `apps/gallery/app/components/demo/api-docs/CodeRail.vue`（`<DemoApiDocsCodeRail>`，纵向分栏 + 内容优先重分配，gallery 页私有）
- 基座依赖：`packages/core/app/components/CopyButton.vue`、`packages/core/app/composables/useCopy.ts`、`packages/core/app/components/SemanticBadge.vue`、`packages/core/app/components/{InlineCode,InlineMarkdown}.vue`、`packages/core/app/utils/badge.ts`
- 可拖动分栏（基座）：`packages/core/app/components/SplitPane.vue`（首选入口）、`packages/core/app/components/SplitPaneHandle.vue`、`packages/core/app/composables/useSplitPane.ts`

## 不要臆造

- 不引入 `@nuxt/content` / Shiki / SQLite 来渲染这些代码块——组件式自包含即可。
- 新增领域组件前，按 `method/component-spec-template.md` 先写 anatomy → states → accessibility 规格。
- prop 名严格对齐：ApiDocsCodeBlock **只认 `variants`**（`{ language, code, label? }[]`，无 `samples`、无单 `code` 快捷；单块也传单元素数组）；ApiDocsRequestExample/ApiDocsResponseExample 用 `scenarios`（单一固定响应即传单场景单状态，select 自动隐藏）。
- ApiDocsCodeBlock 语言切换用 `USelect`（非 UTabs），换行状态经 `useCodeWrap` 共享，chrome 文案经 `labels` 本地化；复制不要在 ApiDocsCodeBlock 里重写，用共享 `CopyButton`。
