# 整页骨架（Page shell）

把一整屏页面搭起来的成品级外壳：根组件（`UApp`）、导航外壳、主题切换、主体。都只用核心 Nuxt UI 组件 + Geist token，全部由 Nuxt 自动导入，无需手写 `import`。

> 想拼**页面内的一块**（区块/卡片网格/表单/空态/反馈）看同目录 `patterns.md`；想查「单个组件用法」看 `components/`。本文件只讲**整页外壳怎么搭**。

## 两种外壳，按导航形态选

core 提供两个数据无关的外壳组件，都吃同一份 `items: NavigationMenuItem[]`、都内建移动端 slideover，二选一即可：

| 外壳 | 组件 | 适用 |
|---|---|---|
| **可折叠侧栏**（默认） | `<CompositionAppShell>` | 多区/多 kit 的产品或文档站；导航项多、有层级。gallery 用的就是它。 |
| **横向顶栏** | `<CompositionAppHeader>` | 扁平营销站/落地页；导航项少、无深层级。 |

两者都：`UApp` 根 → 外壳（含 `<main>`）→ 可选 `#footer`。用 Nuxt `layouts/default.vue` 承载，`pages/**` 只写内容，页面内容走外壳的**默认插槽**。

- **主题切换**不再默认内置，放在外壳的 `#actions` 里自己带 `<ThemeToggle />`。
- **logo/wordmark**用真实资源（见 `brand-assets.md`），不要占位图。

已验证源码：`starter/app/app.vue`（根组件）、`apps/gallery/app/layouts/default.vue`（完整外壳活样例：侧栏 + 自动导航 + footer）、`packages/core/app/components/composition/{AppShell,AppHeader}.vue`、`packages/core/app/composables/useSidebar.ts`（折叠状态持久化）、`packages/core/app/components/ThemeToggle.vue`。

## 可折叠侧栏（`<CompositionAppShell>`，core 提供，默认）

Vercel dashboard 风格的持久侧栏：**侧栏与内容同底色 `bg-default`，仅一条 `border-r` hairline 分隔**（不是重色块），`sticky top-0 h-screen`。三段式——brand 行（`h-16` 底边框）→ 可滚动导航 → 底部图标动作区 + 折叠开关。

- **折叠交互全走 `UNavigationMenu` 原生能力**：展开 `w-64`、折叠 `w-16`（`transition-[width]`）；折叠时给菜单加 `:collapsed` → 仅图标，配 `tooltip`（悬停显示标签，右侧）+ `popover`（带子项的 kit 悬停弹出子菜单）。不手搓这些交互。
- **折叠状态用 `useSidebar()` 持久化**：cookie seed `useState`（SSR 安全，无水合闪烁），沿用 `useSplitPane` 的持久化模型。
- **slot `#brand`/`#actions` 带 `{ collapsed }` 作用域**：brand 在折叠时只渲染 logo mark（隐 wordmark）；actions 是图标按钮，展开横排、折叠竖排居中，折叠开关自动推到右侧。
- **层级**：顶级页平铺 → `type: 'label'` 分区标题（如 `Kits`，折叠时自动隐藏）→ 每个 kit 是 link 或可折叠 accordion。
- **active 高亮**用 `color="primary"`（紫字 + 淡色块），**不用 `highlight`**（那是左边框指示条，非 Vercel 观感）。
- **信息层级微调**（sanctioned `:ui` 覆盖，全语义 token）：未选中 link 从组件默认的 `text-muted`（为密集顶栏调的「弱化」档）提到 `text-toned`（侧栏目的地属「次要文字」档），scope 到 `:not([aria-current=page])` 以保住 active 紫色；分区标签对齐 Label 12（`uppercase tracking-wide text-dimmed`）。

```vue
<!-- app/layouts/default.vue -->
<script setup lang="ts">
const items = useGalleryNav()   // NavigationMenuItem[]，可含 type:'label' 分区标题与 children accordion
</script>
<template>
  <CompositionAppShell :items="items">
    <template #brand="{ collapsed }">
      <NuxtLink to="/" class="flex items-center gap-2.5 text-highlighted min-w-0" aria-label="首页">
        <img src="/favicon.svg" alt="" class="size-6 shrink-0" width="24" height="24" />
        <span v-if="!collapsed" class="font-mono text-sm font-semibold tracking-tight whitespace-nowrap">geist-nuxt</span>
      </NuxtLink>
    </template>
    <template #actions>
      <ThemeToggle />
      <UButton icon="i-simple-icons-github" color="neutral" variant="ghost" aria-label="GitHub 仓库" to="…" target="_blank" />
    </template>
    <template #footer>…</template>

    <slot />   <!-- 页面内容进外壳默认插槽（其 <main>）；漏了这行内容区会整片空白 -->
  </CompositionAppShell>
</template>
```

## 根组件（`app/app.vue`）

`UApp` 包裹整个应用，提供 toast / overlay / tooltip 上下文；`NuxtPage` 渲染 `app/pages/` 路由。favicon、标题、语言都在 `useHead` 里声明。

```vue
<script setup lang="ts">
useHead({
  title: 'geist-nuxt · Geist visual language on Nuxt UI',
  meta: [
    { name: 'description', content: '...' },
  ],
  link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
  htmlAttrs: { lang: 'zh-CN' },
})
</script>

<template>
  <UApp>
    <NuxtPage />
  </UApp>
</template>
```

## 明暗切换（`ThemeToggle`，core 提供）

用 Nuxt UI 内置的 `@nuxtjs/color-mode`（随 `@nuxt/ui` 模块自动注册），通过 `useColorMode()` 读写偏好——不要自己写 class 切换或 localStorage 逻辑。`useColorMode` / `computed` 都由 Nuxt 自动导入。用 `<ClientOnly>` 包裹以避免 SSR 水合闪烁。

```vue
<script setup lang="ts">
const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')
function toggle() {
  colorMode.preference = isDark.value ? 'light' : 'dark'
}
</script>

<template>
  <ClientOnly>
    <UTooltip :text="isDark ? '切换到浅色' : '切换到深色'">
      <UButton
        :icon="isDark ? 'i-lucide-moon' : 'i-lucide-sun'"
        color="neutral"
        variant="ghost"
        :aria-label="isDark ? '切换到浅色模式' : '切换到深色模式'"
        @click="toggle"
      />
    </UTooltip>
    <template #fallback>
      <UButton icon="i-lucide-sun" color="neutral" variant="ghost" aria-label="切换颜色模式" />
    </template>
  </ClientOnly>
</template>
```

`nuxt.config.ts` 里配 `colorMode: { preference: 'system', fallback: 'light' }`——Geist 是浅色优先的画布。

## 横向顶栏（`<CompositionAppHeader>`，core 提供，扁平站点备选）

粘顶 + 响应式头部是 core 的 composition 组件（`packages/core/app/components/composition/AppHeader.vue`），
基于 Nuxt UI `UHeader mode="slideover"`：**桌面横排导航、移动端汉堡 + slideover 抽屉、断点 `lg`、路由变化自动收起**——全部内建，不手写 `<header>`、不手写 media query。**导航项少、无深层级的扁平站点用它**；多区/多 kit 用上面的侧栏。它**数据无关**：

- **prop `items: NavigationMenuItem[]`** —— 导航数据由消费方传入（如从路由树自动派生，见 `references/gallery.md`「页面组织」）。
- **slot `#brand`** —— logo / wordmark / badge，默认给 geist-nuxt 兜底，可完全覆盖。
- **slot `#actions`** —— 右侧动作区，自己带上 `<ThemeToggle />`。

```vue
<script setup lang="ts">
// items 通常来自导航数据源（gallery 用 useGalleryNav() 从路由树自动派生）
const items = useGalleryNav()
</script>
<template>
  <CompositionAppHeader :items="items">
    <template #brand>
      <NuxtLink to="/" class="flex items-center gap-2.5 text-highlighted" aria-label="geist-nuxt 首页">
        <img src="/favicon.svg" alt="" class="size-6" width="24" height="24" />
        <span class="font-mono text-sm font-semibold tracking-tight">geist-nuxt</span>
      </NuxtLink>
      <UBadge color="neutral" variant="subtle" size="sm" class="font-mono max-sm:hidden">Nuxt · Nuxt UI</UBadge>
    </template>
    <template #actions>
      <UButton label="文档" color="neutral" variant="ghost" trailing-icon="i-lucide-arrow-up-right" to="https://ui.nuxt.com" target="_blank" class="max-sm:hidden" />
      <UButton icon="i-simple-icons-github" color="neutral" variant="ghost" aria-label="GitHub 仓库" to="https://github.com/abel-2333-org/geist-nuxt" target="_blank" />
      <ThemeToggle />
    </template>
  </CompositionAppHeader>
</template>
```

导航项按 `to` 与当前路由**自动高亮**（`NavigationMenuItem` 内部用 `ULink`），无需手写 active 逻辑。

## 要点

- **页面内容走外壳默认插槽**：侧栏/顶栏都自带 `<main><slot/></main>`，layout 里必须把页面 `<slot />` 作为外壳的默认子节点传入，漏了内容区会整片空白。
- 顶栏观感（`bg-default/75 backdrop-blur`、`border-b`、`sticky top-0`、`h-(--ui-header-height)`）由 `UHeader` 主题内建；侧栏观感（同底色 + `border-r` hairline、`sticky h-screen`）见 AppShell，二者都不要另写重阴影/重色块。
- 折叠侧栏的图标态、tooltip、子项 popover 全走 `UNavigationMenu` 原生 prop（`collapsed`/`tooltip`/`popover`），不手搓；折叠状态用 `useSidebar()`（cookie 持久化）。
- 图标按钮都带 `aria-label`；logo 图片 `alt=""`（旁边有文字）。
- `UApp` 只在 `app/app.vue` 挂一次（提供 toast/overlay 上下文），不要重复挂载。
- 明暗切换只用 `useColorMode()`（封装在 `ThemeToggle`），不要手写 class / localStorage。
