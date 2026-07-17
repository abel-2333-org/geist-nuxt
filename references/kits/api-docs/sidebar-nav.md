# ApiDocsSidebarNav `<ApiDocsSidebarNav>`

文档 / 开发者门户的**侧边栏导航**：一个菜单容纳多个**可折叠板块**，而各板块指向的页面性质差异很大——「指南」板块是文字链接，「接口」板块是**按用途命名**的端点链接。**接口不严格遵循 REST、一个接口常服务多个业务场景**（订阅、授权…），所以它**只出现一次**，行内用**场景标签**标明它覆盖哪些场景——菜单讲的是「这个接口用来干什么」，而非「它是哪个动词」。**两条正交手段让两个世界界限分明**：① **分组层**把板块归入带 eyebrow 小标题的分组（如「文档」「API 参考」），组间有分隔线；② **板块分型**（`kind`）驱动板块头样式——`guide` 型是柔和 sans 句式，`endpoints` 型是大写等宽（mono）。分型只靠排版承载，颜色留给 active 态，避免整列喧闹。板块可**同时展开**、各带一个**计数**，顶部**单一全局搜索**跨所有板块过滤（`/` 聚焦，**同时匹配用途名与场景标签**，输入场景名即可浮出所有服务该场景的接口），因此某个子项很多的大板块也能被快速检索到、不必滚动翻找。至于**全站全文搜索**（`⌘K`）则属于 app 顶栏、与侧栏就地过滤不同层级，不并排堆在侧栏里（见下方「就地过滤 vs 全站搜索」）。

> 文件放在 `components/api-docs/SidebarNav.vue`。约定 `pathPrefix: true`，组件名 = 目录名 + 文件名，所以模板名是 `<ApiDocsSidebarNav>`。数据无关：导航数据模型内联随组件走，所有 chrome 文案经 props 注入（i18n-ready）。

## Anatomy（结构）

```
nav (landmark, 粘顶 + 自身滚动区)
├─ #header  ── 可选 slot：头部最上方的通用扩展点（默认不用；全站搜索应放 app 顶栏而非此处）
├─ search   ── UInput（放大镜图标 + UKbd '/' 提示 / 清除按钮）——导航树内就地过滤
└─ 滚动区
   └─ group ×M  ── 可选 eyebrow 小标题（mono 大写 tracking，text-dimmed）+ 组间分隔线
      └─ section (UCollapsible) ×N
         ├─ trigger  ── chevron（展开转 90°）· 可选 icon · 板块标题 · 计数 UBadge
         │              · guide 型：sans 句式、中性图标
         │              · endpoints 型：mono 大写 tracking（chrome 保持中性，颜色只交给 active 态）
         │              · 计数 UBadge 两型统一为 neutral subtle
         └─ content  ── item (ULink) 列表，左侧一条中性 border 缩进
            ├─ 指南项：可选 icon + label
            └─ 接口项：用途名 label（sans，前置）+ 后置一或多个场景标签（neutral UBadge）（+ 可选尾部 badge）
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

## Slots

| slot | 说明 |
|---|---|
| `header` | 可选，**通用扩展点**。渲染在粘顶头部**最上方**（就地过滤框之上）。给出时头部自动出现；不给则头部只有过滤框。**注意**：全站全文搜索（`⌘K`）**不建议**塞这里——它属于 app 顶栏、与侧栏就地过滤是不同层级（见下方「就地过滤 vs 全站搜索」）。此 slot 留给确实需要在导航顶部放东西的少数场景（如版本切换器、区域切换）。 |

### 数据模型（内联，随切片走）

```ts
interface SidebarNavItem {
  label: string             // 显示文本（已本地化）。接口行=用途名（非路径）
  to?: string               // 路由；用 ULink 渲染，active 态 + 预取自动生效
  scenarios?: string[]      // 该接口服务的业务场景（如 ['订阅','授权']）→ 后置中性场景标签
  icon?: string             // 行首 Iconify 图标（指南板块）；scenarios 存在时忽略
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
 - **接口按用途命名、非路径；一个接口服务多个场景但只出现一次**：我们的 API 不严格遵循 REST 语义，一个接口常覆盖多种**业务场景**（订阅、授权、支付、退款…），所以**菜单标签用用途名**（如「发起支付」「客户管理」）、**不用路径**，且这个接口在菜单里**只出现一次**——它服务哪些场景由 `scenarios` 里的**场景标签**表达，而不是按场景重复列出、也不是挂 HTTP 动词。接口行的排布是**用途名（sans，主标识，前置）+ 后置并排场景标签**：用途名承载「这是什么接口」，场景标签承载「它服务哪些场景」，多个标签并排即表达「一接口多场景」（如「发起支付」并排 `支付` `订阅` `授权`）。
 - **异构行靠数据区分，不靠 variant**：同一个 `items` 里，带 `scenarios` 的是接口行（后置一或多个中性 `UBadge` 场景标签），带/不带 `icon` 的是指南行。场景标签是纯 neutral soft `UBadge`——**不涂色、不复用 MethodBadge**，因为颜色在本组件里只留给 active 态。
- **全局搜索是唯一搜索入口**：顶部一个 `UInput` 过滤所有板块——板块标题命中则整块保留、否则只留命中的 item；有查询时**命中板块强制展开**，让结果始终可见，计数徽章显示 `命中/总数`。这样「大板块子项多」的检索��求由全局搜索覆盖，无需每块再放一个搜索框。
- **method 过滤 chips 是全局搜索的补充、渐进披露而非常驻 chrome**：chip 行紧贴搜索框下方，但**静息时隐藏**——只有聚焦搜索框（`focusin` 落在头部容器内）或已有过滤时才展开，避免首屏就堆一排控件、把导航内容挤下去。焦点追踪用会冒泡的 `focusin`/`focusout`（`UInput` 只 emit `blur`、不 emit `focus`，故不能用 `@focus`），`focusout` 用 `relatedTarget` 守卫，配合 chip 上的 `@mousedown.prevent`，让焦点在 input↔chip 之间移动时不闪烁收起。`availableMethods` 只列出数据里真实出现的方法（按 GET→POST→PUT→PATCH→DELETE 规范顺序），纯指南侧栏无 chip。选中 chip 只保留 method **命中任一**激活项的端点行（因一个接口可含多个动词，如「支付 GET/POST/PATCH」在筛 PATCH 时仍保留）——**过滤方法本质是端点操作，指南项（无 `method`）在任一 chip 激活时整体退场**；可多选、与关键词查询**叠加**（先按 method 收窄、再按文字收窄）。默认 chip 是安静的 neutral ghost，选中后取该方法自己的色（subtle）+ `aria-pressed`。清除按钮 / `Esc` 同时清空查询与 method 选择。
- **就地过滤 vs 全站搜索是两件正交的事，靠层级区分而非并排堆叠**：本组件只做**导航树内就地过滤**（顶部 `UInput` + method chips，收窄结构化的导航项 label）。**全站全文搜索**（`⌘K` 模态、跨整站文档正文、Fuse/`useSearchCollection`）是另一套交互，由 Nuxt UI 的 `<UContentSearch>` / `<UContentSearchButton>` 承担、**绑死 `@nuxt/content`**，它的正位是 **app 顶栏 / navbar**——和侧栏就地过滤不同层级、不同位置（参考 Nuxt UI / Vercel 文档站）。**切忌把全站搜索按钮塞进侧栏顶部**：两个长得几乎一样的搜索框上下紧贴，只会让用户困惑"这俩有啥区别"，是冗余 chrome。全文检索接线（含把 `UContentSearchButton` 放进顶栏）留给消费项目（见 `project-setup.md`）；**基座保持数据无关、不引 `@nuxt/content`**，也切勿把 `UContentSearch` 焊进本组件。
- **菜单自身是滚动区**：`nav` 用 `max-h-[calc(100dvh-4rem)]` + 顶部 `search` 粘住、下方 `overflow-y-auto`。多板块同时展开把列表撑长时只在侧栏内部滚动，页面其余部分不动。
- **method 色标后置、用途名前置对齐**：用途名 leading（`flex-1 truncate`），method 色标 trailing（`shrink-0` + `gap-1` 并排）。后置的好处是不论一个接口挂几个动词，各行用途名的起始 x 都对齐；色标数量在右侧自然伸缩，不挤压标签。
- **折叠动画走 Nuxt UI `UCollapsible` 默认**：不覆盖 `ui.content`，直接复用主题内建的 `collapsible-down/up` 动画，`prefers-reduced-motion` 由 layer 全局处理。

## 状态（state model）

- 板块：collapsed / expanded（多开）、trigger hover、`focus-visible` 紫环。
- item：default / hover / **active（`aria-current="page"`，由 ULink 依 `to` 判定）** / `focus-visible`。
- 搜索：empty / has-query（命中板块强制展开 + 计数转 `命中/总数`，空分组整组隐藏、只留有命中的领地）/ no-results（空态文案）。查询与 method 过滤共用这套 has-filter 状态。
- method chip 行：hidden（静息）/ revealed（聚焦搜索框或已有过滤时，带淡入 + 轻微上移的过渡）。单个 chip：unselected（neutral ghost）/ selected（该方法色 subtle + `aria-pressed=true`）；`focus-visible` 紫环。激活任一 chip 即进入 has-filter 态（此时即便失焦，chip 行仍保持展开）。

## Accessibility（无障碍）

- 根节点是 `<nav :aria-label>` 地标；板块用真实 `<button>` 触发（Reka `UCollapsible` 接好 `aria-expanded`/`aria-controls`），可访问名 = 板块标题 + 计数。
- chevron 用 `aria-hidden`；搜索 `UInput` 带 `aria-label`，`UKbd` 提示装饰性 `aria-hidden`，清除按钮有 `aria-label`。
- method chip 行是 `role="group"` + `aria-label`（默认 `Filter by method`），每个 chip 用真实 `<button>` + `aria-pressed` 表达开关态，方法名（GET/POST…）本身即可访问名——不只靠颜色区分。
- 站内链接一律 `ULink`（客户端路由 + 预取 + 自动 `aria-current`），**不手写 `<a>`**。
- 键盘：`/` 聚焦搜索（正在输入 / IME 组字时不抢焦），`Esc` 清空并失焦；所有交互元素 `focus-visible` 显示紫环。

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
            // 用途名（非路径）；一个接口可含多个 method
            { label: '创建结算会话', to: '/api/checkout-create', method: 'POST' },
            { label: '结算会话', to: '/api/checkout-session', method: ['GET', 'DELETE'] },
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

> 不需要分组标题时可退回 `:sections="[...]"`（扁平列表，自动包成一个无标题组）；`kind` 仍可逐板块指定。method 过滤 chips 默认开启，本地化其 aria-label 用 `:method-filter-label="'按方法筛选'"`；纯指南侧栏无端点、chip 自动不显示，也可显式 `:method-filters="false"` 关掉。

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

- `<ApiDocsMethodBadge>` — HTTP method 色标（接口行复用它；`registryDependencies` 已声明，copy-in 时随本切片一起拷入）。
- `<UCollapsible>` / `<ULink>` / `<UInput>` / `<UBadge>` / `<UKbd>` / `<UButton>` — Nuxt UI 原语。
- `<UContentSearch>` / `<UContentSearchButton>` — Nuxt UI 的全站全文搜索（`⌘K` 模态，绑 `@nuxt/content`）。**不在本切片内**，由消费项目经 `#header` slot 接入；接线见 `project-setup.md`。

## 规格与源码

- 规格模板见 `method/component-spec-template.md`。
- 源码：`packages/kits/api-docs/app/components/api-docs/SidebarNav.vue`；依赖切片 `method-badge`（`MethodBadge.vue` + `utils/method-preset.ts`）由 `registryDependencies` 拉入。
