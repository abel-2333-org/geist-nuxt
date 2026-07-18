# 整页骨架（Page shell）

把一整屏页面搭起来的成品级外壳：根组件（`UApp`）、粘顶 header、主题切换、全宽主体（`UContainer` 只提供响应式左右 padding，`--ui-container` 为 100%）。都只用核心 Nuxt UI 组件 + Geist token，全部由 Nuxt 自动导入，无需手写 `import`。

> 想拼**页面内的一块**（区块/卡片网格/表单/空态/反馈）看同目录 `patterns.md`；想查「单个组件用法」看 `components/`。本文件只讲**整页外壳怎么搭**。

## 结构总览

标准结构：`UApp` 根 → 粘顶 header + 主内容区 + 可选 footer。用 Nuxt `layouts/default.vue` 承载外壳，`pages/**` 只写内容。

```vue
<!-- app/layouts/default.vue —— 外壳；app.vue 里 <NuxtLayout><NuxtPage/></NuxtLayout> -->
<script setup lang="ts">
const items = /* 你的导航数据源，NavigationMenuItem[] */
</script>
<template>
  <div class="min-h-screen flex flex-col bg-default text-default antialiased">
    <CompositionAppHeader :items="items">      <!-- foundation 提供的响应式头部 -->
      <template #brand>…</template>            <!-- logo/wordmark -->
      <template #actions>…<ThemeToggle /></template>
    </CompositionAppHeader>
    <main class="flex-1"><slot /></main>
    <footer class="border-t border-default">…</footer>
  </div>
</template>
```

- **粘顶 header 用 foundation 的 `<CompositionAppHeader>`**（下详），移动端抽屉、断点、汉堡都内建，不手写。
- **主题切换**默认已内置在 `<CompositionAppHeader>` 的 `#actions`；覆盖该 slot 时需自己带上 `<ThemeToggle />`。
- **logo/wordmark**用真实资源（见 `brand-assets.md`），不要占位图。

已验证的应用外壳（Nuxt 4）源码：`app/app.vue`（根组件）、`app/layouts/default.vue`（完整外壳活样例：header + 自动导航 + footer）、`foundation/compositions/AppHeader.vue`（响应式头部）、`foundation/components/ThemeToggle.vue`（直接 `<ThemeToggle />`）。

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

## 明暗切换（`ThemeToggle`，foundation 提供）

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

## Header（`<CompositionAppHeader>`，foundation 提供）

粘顶 + 响应式头部是 foundation 的 composition 组件（`foundation/compositions/AppHeader.vue`），
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

## 要点

- 头部观感（`bg-default/75 backdrop-blur`、`border-b border-default`、`sticky top-0`、`h-(--ui-header-height)`）由 `UHeader` 主题内建，不要另写。
- 图标按钮都带 `aria-label`；logo 图片 `alt=""`（旁边有文字）。
- `UApp` 只在 `app/app.vue` 挂一次（提供 toast/overlay 上下文），不要重复挂载。
- 明暗切换只用 `useColorMode()`（封装在 `ThemeToggle`），不要手写 class / localStorage。
