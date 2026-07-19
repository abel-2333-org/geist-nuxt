# ApiDocsSidebarNav `<ApiDocsSidebarNav>`

文档 / 开发者门户的**侧边栏导航**：一个菜单容纳多个**可折叠板块**，而各板块指向的页面性质差异很大——「指南」板块是文字链接，「接口」板块可按用途命名端点链接。同一接口若服务多个通用场景（例如批处理、实时查询），在导航中**只出现一次**：行首是**请求方法色标**（单个动词，「怎么调」）、中间是用途名、行尾是**场景标签**（「用在哪」）——菜单同时讲清「这个接口怎么调、用来干什么」，而不必按场景把它拆成多条。**两条正交手段让两个世界界限分明**：① **分组层**把板块归入带 eyebrow 小标题的分组（如「文档」「API 参考」），组间有分隔线；② **板块分型**（`kind`）驱动板块头样式——`guide` 型是柔和 sans 句式，`endpoints` 型是大写等宽（mono）。分型只靠排版承载，chrome 颜色留给 active 态（方法色标自带其 tone），避免整列喧闹。板块可**同时展开**、各带一个**计数**，顶部**单一全局搜索**跨所有板块过滤（`/` 聚焦，**同时匹配用途名、请求方法与场景标签**，输入场景名或方法名即可浮出对应接口），因此某个子项很多的大板块也能被快速检索到、不必滚动翻找。侧栏还**可拖拽右边缘调整宽度**，宽度记入 localStorage、刷新仍保留。至于**全站全文搜索**（`⌘K`）则属于 app 顶栏、与侧栏就地过滤不同层级，不并排堆在侧栏里（见下方「就地过滤 vs 全站搜索」）。

> 真源在 `kits/api-docs/components/SidebarNav.vue`；根 registry target 保留 `app/components/api-docs/SidebarNav.vue`，所以模板名是 `<ApiDocsSidebarNav>`。数据无关：导航数据模型内联随组件走，所有 chrome 文案经 props 注入（i18n-ready）。本文所说“全局搜索”仅指跨本侧栏全部板块的树内过滤；整站搜索统一称为 `SiteSearch`。

## Anatomy（结构）

```
nav (landmark, 全高无外框列 + 自身滚动区，可拖拽调宽)
├─ #header  ── 可选 slot：头部最上方的通用扩展点（默认不用；全站搜索应放 app 顶栏而非此处）
├─ search   ── UInput（放大镜图标 + UKbd '/' 提示 / 清除按钮）——导航树内就地过滤
├─ 滚动区
│  └─ group ×M  ── 可选 eyebrow 小标题（mono 大写 tracking，text-dimmed）+ 组间分隔线
│     └─ section (UCollapsible) ×N
│        ├─ trigger  ── chevron（展开转 90°）· 可选 icon · 板块标题 · 计数 UBadge
│        │              · guide 型：sans 句式、中性图标
│        │              · endpoints 型：mono 大写 tracking（chrome 保持中性，颜色只交给 active 态）
│        │              · 计数 UBadge 两型统一为 neutral subtle
│        └─ content  ── item 列表（stretched-link：ULink 覆盖层 + pointer-events-none 内容层为兄弟），左侧一条中性 border 缩进
│           ├─ 指南项：可选 icon + label
│           └─ 接口项：前置方法色标（ApiDocsMethodBadge，定宽槽对齐）+ 用途名 label（sans）+ 后置场景标签簇（ApiDocsScenarioTags：测量真溢出，能放几个铺几个、余下折 +N/计数 chip，溢出触发器是浮回可点的 popover button）（+ 可选尾部 badge）
└─ resizer  ── 右边缘 role="separator" 拖拽手柄（lg+ 显示；悬停/聚焦/拖拽时变紫 1px→2px；指针拖拽（鼠标/触控/触控笔）、键盘 ←→/Home/End、双击复位）
```

板块**多开**（各自独立开合，适合边看边对照）；菜单再长也只在 `nav` 内部滚动，不影响页面布局。搜索时空分组自动隐藏。组件根只提供 `h-full` 列和内部表面，不拥有外框、圆角或视口高度；standalone demo / docs shell 的父布局负责这些 chrome，避免嵌套时出现双边框。

> **迁移注记（copy-in 升级）**：早期切片的组件根自带 `border rounded-lg max-h-[…]` 外框。若你的项目是从旧版 copy-in 升级到本版，需要在**父布局**补回边框与高度约束（如 `class="border-r border-default"` + 明确高度的 grid/flex track），否则侧栏会失去外框且高度塌陷。registry 切片没有版本语义，升级即整文件覆盖——覆盖前先核对父布局是否已按本节要求供 chrome。

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
| `resultsAnnouncement` | `(count: number) => string` | 过滤命中时的 polite live-region 播报，默认 `${count} result(s) found` |
| `noResultsAnnouncement` | `(query: string) => string` | 过滤无命中时的 polite live-region 播报，默认 `No results for “${query}”` |
| `scenariosLabel` | `string` | 接口场景折叠 popover 的标题，透传给 `ScenarioTags`，默认 `Scenarios` |
| `scenarioOverflowLabel` | `(total: number) => string` | 场景溢出触发器的 aria-label，默认 `View all ${total} scenarios` |
| `scenarioSeparator` | `string` | 场景 `sr-only` 全量列表的分隔符，默认 `, ` |
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
  scenarios?: string[]      // 该接口服务的使用场景（如 ['批处理','实时查询']）→ 后置中性场景标签（「用在哪」）
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
  defaultOpen?: boolean  // 开合状态的初始种子值；搜索激活时被强制展开覆盖
}
interface SidebarNavGroup {
  id?: string            // 稳定 id，缺省时取 label 的 slug
  label?: string         // eyebrow 小标题；省略则为无标题的引导组
  sections: SidebarNavSection[]
}
```

## 关键点

- **界限分明靠两条正交手段**：① **分组层**（`SidebarNavGroup.label`）——板块归入带 eyebrow 小标题的分组，组间加分隔线与上留白，把「指南世界」与「接口世界」框成两块领地；② **板块分型**（`SidebarNavSection.kind`）——`guide` 型板块头是柔和 sans 句式 + 中性图标，`endpoints` 型是 mono 大写 tracking。**分型只用排版区分、不涂色**：计数徽章、缩进线、图标、场景标签一律中性，颜色只由 active 态承载，避免整列 chrome 被紫色装饰喧闹（`primary` 是强调色，应留给选中态）。二者叠加后，即使只扫板块头（不展开）也一眼分得清类型。
- **接口按用途命名、非路径；一个接口服务多个场景但只出现一次**：当一个接口覆盖多种**使用场景**时，菜单标签可用清晰的用途名（如「创建任务」「查询任务」），不必暴露原始路径，也不按场景重复列出。它服务哪些场景由 `scenarios` 的中性标签表达。接口行的排布是**前置方法色标 + 用途名（sans，主标识）+ 后置场景标签簇**：`method`（单个 HTTP 动词）承载「这个接口怎么调」，用途名承载「这是什么接口」，场景标签承载「它服务哪些场景」，例如 `POST`「创建任务」可带 `批处理`、`自动化`。方法与场景是两个正交维度——一个说调用方式、一个说使用上下文，故一前一后分列。**场景标签簇按可用宽度测量真溢出**（`ApiDocsScenarioTags`：能放几个就铺几个、余下折 `+N`，一个都放不下才收成计数 chip；见下方「方法色标前置定宽」），因此侧栏够宽时全部场景平铺、窄时优雅降级，用途名始终不被挤掉。
- **异构行靠数据区分，不靠 variant**：同一个 `items` 里，带 `method`/`scenarios` 的是接口行（前置方法色标 + 后置中性场景标签），带/不带 `icon` 的是指南行。**方法色标是唯一带色的元素**（复用 `ApiDocsMethodBadge`，GET→info、POST→success、PUT→warning、PATCH→secondary、DELETE→error），因为它是有限受控词表、颜色能有效编码语义；**场景标签是纯 neutral soft `UBadge`、不涂色**（场景是开放词表，涂色会失控、也会与方法色标抢注意力），chrome 其余颜色只留给 active 态。
- **全局搜索是唯一搜索入口、同时匹配用途名 / 方法 / 场景标签**：顶部一个 `UInput` 过滤所有板块——板块标题命中则整块保留，否则只留 **label、method 或场景标签命中**查询的 item（`matchesText` 同时查 `label`、`method`、`scenarios`）；有查询时**命中板块强制展开**，让结果始终可见，计数徽章显示 `命中/总数`。因此**输入场景名（如「批处理」）或方法名（如「POST」）都会浮出对应接口**，跨板块聚合了这个多对多关系；「大板块子项多」的检索需求也由这个全局搜索覆盖，无需每块再放搜索框，也不需要额外的过滤 chips。
- **就地过滤 vs 全站搜索是两件正交的事，靠层级区分而非并排堆叠**：本组件只做**导航树内就地过滤**（顶部 `UInput`，收窄结构化的导航项 label、method 与 scenario）。全站 `⌘K` 搜索由 `<ApiDocsSiteSearch>` 在 app 顶栏承担：静态 groups 可由本导航 ViewModel 派生，异步 `search` 可接消费项目自己的正文索引。消费项目也可在 app 层改用 Content 原生搜索；两种方式都不应焊进 SidebarNav 或塞进其 `#header`。
- **菜单自身是滚动区，外部决定高度**：`nav` 用 `h-full min-h-0`，顶部 search 固定、下方 `overflow-y-auto`。父布局必须给侧栏区域明确高度或让它处于可解析的全高 grid/flex track；边框与圆角也由父布局拥有。
- **方法色标前置定宽、用途名让路、场景标签测量式溢出后置**：方法色标放在 `w-14` 定宽槽里 leading，故不论动词是 `GET` 还是 `DELETE`，各行用途名的起始 x 都对齐；用途名是 `shrink truncate` 且有 `min-w-16` 保底——它**让路**给标签而非独占剩余空间，同时保住可读地板；场景标签簇 `ApiDocsScenarioTags` 是 `flex-1`，接住用途名让出的空间。**标签簇做测量式溢出（responsive overflow），而非按断点猜**：组件内一个 `aria-hidden` 的隐藏测量层渲染全部标签取其真实像素宽，配合 `ResizeObserver` 观察自身分到的宽度，贪心算出「能放几个整标签」——放不下的折 `+N`（预留其宽度），连一个都放不下才收成**计数 chip**（`i-lucide-tag` + 场景总数）。**测量层刻意不设 `max-w-28`**（可见标签才设）：否则超长标签的 `offsetWidth` 会被夹到 112px，贪心以为它「放得下」而平铺成一个截断的省略号标签（信息为零）；测量真实自然宽度后，超长标签会正确溢出进 `+N`/计数 chip，其全名经 popover 与 `sr-only` 仍可达。因此它**与数据无关**：2 个短标签还是 8 个长标签、中文还是拉丁文都精确自适应；侧栏够宽时全部场景平铺，拖窄时逐个让位、绝不出现被 `truncate` 挤成零字符的空标签，和拖拽调宽形成正反馈。**折叠项的揭示用 `click` 态 `UPopover` 而非 tooltip**：`+N` / 计数 chip 是一个可聚焦的 `<button>` 触发器，tap / 点击 / Enter 三端都能打开列出全部场景的浮层（tooltip 在触摸端不触发、且套在非交互 badge 上键盘也够不到，故不合适——见 `components/overlays.md`）；`sr-only` 全量列表再兜底屏幕阅读器。**SSR 安全**：测量前渲染确定性默认（首标签 + `+N`），`onMounted` 后再测量精修，无 hydration 失配。指南行无方法时改由 `icon` 占前置位。
- **宽度可拖拽、记 localStorage（lg+ 渐进增强）**：右边缘一个 `role="separator"` 手柄，走 **Pointer Events**（鼠标/触控/触控笔统一，lg+ 的 iPad 横屏也能拖），`pointerdown` 后 `setPointerCapture` 把指针流钉在手柄上（快速拖拽甩出命中区也不断开），`pointerup`/`pointercancel` 落定并写入 `localStorage`。宽度经 `clampWidth` 夹在 `[minWidth, maxWidth]`。键盘等价可操作（`←/→` 微调、`Shift` 粗调、`Home/End` 跳到上下限），双击复位。手柄静息透明、仅在 hover/focus/拖拽时显紫，静息边缘和其余 chrome 一样安静。**调宽是桌面(`lg+`)的渐进增强**：手柄 `hidden lg:flex`，宽度也只在 `lg+` 应用——根节点用 `w-full lg:w-[var(--api-docs-nav-w)]`（`width` 经 CSS 变量注入），故小屏侧栏取**满宽跟随父容器、绝不横向溢出**,桌面才吃固定像素宽。**SSR 安全**：`width` 初值 = `defaultWidth`（服务端/客户端一致，无 hydration 失配），持久值在 `onMounted` 后读取。`:resizable="false"` 可整体关闭（不加宽度、不渲染手柄）。
- **折叠动画走 Nuxt UI `UCollapsible` 默认**：不覆盖 `ui.content`，直接复用主题内建的 `collapsible-down/up` 动画，`prefers-reduced-motion` 由 foundation 全局样式处理。

## 状态（state model）

- 板块：collapsed / expanded（多开）、trigger hover、`focus-visible` 紫环。开合状态**始终受控**（组件自持 `openMap`，`defaultOpen` 只做种子值），避免 UCollapsible 在受控/非受控间切换导致内部状态与用户所见不一致。开合状态**按 group 命名空间**（key = `group.id::section.id`），故不同 group 下同 id/同 slug 的板块不会互相耦合开合。
- item：default / hover / **active（`aria-current="page"`）** / `focus-visible`。active 由组件内 `effectiveActive` 单源计算并同时驱动背景、文字与 `aria-current`：显式 `item.active` 最优先；缺省时纯内部路径按 `route.path` 精确匹配自推断；**任何含 `#` 的 `to`（裸 hash 或路径+hash）缺省时一律不自推断**——它们仍是正常的内部/页内链接（跳转不受影响），但 router 的 active 匹配不比较 hash，若放任自推断，路径+hash 的 item 会整页同亮、裸 hash 的 item 永远不亮，所以锚点类导航（docs-shell 形态）必须由页面层按 `route.hash`/`route.params` 计算并显式传 `item.active`。
- 搜索：empty / has-query（命中板块强制展开 + 计数转 `命中/总数`，空分组整组隐藏、只留有命中的领地）/ no-results（空态文案）。搜索中的手动开合记在随查询重置的临时 map 里；**清空搜索恢复搜索前的开合状态**。
- 方法色标 / 场景标签：均为静态展示、无交互态（不可点选、不参与过滤）——方法色标标「怎么调」、场景标签标「用在哪」，检索一律走顶部搜索。
- 调宽手柄：idle（透明）/ hover / `focus-visible` / dragging（`isResizing`），后三态显紫、1px→2px；拖拽时 `nav` 加 `select-none` 防误选文本。

## Accessibility（无障碍）

- 根节点是 `<nav :aria-label>` 地标；板块用真实 `<button>` 触发（Reka `UCollapsible` 接好 `aria-expanded`/`aria-controls`），可访问名 = 板块标题 + 计数。
- chevron 用 `aria-hidden`；搜索 `UInput` 带 `aria-label`（取自 `searchPlaceholder` 但**剥掉结尾省略号**，避免读屏念出「ellipsis」），并置 `type="search"` + `autocomplete/autocorrect/autocapitalize="off"` + `spellcheck="false"`（过滤框不该触发拼写检查/自动更正）；`UKbd` 提示装饰性 `aria-hidden`，清除按钮有 `aria-label`。
- **过滤结果用 `aria-live="polite"` 播报**：过滤是静默重写列表，故一个 `role="status"` 的 `sr-only` 区域播报「找到 N 个匹配结果」或「没有与"…"匹配的结果」；空 query 时不播报，闲时浏览保持安静。
- 方法色标（`ApiDocsMethodBadge`）文字即动词（GET/POST…），颜色只是**强化**、非唯一信号；场景标签文字（批处理/实时查询…）本身即可访问名，`sr-only` 再兜底全量场景，折叠项的 popover 触发器有 `aria-label`（文案由 `scenarioOverflowLabel` 注入，默认 `View all N scenarios`）。
- 站内链接一律 `ULink`（客户端路由 + 预取 + 自动 `aria-current`），**不手写 `<a>`**。**行采用 stretched-link 结构**：`ULink` 是铺满整行的绝对定位覆盖层（承载点击/焦点/hover 背景、`aria-label` = 接口名），可见行内容是它的**兄弟**、`pointer-events-none` 浮于其上，仅场景簇的 popover 触发器 `pointer-events-auto` 浮回可点。这样 `<button>` 不再嵌在 `<a>` 内（非法 HTML + 会误触发导航），整行可点导航、点 `+N` 只开浮层。
- 调宽手柄是 `role="separator"` + `aria-orientation="vertical"` + `aria-label`，并暴露 `aria-valuenow/min/max`（当前/上/下限宽度）；`tabindex="0"` 可聚焦，`←/→/Home/End` 键盘操作，与拖拽等价。
- 键盘：`/` 聚焦搜索（正在输入 / IME 组字时不抢焦），`Esc` 清空并失焦；交互元素 `focus-visible` 显示紫环。**例外**：调宽手柄不套紫环——它复用自身那条竖线作为唯一的聚焦/交互指示（focus 时与 hover/拖拽一样变粗变紫），因此鼠标与键盘不会在边缘各画一条线。

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
          label: 'Tasks', kind: 'endpoints', defaultOpen: true,
          items: [
            // 用途名（非路径）；单个 method 前置、scenarios 后置，接口只出现一次
            { label: '创建任务', to: '/api/tasks/create', method: 'POST', scenarios: ['批处理', '自动化'] },
            { label: '查询任务', to: '/api/tasks/get', method: 'GET', scenarios: ['实时查询'] },
          ],
        },
      ],
    },
  ]"
  :aria-label="'开发者文档'"
  :search-placeholder="'搜索文档'"
  :empty-label="'没有匹配的页面'"
/>
```

> 不需要分组标题时可退回 `:sections="[...]"`（扁平列表，自动包成一个无标题组）；`kind` 仍可逐板块指定。接口的 `method`、`scenarios` 都是可选的——都不给就退化为纯用途名链接。默认可拖拽调宽，`:resizable="false"` 关闭；调宽区间与持久化键用 `:min-width` / `:max-width` / `:default-width` / `:width-storage-key` 定制（同一 app 多处用到时给不同的 storage key 以免相互覆盖）。

全站搜索（`⌘K`）放在 **app 顶栏**，与侧栏就地过滤分属不同层级——不要塞进侧栏 `#header`：

```vue
<!-- app 顶栏 / navbar：全站搜索的正位 -->
<header class="flex items-center justify-between ...">
  <NuxtLink to="/">Example API 文档</NuxtLink>
  <ApiDocsSiteSearch
    :groups="searchGroups"
    :search="searchBody"
    search-group-label="正文"
    trigger-label="搜索文档"
    modal-title="搜索文档"
    placeholder="搜索指南与接口"
    empty-label="没有匹配的文档"
  />
</header>

<!-- 侧栏只负责导航树 + 就地过滤，不再放第二个搜索框 -->
<ApiDocsSidebarNav :groups="groups" :aria-label="'开发者文档'" />
```

## 相关组件

- `<ApiDocsMethodBadge>` — 本 kit 的兄弟切片，接口行前置的请求方法色标复用它（`registryDependencies` 声明 `method-badge`，copy-in 时随本切片一起拉入）。
- `<ApiDocsScenarioTags>` — 本 kit 的兄弟切片，接口行后置的场景标签簇（测量式溢出 + `+N`/计数 chip 降级 + `UPopover` 揭示折叠项）封装于此，内部由中性 `UBadge` 构成；随本切片一起拉入。
- `<ApiDocsSiteSearch>` — app 顶栏的全站搜索；静态导航与异步正文索引均由消费项目以 display model 注入。
- `<UCollapsible>` / `<ULink>` / `<UInput>` / `<UBadge>` / `<UKbd>` / `<UPopover>` — Nuxt UI 原语。
- `<UContentSearch>` / `<UContentSearchButton>` — 若消费项目选择 Content 原生搜索，可在 app 层替代 `ApiDocsSiteSearch`；不属于 SidebarNav 切片。

## 规格与源码

- 规格模板见 `method/component-spec-template.md`。
- 源码：`kits/api-docs/components/SidebarNav.vue`；接口行前置方法色标是兄弟切片 `MethodBadge.vue`，后置场景标签簇是 `ScenarioTags.vue`（自带测量式溢出逻辑，原生 `ResizeObserver`、无额外依赖）。
