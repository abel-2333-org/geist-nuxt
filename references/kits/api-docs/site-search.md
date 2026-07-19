# ApiDocsSiteSearch `<ApiDocsSiteSearch>`

文档站 **app 顶栏**里的**全站搜索**：一个触发按钮 + `⌘K` 模态命令面板，检索对象是**文档索引**（指南页 + 按用途命名的端点，端点带请求方法与场景标签两个 facet）。回答的问题是「**从任何地方去任何页面**」——与 `ApiDocsSidebarNav` 顶部的**树内就地过滤**（「在当前菜单里缩小范围」）分属不同层级、不同位置，两者**刻意匹配同样的维度**（用途名 / 请求方法 / 场景标签），读者对「什么可被搜到」的心智模型在两层都成立（分层论证见 `sidebar-nav.md` 的「就地过滤 vs 全站搜索」）。

**数据无关是设计前提**：组件吃一个文档索引数组，**不依赖 `@nuxt/content` 或任何内容管线**——gallery、starter 和任何消费项目无论文档怎么存都能用。这正是不直接用 Nuxt UI `<UContentSearch>` 的原因：它绑死 `@nuxt/content`，而 gallery/starter 刻意不装内容管线（可靠性决策）。需要**跨正文全文检索**时也不必换组件：正文切片可以作为静态组喂进索引，或经可选的 `search` prop 接任意异步检索后端（见「正文检索」小节）——数据从哪来始终是消费项目的决定，基座不背依赖。

> 文件放在 `components/api-docs/SiteSearch.vue`。约定 `pathPrefix: true`，组件名 = 目录名 + 文件名，所以模板名是 `<ApiDocsSiteSearch>`。数据无关：索引数据模型内联随组件走，所有 chrome 文案经 props 注入（i18n-ready）。

## Anatomy（结构）

```
trigger  ── UButton（neutral outline sm；< sm 收成图标方按钮）
│           ├─ 放大镜图标（唯一常驻元素）
│           ├─ 文本 label（< sm 隐藏；ariaLabel 兜底可访问名）
│           └─ UKbd ⌘ + K 提示（< sm 隐藏——触屏设备快捷键无意义）
└─ UModal（#content 模式；title prop 渲染为视觉隐藏的 DialogTitle，保住对话框可访问名）
   └─ UCommandPalette
      ├─ input   ── 打开即自动聚焦（组件默认）；带关闭按钮（close prop）
      ├─ results ── 按组分节（「文档」/「API 参考」，镜像侧栏的分组边界）
      │   ├─ 指南项：icon + label
      │   └─ 端点项：前置 ApiDocsMethodBadge + 用途名 + suffix（场景标签串）
      └─ empty   ── 无结果空态（文案经 prop 注入）
```

## Props

| prop | 类型 | 说明 |
|---|---|---|
| `groups` | `SiteSearchGroup[]` | **必填**。要检索的文档索引（分组的指南页 + 端点） |
| `triggerLabel` | `string` | **必填**。触发按钮文本（`< sm` 视觉隐藏，`ariaLabel` 兜底） |
| `ariaLabel` | `string` | 触发按钮可访问名，缺省取 `triggerLabel` |
| `modalTitle` | `string` | **必填**。模态的视觉隐藏标题（读屏在打开时播报） |
| `placeholder` | `string` | **必填**。面板输入框占位符 |
| `emptyLabel` | `string` | **必填**。无结果空态文案 |
| `scenarioSeparator` | `string` | 场景标签串进 suffix 的分隔符，默认 `、`。与 `ApiDocsSidebarNav` 同名 prop 对称 |
| `shortcut` | `string` | 切换面板的快捷键（`defineShortcuts` 语法），默认 `meta_k` |
| `resultLimit` | `number` | 搜索时最多展示的结果数，默认 `12`（同 `UContentSearch`），长索引不刷屏 |
| `extraGroups` | `CommandPaletteGroup[]` | 追加的面板组（如快捷链接、主题切换——对位 `UContentSearch` 的 links/theme 组）。组内文案传入时已本地化 |
| `search` | `(query) => Promise<SiteSearchItem[]>` | 可选异步检索引擎（对位 `UContentSearch` 的 `search`）：防抖后以当前 query 调用，结果作为独立组渲染。接什么后端由消费项目定（content 的 `useSearchCollection`、自建搜索接口…），静态索引照常并存。dev 下 `search` 抛错会 `console.warn`（UI 静默降级为空组） |
| `searchGroupLabel` | `string` | 异步结果组的组标题（给了 `search` 就必给，dev 下漏传有 warn；已本地化） |
| `searchDelay` | `number` | `search` 触发前的防抖毫秒数，默认 `100`（同 `UContentSearch`） |

> **面板组顺序是契约**：静态索引组（按 `groups` 传入顺序）→ 异步结果组 → `extraGroups`，消费方可以依赖它。query 在**每次关闭**时重置（选中、Esc、点遮罩皆然），下次打开是干净的。

### 数据模型（内联，随切片走）

```ts
interface SiteSearchItem {
  label: string          // 显示文本（已本地化）。端点=用途名（非路径）
  to: string             // 目标（路由或 #锚点）；渲染为链接，预取自动生效
  method?: string        // HTTP 方法（如 'POST'）→ 前置 ApiDocsMethodBadge，且参与搜索
  scenarios?: string[]   // 业务场景（如 ['订阅','授权']）→ 串进 suffix 且参与搜索
  icon?: string          // 前置图标（指南页）；有 method 时忽略
  suffix?: string        // 可选补充说明；显示在 label 后，也参与搜索
}
interface SiteSearchGroup {
  id: string             // 稳定 id（作命令面板组 id）
  label: string          // 组标题（已本地化）
  items: SiteSearchItem[]
}
```

字段形状与 `SidebarNavItem` 的同名字段一致，**一份导航数据可以同时喂两个组件**——gallery 的 docs-shell demo 里有一个 `toSearchGroups()` 映射函数示范「侧栏 groups 是唯一真源，搜索索引由它派生」。

## 关键点

- **为什么是独立切片而不是塞进 SidebarNav**：`sidebar-nav.md` 已论证——两个长得几乎一样的搜索框上下紧贴是冗余 chrome，全站搜索的正位是 app 顶栏。本切片就是那个「顶栏该放的东西」的基座实现，SidebarNav 的 `#header` slot 维持通用扩展点定位不变。
- **搜索维度与侧栏过滤对齐**：fuse 键为 `label / suffix / method / scenarios`——输入场景名（「订阅」）或方法名（「POST」）都能命中端点，与侧栏树内过滤的 `matchesText`（label/method/scenarios）维度一致。方法与场景作为扩展 key 挂在面板 item 上：fuse 搜它们，`#item-leading` slot 读 `method` 渲染色标；场景同时串进可见 suffix，facet 既可读又可搜。
- **检索体验对齐 `UContentSearch` 的默认值**：`useTokenSearch`（多词 query 逐词求交——「结算 POST」同时按用途与方法收窄）、`includeMatches`（命中文本在结果里高亮，面板内建渲染）、`resultLimit: 12`（搜索态结果封���）。这三件是命令面板体验，与内容管线无关，故基座直接吸收。
- **条目渲染复用既有语汇**：端点项前置 `ApiDocsMethodBadge`（唯一带色元素，同侧栏），指南项前置其 icon；suffix 承载场景串（+ 可选补充说明，用 ` · ` 连接）。菜单里怎么认，面板里就怎么认。
- **⌘K 是 toggle，且在输入框聚焦时也生效**：面板已开时再按 `⌘K` 关闭，符合命令面板的通用肌肉记忆；注册时带 `usingInput: true`（同 `UContentSearch`）——焦点在侧栏过滤框等输入框里时快捷键照样响应，两层搜索不抢键。快捷键经 Nuxt UI `defineShortcuts` 注册于组件内（可用 `shortcut` prop 换键），消费方零接线。**不占用 `/`**——那是侧栏树内过滤的聚焦键。
- **选中即关闭 + 导航 + 重置**：item 的 `onSelect` 关闭模态并清空 query（下次打开是干净的，不回放旧过滤），导航由 item 的 `to`（LinkProps）走 NuxtLink——站内路由、预取都是平台默认行为。**同页锚点是唯一的例���**：模态开着时 reka-ui 锁滚动、关闭时焦点还原又会把页面拉回 trigger，所以组件拦截 `closeAutoFocus`，把焦点与滚动一并交给目标 section（焦点去用户要去的地方，也是更好的 a11y 结果；尊重 `prefers-reduced-motion`）。

## 状态（state model）

- 整体：closed / open。打开 = 点击 trigger 或 `⌘K`（toggle）；关闭 = `Esc` / 点遮罩 / 面板关闭按钮（`UModal` 内建）/ 选中条目 / 再按 `⌘K`。
- 面板：idle（空 query，全量列出，`matchAllWhenSearchEmpty` 默认）/ searching（fuse 过滤中，命中高亮可键盘上下移动）/ no-results（空态文案）。
- 异步（仅提供 `search` prop 时）：击键防抖（`searchDelay`）→ 调用异步源（面板 loading 指示在途）→ **序号防竞态**（每次击键递增序号，响应只在序号仍是最新时应用——慢的旧请求永远不会覆盖新结果）→ 结果组以 `ignoreFilter` 渲染（信任检索源的排序，fuse 不二次过滤）。query 清空或选中条目时结果组清空。
- 每次关闭后重开，输入框清空并重新聚焦（`UModal` 销毁内容 + `UCommandPalette` autofocus 的组合默认行为）。
- trigger：default / hover / `focus-visible` 紫环 / open（模态在上时按钮不需要额外压态）。

## Accessibility（无障碍）

- 焦点圈闭在模态内、关闭后**焦点还原到 trigger**——`UModal`（reka-ui Dialog）内建。唯一例外：选中**同页锚点**时组件拦截还原、把焦点交给目标 section（见「关键点」），其余路径组件不自己管焦点。
- 模态可访问名：`#content` 模式下 `UModal` 把 `title` prop 渲染为视觉隐藏的 `DialogTitle`，读屏打开时播报 `modalTitle`。
- trigger 在 `< sm` 收成图标方按钮（文本与 `UKbd` 提示均隐藏——触屏设备快捷键无意义），可访问名由 `aria-label`（`ariaLabel ?? triggerLabel`）兜底，不受视觉收纳影响。
- 结果列表是 listbox 语义（reka-ui Listbox），`↑/↓` 移动高亮、`Enter` 选中——组件零手写键盘逻辑。
- 方法色标文字即动词（GET/POST…），颜色只是强化、非唯一信号；场景串是纯文本 suffix，天然可访问。
- 输入框打开即聚焦（`UCommandPalette` 默认 `autofocus`），无需用户额外一次 Tab。

## 用法

```vue
<script setup lang="ts">
const searchGroups = [
  {
    id: 'docs',
    label: '文档',
    items: [
      { label: '快速开始', to: '/guide/quickstart', icon: 'i-lucide-rocket' },
    ],
  },
  {
    id: 'api',
    label: 'API 参考',
    items: [
      // 用途名（非路径）；method 渲染前置色标，scenarios 串进 suffix，两者都参与搜索
      { label: '创建结算会话', to: '/api/checkout-create', method: 'POST', scenarios: ['支付', '订阅'] },
    ],
  },
]
</script>

<template>
  <!-- app 顶栏 / navbar：全站搜索的正位 -->
  <header class="flex items-center justify-between ...">
    <NuxtLink to="/">支付 API 文档</NuxtLink>
    <ApiDocsSiteSearch
      :groups="searchGroups"
      trigger-label="搜索全部文档"
      modal-title="搜索全部文档"
      placeholder="搜索指南与接口…"
      empty-label="没有匹配的结果"
    />
  </header>
</template>
```

> 索引从哪来由消费项目决定：手写、由侧栏导航数据派生（推荐，见 gallery docs-shell demo 的 `toSearchGroups()`），或构建期从 OpenAPI/路由表生成。

## 正文检索（可选，两条路径）

端点/指南的条目级导航走上面的静态索引就够了；要「搜正文里的一句话」时按站点规模二选一，**都不用换组件**：

**路径一：正文切片作静态组（中小站，零组件接线）**——接了 `@nuxt/content` 的项目把 `queryCollectionSearchSections()` 的产出映射进 `groups`，形状恰好对上（`title→label`、`id→to`（自带锚点）、`content→suffix`）：

```ts
const { data: sections } = await useAsyncData('search-sections', () =>
  queryCollectionSearchSections('docs'))

const searchGroups = computed(() => [
  ...navDerivedGroups, // 端点/指南索引照旧
  {
    id: 'content',
    label: '正文内容',
    items: (sections.value ?? []).map(s => ({
      label: s.title, to: s.id, suffix: s.content, icon: 'i-lucide-text',
    })),
  },
])
```

正文进 `suffix`：fuse 可搜、结果里可见并高亮，token 搜索/锚点跳转全部复用。这与 `UContentSearch` 静态引擎做的事相同，只是映射放在消费侧而不是焊进组件。**代价**：所有切片随页面载荷下发、纯客户端过滤——几十篇文档没问题，几百篇长文后考虑路径二。

**路径二：异步 `search` prop（大站/服务端检索）**——把检索交给后端，组件负责防抖、竞态丢弃、loading 与结果组渲染：

```vue
<ApiDocsSiteSearch
  :groups="searchGroups"
  :search="query => $fetch('/api/docs/search', { query: { q: query } })"
  search-group-label="正文内容"
  ...
/>
```

后端随意：content 的 `useSearchCollection`（SQLite 全文检索）、自建搜索接口、外部搜索服务。结果组 `ignoreFilter`（信任服务端排序）。活例：gallery docs-shell demo 用一个模拟延迟的 mock `searchContent` 演示了整条链路。

**什么时候才换 `UContentSearch`**：站点以散文指南为主、且深度绑定 content 生态（导航树、theme 组等全套）时。API 文档站通常不必——本切片的端点语义（method 色标、场景 facet）与同页锚点处理是 `UContentSearch` 没有的。

## 相关组件

- `<ApiDocsMethodBadge>` — 本 kit 的兄弟切片，端点项前置的方法色标复用它（`registryDependencies` 声明 `method-badge`，copy-in 时随本切片一起拉入）。
- `<ApiDocsSidebarNav>` — 同一文档站里的另一层搜索（树内就地过滤）；两层的分工论证见 `sidebar-nav.md`。
- `<UModal>` / `<UCommandPalette>` / `<UButton>` / `<UKbd>` — Nuxt UI 原语。
- `<UContentSearch>` — Nuxt UI 的全文检索（绑 `@nuxt/content`）；仅当站点以散文指南为主且深度绑定 content 生态时才考虑替换（见「正文检索」小节的取舍），接线见 `project-setup.md`。

## 规格与源码

- 规格模板见 `method/component-spec-template.md`。
- 源码：`packages/kits/api-docs/app/components/api-docs/SiteSearch.vue`。
- 整页装配示范：gallery `/kits/api-docs/docs-shell`（顶栏 + 侧栏 + reference 正文，含索引派生函数）。
