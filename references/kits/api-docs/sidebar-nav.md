# ApiDocsSidebarNav `<ApiDocsSidebarNav>`

文档 / 开发者门户的**侧边栏导航**：一个菜单容纳多个**可折叠板块**，而各板块指向的页面性质差异很大——「指南」板块是文字链接，「接口」板块是带 HTTP method 色标的端点链接。多个板块可**同时展开**、各带一个**计数**，顶部**单一全局搜索**跨所有板块过滤（`/` 聚焦），因此某个子项很多的大板块也能被快速检索到、不必滚动翻找。

> 文件放在 `components/api-docs/SidebarNav.vue`。约定 `pathPrefix: true`，组件名 = 目录名 + 文件名，所以模板名是 `<ApiDocsSidebarNav>`。数据无关：导航数据模型内联随组件走，所有 chrome 文案经 props 注入（i18n-ready）。

## Anatomy（结构）

```
nav (landmark, 粘顶 + 自身滚动区)
├─ search   ── UInput（放大镜图标 + UKbd '/' 提示 / 清除按钮）——全局过滤
└─ 滚动区
   └─ section (UCollapsible) ×N
      ├─ trigger  ── chevron（展开转 90°）· 可选 icon · 板块标题（mono 大写 tracking）· 计数 UBadge
      └─ content  ── item (ULink) 列表，左侧一条 border 缩进
         ├─ 指南项：可选 icon + label
         └─ 接口项：ApiDocsMethodBadge（定宽对齐）+ label（+ 可选尾部 badge）
```

板块**多开**（各自独立开合，适合边看边对照）；菜单再长也只在 `nav` 内部滚动，不影响页面布局。

## Props

| prop | 类型 | 说明 |
|---|---|---|
| `sections` | `SidebarNavSection[]` | 板块数据（见下）。**必填** |
| `ariaLabel` | `string` | `<nav>` 地标可访问名，默认 `Documentation` |
| `searchable` | `boolean` | 是否显示顶部搜索，默认 `true` |
| `searchPlaceholder` | `string` | 搜索占位符 / aria-label，默认 `Search` |
| `searchShortcut` | `string` | 键盘提示 + 聚焦搜索的按键，默认 `/` |
| `clearLabel` | `string` | 清除按钮的 aria-label，默认 `Clear search` |
| `emptyLabel` | `string` | 搜索无结果时的文案，默认 `No matching pages` |

### 数据模型（内联，随切片走）

```ts
interface SidebarNavItem {
  label: string          // 显示文本（已本地化）
  to?: string            // 路由；用 ULink 渲染，active 态 + 预取自动生效
  method?: string        // HTTP method → 行首 ApiDocsMethodBadge（接口板块）
  icon?: string          // 行首 Iconify 图标（指南板块）；method 存在时忽略
  badge?: string | number// 可选尾部 badge（如 "beta"）
  active?: boolean        // 强制 active（demo/手控）；通常由 to 推断
}
interface SidebarNavSection {
  id?: string            // 稳定 id，缺省时取 label 的 slug
  label: string          // 板块标题（已本地化）
  icon?: string          // 板块头可选图标
  items: SidebarNavItem[]
  defaultOpen?: boolean  // 首次渲染即展开；搜索激活时被忽略
}
```

## 关键点

- **异构板块靠数据区分，不靠 variant**：同一个 `items` 里，带 `method` 的是接口行（渲染 `ApiDocsMethodBadge`，方法色标是「色 + 大写动词」双通道），带/不带 `icon` 的是指南行。方法色标复用兄弟切片 `ApiDocsMethodBadge`（GET=info/POST=success/…），**不另造色板**。
- **全局搜索是唯一搜索入口**：顶部一个 `UInput` 过滤所有板块——板块标题命中则整块保留、否则只留命中的 item；有查询时**命中板块强制展开**，让结果始终可见，计数徽章显示 `命中/总数`。这样「大板块子项多」的检索需求由全局搜索覆盖，无需每块再放一个搜索框。
- **菜单自身是滚动区**：`nav` 用 `max-h-[calc(100dvh-4rem)]` + 顶部 `search` 粘住、下方 `overflow-y-auto`。多板块同时展开把列表撑长时只在侧栏内部滚动，页面其余部分不动。
- **接口行方法色标定宽对齐**：method badge 包在 `w-14` 的槽里，使不同方法（GET/DELETE…）后面的 label 起始 x 对齐。
- **折叠动画走 Nuxt UI `UCollapsible` 默认**：不覆盖 `ui.content`，直接复用主题内建的 `collapsible-down/up` 动画，`prefers-reduced-motion` 由 layer 全局处理。

## 状态（state model）

- 板块：collapsed / expanded（多开）、trigger hover、`focus-visible` 紫环。
- item：default / hover / **active（`aria-current="page"`，由 ULink 依 `to` 判定）** / `focus-visible`。
- 搜索：empty / has-query（命中板块强制展开 + 计数转 `命中/总数`）/ no-results（空态文案）。

## Accessibility（无障碍）

- 根节点是 `<nav :aria-label>` 地标；板块用真实 `<button>` 触发（Reka `UCollapsible` 接好 `aria-expanded`/`aria-controls`），可访问名 = 板块标题 + 计数。
- chevron 用 `aria-hidden`；搜索 `UInput` 带 `aria-label`，`UKbd` 提示装饰性 `aria-hidden`，清除按钮有 `aria-label`。
- 站内链接一律 `ULink`（客户端路由 + 预取 + 自动 `aria-current`），**不手写 `<a>`**。
- 键盘：`/` 聚焦搜索（正在输入 / IME 组字时不抢焦），`Esc` 清空并失焦；所有交互元素 `focus-visible` 显示紫环。

## 用法

```vue
<ApiDocsSidebarNav
  :sections="[
    {
      label: '指南', icon: 'i-lucide-book-open', defaultOpen: true,
      items: [
        { label: '快速开始', to: '/guide/quickstart', icon: 'i-lucide-rocket' },
        { label: '认证', to: '/guide/auth', icon: 'i-lucide-key' },
      ],
    },
    {
      label: 'Checkout', defaultOpen: true,
      items: [
        { label: '/checkout/sessions', to: '/api/checkout-create', method: 'POST' },
        { label: '/checkout/sessions/{id}', to: '/api/checkout-get', method: 'GET' },
      ],
    },
  ]"
  :aria-label="'支付文档'"
  :search-placeholder="'搜索文档'"
  :empty-label="'没有匹配的页面'"
/>
```

## 相关组件

- `<ApiDocsMethodBadge>` — HTTP method 色标（接口行复用它；`registryDependencies` 已声明，copy-in 时随本切片一起拷入）。
- `<UCollapsible>` / `<ULink>` / `<UInput>` / `<UBadge>` / `<UKbd>` — Nuxt UI 原语。

## 规格与源码

- 规格模板见 `method/component-spec-template.md`。
- 源码：`packages/kits/api-docs/app/components/api-docs/SidebarNav.vue`；依赖切片 `method-badge`（`MethodBadge.vue` + `utils/method-preset.ts`）由 `registryDependencies` 拉入。
