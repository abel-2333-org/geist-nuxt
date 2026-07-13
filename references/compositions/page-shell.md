# 整页骨架（Page shell）

把一整屏页面搭起来的成品级外壳：根组件（`UApp`）、粘顶 header、主题切换、`--ui-container` 约束的主体。都只用核心 Nuxt UI 组件 + Geist token，全部由 Nuxt 自动导入，无需手写 `import`。

> 想拼**页面内的一块**（区块/卡片网格/表单/空态/反馈）看同目录 `patterns.md`；想查「单个组件用法」看 `components/`。本文件只讲**整页外壳怎么搭**。

## 两种外壳，先选对（按导航深度）

core 提供两个并列的外壳 composition，**按导航层级深度选**，不要混用：

| 外壳 | 导航布局 | 层级能力 | 什么时候用 |
|---|---|---|---|
| `<CompositionAppHeader>` | 横排顶栏（移动端 slideover） | **最多两层**：顶栏项 → 一层下拉子项（可选 description 做 mega-menu） | 扁平站点：落地页、少量顶级页、每个入口无需再分子页 |
| `<CompositionAppShell>` | 瘦顶栏（仅全局动作）+ 左侧常驻竖向 sidebar | **任意层级**：sidebar 用竖向 `UNavigationMenu`，`type:'label'` 分组标题 + children 原生 accordion 嵌套 | 文档/多区站点：分组区段、多页 kit、嵌套子页（gallery 本身即用此） |

> **为什么不是一个外壳搞定**：Nuxt UI 的**横向** `UNavigationMenu` 渲染器硬性只吃两层（孙级 children 在横向模式被丢弃，`content-orientation` 只切换那一层子项的排布方向、不加深度）；**竖向** `UNavigationMenu` 才把 children 渲染成 accordion、支持真正的层级。所以导航一旦有第三层，就必须走 `AppShell` 的侧栏，而不是给 header 打补丁。两者都只用 Nuxt UI 原语，同一份 `NavigationMenuItem[]` 数据源可无缝喂给任一外壳。

## 结构总览

标准结构：`UApp` 根 → 粘顶 header + 主内容区 + 可选 footer。用 Nuxt `layouts/default.vue` 承载外壳，`pages/**` 只写内容。

```vue
<!-- app/layouts/default.vue —— 外壳；app.vue 里 <NuxtLayout><NuxtPage/></NuxtLayout> -->
<script setup lang="ts">
const items = /* 你的导航数据源，NavigationMenuItem[] */
</script>
<template>
  <div class="min-h-screen flex flex-col bg-default text-default antialiased">
    <CompositionAppHeader :items="items">      <!-- core 提供的响应式头部 -->
      <template #brand>…</template>            <!-- logo/wordmark -->
      <template #actions>…<ThemeToggle /></template>
    </CompositionAppHeader>
    <main class="flex-1"><slot /></main>
    <footer class="border-t border-default">…</footer>
  </div>
</template>
```

- **粘顶 header 用 core 的 `<CompositionAppHeader>`**（下详），移动端抽屉、断点、汉堡都内建，不手写。
- **主题切换**默认已内置在 `<CompositionAppHeader>` 的 `#actions`；覆盖该 slot 时需自己带上 `<ThemeToggle />`。
- **logo/wordmark**用真实资源（见 `brand-assets.md`），不要占位图。

上面的总览用 `<CompositionAppHeader>` 演示扁平外壳；`apps/gallery/app/layouts/default.vue` 是**侧栏外壳** `<CompositionAppShell>` 的完整活样例（瘦顶栏 + 竖向多层级导航 + footer，因为 gallery 有多页 kit）。已验证的应用外壳（Nuxt 4）源码：`starter/app/app.vue`（根组件）、`apps/gallery/app/layouts/default.vue`（侧栏外壳活样例）、`packages/core/app/components/composition/AppHeader.vue`（横排头部）、`packages/core/app/components/composition/AppShell.vue`（侧栏外壳）、`packages/core/app/components/ThemeToggle.vue`（core 提供，直接 `<ThemeToggle />`）。

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

## Header（`<CompositionAppHeader>`，core 提供）

粘顶 + 响应式头部是 core 的 composition 组件（`packages/core/app/components/composition/AppHeader.vue`），
基于 Nuxt UI `UHeader mode="slideover"`：**桌面横排导航、移动端汉堡 + slideover 抽屉、断点 `lg`、路由变化自动收起**——全部内建，不手写 `<header>`、不手写 media query。它**数据无关**：

- **prop `items: NavigationMenuItem[]`** —— 导航数据由消费方传入（如从路由树自动派生，见 `references/gallery.md`「页面组织」）。
- **slot `#brand`** —— logo / wordmark / badge，默认给 geist-nuxt 兜底，可完全覆盖。
- **slot `#actions`** —— 右侧动作区，**默认内置 `<ThemeToggle />`**；覆盖后需自己带上。

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

## Sidebar 外壳（`<CompositionAppShell>`，core 提供）

导航有真实层级（分组区段、多页 kit、嵌套子页）时用它替代 `AppHeader`（`packages/core/app/components/composition/AppShell.vue`）。它把导航从顶栏移到**左侧常驻 sidebar**：顶栏瘦身成只放全局动作（brand / 主题 / 外链），主体用 Nuxt UI 文档站布局原语 `UMain` + `UPage` + `UPageAside`，sidebar 内是**竖向** `UNavigationMenu`——children 原生渲染为 accordion，`type:'label'` 项渲染为分组标题，层级不限深。移动端（`< lg`）sidebar 自动隐藏，导航落进顶栏 `UHeader mode="slideover"` 的抽屉（同一份 `items` 竖向渲染），断点/汉堡/路由收起全内建。同样**数据无关**：

- **prop `items: NavigationMenuItem[]`** —— 与 `AppHeader` 同一份数据源，直接互换。多页分组用 `{ label, type: 'label' }` 起一个区段标题，其后跟带 `children` 的可折叠项（`defaultOpen: true` 让当前区段默认展开）。
- **slot `#brand` / `#actions`** —— 同 `AppHeader`；`#actions` 覆盖后需自带 `<ThemeToggle />`。
- **默认 slot** —— 页面内容（渲染进 `UPage` 右侧内容列）。
- **slot `#footer`** —— 可选页脚，落在主体之下。

```vue
<script setup lang="ts">
const items = useGalleryNav() // 含 type:'label' 分组 + 带 children 的 accordion 项
</script>
<template>
  <CompositionAppShell :items="items">
    <template #brand>…</template>
    <template #actions>…<ThemeToggle /></template>

    <slot />                          <!-- 页面内容进 UPage 内容列 -->

    <template #footer>…</template>
  </CompositionAppShell>
</template>
```

sidebar 项与移动抽屉项都按路由自动高亮，无需手写 active。活样例：`apps/gallery/app/layouts/default.vue`（外壳装配）+ `apps/gallery/app/composables/useGalleryNav.ts`（如何把路由树整形成 `label` 分组 + accordion 层级）。

## 要点

- 头部观感（`bg-default/75 backdrop-blur`、`border-b border-default`、`sticky top-0`、`h-(--ui-header-height)`）由 `UHeader` 主题内建，不要另写。
- 图标按钮都带 `aria-label`；logo 图片 `alt=""`（旁边有文字）。
- `UApp` 只在 `app/app.vue` 挂一次（提供 toast/overlay 上下文），不要重复挂载。
- 明暗切换只用 `useColorMode()`（封装在 `ThemeToggle`），不要手写 class / localStorage。
