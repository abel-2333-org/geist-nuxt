# ApiDocsSidebarNav `<ApiDocsSidebarNav>`

文档 / 开发者门户的**侧边栏导航**：一个菜单容纳多个**可折叠板块**，而各板块指向的页面性质差异很大——「指南」板块是文字链接，「接口」板块是**按用途命名**的端点链接。**接口不严格遵循 REST、一个接口常服务多个业务场景**（订阅、授权…），所以它**只出现一次**：行首是**请求方法色标**（单个动词，「怎么调」）、中间是用途名、行尾是**场景标签**（「用在哪」）——菜单同时讲清「这个接口怎么调、用来干什么」，而不必按动词把它拆成多条。**两条正交手段让两个世界界限分明**：① **分组层**把板块归入带 eyebrow 小标题的分组（如「文档」「API 参考」），组间有分隔线；② **板块分型**（`kind`）驱动板块头样式——`guide` 型是柔和 sans 句式，`endpoints` 型是大写等宽（mono）。分型只靠排版承载，chrome 颜色留给 active 态（方法色标自带其 tone），避免整列喧闹。板块可**同时展开**、各带一个**计数**，顶部**单一全局搜索**跨所有板块过滤（`/` 聚焦，**同时匹配用途名、请求方法与场景标签**，输入场景名或方法名即可浮出对应接口），因此某个子项很多的大板块也能被快速检索到、不必滚动翻找。侧栏还**可拖拽右边缘调整宽度**，宽度记入 localStorage、刷新仍保留。至于**全站全文搜索**（`⌘K`）则属于 app 顶栏、与侧栏就地过滤不同层级，不并排堆在侧栏里（见下方「就地过滤 vs 全站搜索」）。

> 文件放在 `components/api-docs/SidebarNav.vue`。约定 `pathPrefix: true`，组件名 = 目录名 + 文件名，所以模板名是 `<ApiDocsSidebarNav>`。数据无关：导航数据模型内联随组件走，所有 chrome 文案经 props 注入（i18n-ready）。

## Anatomy（结构）

```
nav (landmark, 粘顶 + 自身滚动区，可拖拽调宽)
├─ #header  ── 可选 slot：头部最上方的通用扩展点（默认不用；全站搜索应放 app 顶栏而非此处）
├─ search   ── UInput（放大镜图标 + UKbd '/' 提示 / 清除按钮）——导航树内就地过滤
├─ 滚动区
│  └─ group ×M  ── 可选 eyebrow 小标题（mono 大写 tracking，text-dimmed）+ 组间分隔线
│     └─ section (UCollapsible) ×N
│        ├─ trigger  ── chevron（展开转 90°）· 可选 icon · 板块标题 · 计数 UBadge
│        │              · guide 型：sans 句式、中性图标
│        │              · endpoints 型：mono 大写 tracking（chrome 保持中性，颜色只交给 active 态）
│        │              · 计数 UBadge 两型统一为 neutral subtle
│        └─ content  ── item (ULink) 列表，左侧一条中性 border 缩进
│           ├─ 指南项：可选 icon + label
│           └─ 接口项：前置方法色标（ApiDocsMethodBadge，定宽槽对齐）+ 用途名 label（sans）+ 后置场景标签簇（ApiDocsScenarioTags：测量真溢出，能放几个铺几个、余下折 +N，一个都放不下才收成计数 chip）（+ 可选尾部 badge）
└─ resizer  ── 右边缘 role="separator" 拖拽手柄（lg+ 显示；悬停/聚焦/拖拽时变紫 1px→2px；鼠标拖拽、键盘 ←→/Home/End、双击复位）
```

板块**多开**（各自独立开合，适合边看边对照）；菜单再长也只在 `nav` 内部滚动，不影响页面布局。搜索时空分组自动隐藏，边界只框住真实命中。

## Props

| prop | 类型 | 说明 |
|---|---|---|
| `groups` | `SidebarNavGroup[]` | **首选**：带 eyebrow 标题的分组，每组含若干板块。给出即用它 |
| `sections` | `SidebarNavSection[]` | 向后兼容：扁平板块列表，内部自动包成一个无标题分组。与 `groups` 二选一 |
| `ariaLabel` | `string` | `<nav>` 地标可访问名，默认 `Documentation` |
| `searchable` | `boolean` | 是否显示顶部搜索，默认 `true` |
| `searchPlaceholder` | `string` | 搜索占位符 / aria-label，默认 `Search` |
| `searchShortcut` | `string` | 键盘提示 + 聚焦搜索的按键，默认 `/` |
| `clearLabel` | `string` | 清除按钮的 aria-label，默认 `Clear search` |
| `emptyLabel` | `string` | 搜索无结果时的文案，默认 `No matching pages` |
| `resizable` | `boolean` | 是否允许拖拽右边缘调宽，默认 `true`。为 `false` 时不加宽度、不渲染手柄 |
| `minWidth` / `maxWidth` | `number` | 宽度上下限（px），默认 `220` / `460`，拖拽与键盘都会 clamp 到此区间 |
| `defaultWidth` | `number` | 无持久值时的初始宽度（px），默认 `288`；双击手柄复位到它 |
| `widthStorageKey` | `string` | 宽度持久化的 localStorage 键，默认 `api-docs-sidebar-width` |
| `resizeLabel` | `string` | 拖拽手柄的 aria-label，默认 `Resize sidebar` |

## Slots

| slot | 说明 |
|---|---|
| `header` | 可选，**通用扩展点**。渲染在粘顶头部**最上方**（就地过滤框之上）。给出时头部自动出现；不给则头部只有过滤框。**注意**：全站全文搜索（`⌘K`）**不建议**塞这里——它属于 app 顶栏、与侧栏就地过滤是不同层级（见下方「就地过滤 vs 全站搜索」）。此 slot 留给确实需要在导航顶部放东西的少数场景（如版本切换器、区域切换）。 |

### 数据模型（内联，随切片走）

```ts
interface SidebarNavItem {
  label: string             // 显示文本（已本地化）。接口行=用途名（非路径）
  to?: string               // 路由；用 ULink 渲染，active 态 + 预取自动生效
  method?: string           // 单个 HTTP 请求方法（如 'POST'）→ 前置 ApiDocsMethodBadge（「怎么调」）
  scenarios?: string[]      // 该接口服务的业务场景（如 ['订阅','授权']）→ 后置中性场景标签（「用在哪」）
  icon?: string             // 行首 Iconify 图标（指南板块）；接口行忽略（被方法色标取代）
  badge?: string | number   // 可选尾部 badge（如 "beta"）
  active?: boolean          // 强制 active（demo/手控）；通常由 to 推断
}
type SidebarNavKind = 'guide' | 'endpoints'  // 板块呈现家族
interface SidebarNavSection {
  id?: string            // 稳定 id，缺省时取 label 的 slug
  label: string          // 板块标题（已本地化）
  kind?: SidebarNavKind  // 呈现家族，缺省 'guide'（endpoints = mono 大写 tracking，chrome 中性）
  icon?: string          // 板块头可选图标
  items: SidebarNavItem[]
  defaultOpen?: boolean  // 首次渲染即展开；搜索激活时被忽略
}
interface SidebarNavGroup {
  id?: string            // 稳定 id，缺省时取 label 的 slug
  label?: string         // eyebrow 小标题；省略则为无标题的引导组
  sections: SidebarNavSection[]
}
```

## 关键点

- **界限分明靠两条正交手段**：① **分组层**（`SidebarNavGroup.label`）——板块归入带 eyebrow 小标题的分组，组间加分隔线与上留白，把「指南世界」与「接口世界」框成两块领地；② **板块分型**（`SidebarNavSection.kind`）——`guide` 型板块头是柔和 sans 句式 + 中性图标，`endpoints` 型是 mono 大写 tracking。**分型只用排版区分、不涂色**：计数徽章、缩进线、图标、场景标签一律中性，颜色只由 active 态承载，避免整列 chrome 被紫色装饰喧闹（`primary` 是强调色，应留给选中态）。二者叠加后，即使只扫板块头（不展开）也一眼分得清类型。
- **接口按用途命名、非路径；一个接口服务多个场景但只出现一次**：我们的 API 不严格遵循 REST 语义，一个接口常覆盖多种**业务场景**（订阅、授权、支付、退款…），所以**菜单标签用用途名**（如「发起支付」「客户管理」）、**不用路径**，且这个接口在菜单里**只出现一次**——它服务哪些场景由 `scenarios` 里的**场景标签**表达，而不是按场景重复列出。接口行的排布是**前置方法色标 + 用途名（sans，主标识）+ 后置场景标签簇**：`method`（单个 HTTP 动词）承载「这个接口怎么调」，用途名承载「这是什么接口」，场景标签承载「它服务哪些场景」，多个场景即表达「一接口多场景」（如 `POST`「发起支付」带 `支付` `订阅` `授权`）。方法与场景是两个正交维度——一个说调用方式、一个说业务归属，故一前一后分列。**场景标签簇按可用宽度测量真溢出**（`ApiDocsScenarioTags`：能放几个就铺几个、余下折 `+N`，一个都放不下才收成计数 chip；见下方「方法色标前置定宽」），因此侧栏够宽时全部场景平铺、窄时优雅降级，用途名始终不被挤掉。
- **异构行靠数据区分，不靠 variant**：同一个 `items` 里，带 `method`/`scenarios` 的是接口行（前置方法色标 + 后置中性场景标签），带/不带 `icon` 的是指南行。**方法色标是唯一带色的元素**（复用 `ApiDocsMethodBadge`，GET→info、POST→success、PUT→warning、PATCH→secondary、DELETE→error），因为它是有限受控词表、颜色能有效编码语义；**场景标签是纯 neutral soft `UBadge`、不涂色**（场景是开放词表，涂色会失控、也会与方法色标抢注意力），chrome 其余颜色只留给 active 态。
- **全局搜索是唯一搜索入口、同时匹配用途名 / 方法 / 场景标签**：顶部一个 `UInput` 过滤所有板块——板块标题命中则整块保留，否则只留 **label、method 或场景标签命中**查询的 item（`matchesText` 同时查 `label`、`method`、`scenarios`）；有查询时**命中板块强制展开**，让结果始终可见，计数徽章显示 `命中/总数`。因此**输入场景名（如「订阅」）或方法名（如「POST」）都会浮出对应接口**，跨板块聚合了这个多对多关系；「大板块子项多」的检索需求也由这个全局搜索覆盖，无需每块再放搜索框，也不需要额外的过滤 chips。
- **就地过滤 vs 全站搜索是两件正交的事，靠层级区分而非并排堆叠**：本组件只做**导航树内就地过滤**（顶部 `UInput`，收窄结构化的导航项 label 与场景标签）。**全站全文搜索**（`⌘K` 模态、跨整站文档正文、Fuse/`useSearchCollection`）是另一套交互，由 Nuxt UI 的 `<UContentSearch>` / `<UContentSearchButton>` 承担、**绑死 `@nuxt/content`**，它的正位是 **app 顶栏 / navbar**——和侧栏就地过滤不同层级、不同位置（参考 Nuxt UI / Vercel 文档站）。**切忌把全站搜索按钮塞进侧栏顶部**：两个长得几乎一样的搜索框上下紧贴，只会让用户困惑"这俩有啥区别"，是冗余 chrome。全文检索接线（含把 `UContentSearchButton` 放进顶栏）留给消费项目（见 `project-setup.md`）；**基座保持数据无关、不引 `@nuxt/content`**，也切勿把 `UContentSearch` 焊进本组件。
- **菜单自身是滚动区**：`nav` 用 `max-h-[calc(100dvh-4rem)]` + 顶部 `search` 粘住、下方 `overflow-y-auto`。多板块同时展开把列表撑长时只在侧栏内部滚动，页面其余部分不动。
- **方法色标前置定宽、用途名让路、场景标签测量式溢出后置**：方法色标放在 `w-14` 定宽槽里 leading，故不论动词是 `GET` 还是 `DELETE`，各行用途名的起始 x 都对齐；用途名是 `shrink truncate` 且有 `min-w-16` 保底——它**让路**给标签而非独占剩余空间，同时保住可读地板；场景标签簇 `ApiDocsScenarioTags` 是 `flex-1`，接住用途名让出的空间。**标签簇做测量式溢出（responsive overflow），而非按断点猜**：组件内一个 `aria-hidden` 的隐藏测量层渲染全部标签取其真实像素宽，配合 `ResizeObserver` 观察自身分到的宽度，贪心算出「能放几个整标签」——放不下的折 `+N`（预留其宽度），连一个都放不下才收成**计数 chip**（`i-lucide-tag` + 场景总数）。因此它**与数据无关**：2 个短标签还是 8 个长标签、中文还是拉丁文都精确自适应；侧栏够宽时全部场景平铺，拖窄时逐个让位、绝不出现被 `truncate` 挤成零字符的空标签，和拖拽调宽形成正反馈。**折叠项的揭示用 `click` 态 `UPopover` 而非 tooltip**：`+N` / 计数 chip 是一个可聚焦的 `<button>` 触发器，tap / 点击 / Enter 三端都能打开列出全部场景的浮层（tooltip 在触摸端不触发、且套在非交互 badge 上键盘也够不到，故不合适——见 `components/overlays.md`）；`sr-only` 全量列表再兜底屏幕阅读器。**SSR 安全**：测量前渲染确定性默认（首标签 + `+N`），`onMounted` 后再测量精修，无 hydration 失配。指南行无方法时改由 `icon` 占前置位。
- **宽度可拖拽、记 localStorage（lg+ 渐进增强）**：右边缘一个 `role="separator"` 手柄，`mousedown` 后在 `window` 上跟踪 `mousemove`（而非手柄自身，避免快速拖拽甩出命中区就断开），`mouseup` 落定并写入 `localStorage`。宽度经 `clampWidth` 夹在 `[minWidth, maxWidth]`。键盘等价可操作（`←/→` 微调、`Shift` 粗调、`Home/End` 跳到上下限），双击复位。手柄静息透明、仅在 hover/focus/拖拽时显紫，静息边缘和其余 chrome 一样安静。**调宽是桌面(`lg+`)的渐进增强**：手柄 `hidden lg:flex`，宽度也只在 `lg+` 应用——根节点用 `w-full lg:w-[var(--api-docs-nav-w)]`（`width` 经 CSS 变量注入），故小屏侧栏取**满宽跟随父容器、绝不横向溢出**,桌面才吃固定像素宽。**SSR 安全**：`width` 初值 = `defaultWidth`（服务端/客户端一致，无 hydration 失配），持久值在 `onMounted` 后读取。`:resizable="false"` 可整体关闭（不加宽度、不渲染手柄）。
- **折叠动画走 Nuxt UI `UCollapsible` 默认**：不覆盖 `ui.content`，直接复用主题内建的 `collapsible-down/up` 动画，`prefers-reduced-motion` 由 layer 全局处理。

## 状态（state model）

- 板块：collapsed / expanded（多开）、trigger hover、`focus-visible` 紫环。
- item：default / hover / **active（`aria-current="page"`，由 ULink 依 `to` 判定）** / `focus-visible`。
- 搜索：empty / has-query（命中板块强制展开 + 计数转 `命中/总数`，空分组整组隐藏、只留有命中的领地）/ no-results（空态文案）。has-filter 即 has-query。
- 方法色标 / 场景标签：均为静态展示、无交互态（不可点选、不参与过滤）——方法色标标「怎么调」、场景标签标「用在哪」，检索一律走顶部搜索。
- 调宽手柄：idle（透明）/ hover / `focus-visible` / dragging（`isResizing`），后三态显紫、1px→2px；拖拽时 `nav` 加 `select-none` 防误选文本。

## Accessibility（无障碍）

- 根节点是 `<nav :aria-label>` 地标；板块用真实 `<button>` 触发（Reka `UCollapsible` 接好 `aria-expanded`/`aria-controls`），可访问名 = 板块标题 + 计数。
- chevron 用 `aria-hidden`；搜索 `UInput` 带 `aria-label`，`UKbd` 提示装饰性 `aria-hidden`，清除按钮有 `aria-label`。
- 方法色标（`ApiDocsMethodBadge`）文字即动词（GET/POST…），颜色只是**强化**、非唯一信号；场景标签是中性 `UBadge`（非交互），文字（订阅/授权…）本身即可访问名。两者都随 `ULink` 一起被读出，补足接口链接的可访问名。
- 站内链接一律 `ULink`（客户端路由 + 预取 + 自动 `aria-current`），**不手写 `<a>`**。
- 调宽手柄是 `role="separator"` + `aria-orientation="vertical"` + `aria-label`，并暴露 `aria-valuenow/min/max`（当前/上/下限宽度）；`tabindex="0"` 可聚焦，`←/→/Home/End` 键盘操作，与拖拽等价。
- 键盘：`/` 聚焦搜索（正在输入 / IME 组字时不抢焦），`Esc` 清空并失焦；交互元素 `focus-visible` 显示紫环。**例外**：调宽手柄不套紫环——它复用自身那条竖线作为唯一的聚焦/交互指示（focus 时与 hover/拖拽一样变粗变紫），因此鼠标与键盘不会在��缘各画一条线。

## 用法

首选 `groups`——用分组把两类板块分明地隔开：

```vue
<ApiDocsSidebarNav
  :groups="[
    {
      label: '文档',
      sections: [
        {
          label: '指南', kind: 'guide', icon: 'i-lucide-book-open', defaultOpen: true,
          items: [
            { label: '快速开始', to: '/guide/quickstart', icon: 'i-lucide-rocket' },
            { label: '认证', to: '/guide/auth', icon: 'i-lucide-key' },
          ],
        },
      ],
    },
    {
      label: 'API 参考',
      sections: [
        {
          label: 'Checkout', kind: 'endpoints', defaultOpen: true,
          items: [
            // 用途名（非路径）；单个 method 前置、scenarios 后置，接口只出现一次
            { label: '创建结算会话', to: '/api/checkout-create', method: 'POST', scenarios: ['支付', '订阅'] },
            { label: '查询结算会话', to: '/api/checkout-session', method: 'GET', scenarios: ['支付'] },
          ],
        },
      ],
    },
  ]"
  :aria-label="'支付文档'"
  :search-placeholder="'搜索文档'"
  :empty-label="'没有匹配的页面'"
/>
```

> 不需要分组标题时可退回 `:sections="[...]"`（扁平列表，自动包成一个无标题组）；`kind` 仍可逐板块指定。接口的 `method`、`scenarios` 都是可选的——都不给就退化为纯用途名链接。默认可拖拽调宽，`:resizable="false"` 关闭；调宽区间与持久化键用 `:min-width` / `:max-width` / `:default-width` / `:width-storage-key` 定制（同一 app 多处用到时给不同的 storage key 以免相互覆盖）。

全站全文搜索（`⌘K`）放在 **app 顶栏**，与侧栏就地过滤分属不同层级——不要塞进侧栏 `#header`：

```vue
<!-- app 顶栏 / navbar：全站搜索的正位 -->
<header class="flex items-center justify-between ...">
  <NuxtLink to="/">支付 API 文档</NuxtLink>
  <!-- 消费项目已接 @nuxt/content：UContentSearchButton 打开 ⌘K 全文检索面板 -->
  <UContentSearchButton />
</header>

<!-- 侧栏只负责导航树 + 就地过滤，不再放第二个搜索框 -->
<ApiDocsSidebarNav :groups="groups" :aria-label="'支付文档'" />
```

## 相关组件

- `<ApiDocsMethodBadge>` — 本 kit 的兄弟切片，接口行前置的请求方法色标复用它（`registryDependencies` 声明 `method-badge`，copy-in 时随本切片一起拉入）。
- `<ApiDocsScenarioTags>` — 本 kit 的兄弟切片，接口行后置的场景标签簇（测量式溢出 + `+N`/计数 chip 降级 + `UPopover` 揭示折叠项）封装于此，内部由中性 `UBadge` 构成；随本切片一起拉入。
- `<UCollapsible>` / `<ULink>` / `<UInput>` / `<UBadge>` / `<UKbd>` / `<UPopover>` — Nuxt UI 原语。
- `<UContentSearch>` / `<UContentSearchButton>` — Nuxt UI 的全站全文搜索（`⌘K` 模态，绑 `@nuxt/content`）。**不在本切片内**，由消费项目经 `#header` slot 接入；接线见 `project-setup.md`。

## 规格与源码

- 规格模板见 `method/component-spec-template.md`。
- 源码：`packages/kits/api-docs/app/components/api-docs/SidebarNav.vue`；接口行前置方法色标是兄弟切片 `MethodBadge.vue`，后置场景标签簇是兄弟切片 `ScenarioTags.vue`（自带测量式溢出逻辑，原生 `ResizeObserver`、无额外依赖）。
