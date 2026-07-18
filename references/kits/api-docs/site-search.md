# ApiDocsSiteSearch `<ApiDocsSiteSearch>`

文档站 **app 顶栏**里的**全站搜索**：一个触发按钮 + `⌘K` 模态命令面板，检索对象是**文档索引**（指南页 + 按用途命名的端点，端点带请求方法与场景标签两个 facet）。回答的问题是「**从任何地方去任何页面**」——与 `ApiDocsSidebarNav` 顶部的**树内就地过滤**（「在当前菜单里缩小范围」）分属不同层级、不同位置，两者**刻意匹配同样的维度**（用途名 / 请求方法 / 场景标签），读者对「什么可被搜到」的心智模型在两层都成立（分层论证见 `sidebar-nav.md` 的「就地过滤 vs 全站搜索」）。

**数据无关是设计前提**：组件吃一个文档索引数组，**不依赖 `@nuxt/content` 或任何内容管线**——gallery、starter 和任何消费项目无论文档怎么存都能用。这正是不直接用 Nuxt UI `<UContentSearch>` 的原因：它绑死 `@nuxt/content`，而 gallery/starter 刻意不装内容管线（可靠性决策）。**已接 `@nuxt/content` 的消费项目**可以在同一个顶栏位置换成 `UContentSearch`（获得跨正文全文检索），基座不为此背依赖。

> 文件放在 `components/api-docs/SiteSearch.vue`。约定 `pathPrefix: true`，组件名 = 目录名 + 文件名，所以模板名是 `<ApiDocsSiteSearch>`。数据无关：索引数据模型内联随组件走，所有 chrome 文案经 props 注入（i18n-ready）。

## Anatomy（结构）

```
trigger  ── UButton（neutral outline sm）
│           ├─ 放大镜图标
│           ├─ 文本 label（< sm 隐藏；ariaLabel 兜底可访问名）
│           └─ UKbd ⌘ + K 提示
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
- **条目渲染复用既有语汇**：端点项前置 `ApiDocsMethodBadge`（唯一带色元素，同侧栏），指南项前置其 icon；suffix 承载场景串（+ 可选补充说明，用 ` · ` 连接）。菜单里怎么认，面板里就怎么认。
- **⌘K 是 toggle**：面板已开时再按 `⌘K` 关闭，符合命令面板的通用肌肉记忆。快捷键经 Nuxt UI `defineShortcuts` 注册于组件内，消费方零接线。**不占用 `/`**——那是侧栏树内过滤的聚焦键，两层快捷键不冲突。
- **选中即关闭 + 导航**：item 的 `onSelect` 关闭模态，导航由 item 的 `to`（LinkProps）走 NuxtLink——站内路由、锚点、预取都是平台默认行为，组件不自己写跳转逻辑。

## 状态（state model）

- 整体：closed / open。打开 = 点击 trigger 或 `⌘K`（toggle）；关闭 = `Esc` / 点遮罩 / 面板关闭按钮（`UModal` 内建）/ 选中条目 / 再按 `⌘K`。
- 面板：idle（空 query，全量列出，`matchAllWhenSearchEmpty` 默认）/ searching（fuse 过滤中，命中高亮可键盘上下移动）/ no-results（空态文案）。
- 每次关闭后重开，输入框清空并重新聚焦（`UModal` 销毁内容 + `UCommandPalette` autofocus 的组合默认行为）。
- trigger：default / hover / `focus-visible` 紫环 / open（模态在上时按钮不需要额外压态）。

## Accessibility（无障碍）

- 焦点圈闭在模态内、关闭后**焦点还原到 trigger**——`UModal`（reka-ui Dialog）内建，组件不自己管焦点。
- 模态可访问名：`#content` 模式下 `UModal` 把 `title` prop 渲染为视觉隐藏的 `DialogTitle`，读屏打开时播报 `modalTitle`。
- trigger 文本 `< sm` 隐藏后由 `aria-label`（`ariaLabel ?? triggerLabel`）兜底；`UKbd` 提示是装饰性的。
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

> 索引从哪来由消费项目决定：手写、由侧栏导航数据派生（推荐，见 gallery docs-shell demo 的 `toSearchGroups()`），或构建期从 OpenAPI/路由表生成。已接 `@nuxt/content` 的项目要跨正文全文检索时，可在同一位置换 `<UContentSearch>`；本切片保持零内容管线依赖。

## 相关组件

- `<ApiDocsMethodBadge>` — 本 kit 的兄弟切片，端点项前置的方法色标复用它（`registryDependencies` 声明 `method-badge`，copy-in 时随本切片一起拉入）。
- `<ApiDocsSidebarNav>` — 同一文档站里的另一层搜索（树内就地过滤）；两层的分工论证见 `sidebar-nav.md`。
- `<UModal>` / `<UCommandPalette>` / `<UButton>` / `<UKbd>` — Nuxt UI 原语。
- `<UContentSearch>` — Nuxt UI 的全文检索（绑 `@nuxt/content`）；接了内容管线的消费项目可用它替换本组件，接线见 `project-setup.md`。

## 规格与源码

- 规格模板见 `method/component-spec-template.md`。
- 源码：`packages/kits/api-docs/app/components/api-docs/SiteSearch.vue`。
- 整页装配示范：gallery `/kits/api-docs/docs-shell`（顶栏 + 侧栏 + reference 正文，含索引派生函数）。
