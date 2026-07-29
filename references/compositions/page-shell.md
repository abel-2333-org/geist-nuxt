# 整页骨架（Page shell）

把一整屏页面搭起来的成品级外壳：根组件（`UApp`）、粘顶 header、主题切换、全宽主体（`UContainer` 只提供响应式左右 padding，`--ui-container` 为 100%）。都只用核心 Nuxt UI 组件 + Geist token；组件自动导入，locale 从 `@nuxt/ui/locale` 显式导入。

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
    <AppHeader :items="items">      <!-- foundation 提供的响应式头部 -->
      <template #brand>…</template>            <!-- logo/wordmark -->
      <template #actions>…<ThemeToggle /></template>
    </AppHeader>
    <main class="flex-1"><slot /></main>
    <footer class="border-t border-default">…</footer>
  </div>
</template>
```

- **粘顶 header 用 foundation 的 `<AppHeader>`**（下详），移动端抽屉、断点、汉堡都内建，不手写。
- **主题切换**默认已内置在 `<AppHeader>` 的 `#actions`；覆盖该 slot 时需自己带上 `<ThemeToggle />`。
- **logo/wordmark**用真实资源（见 `brand-assets.md`），不要占位图。

已验证的应用外壳（Nuxt 4）源码：`app/app.vue`（根组件）、`app/layouts/default.vue`（完整外壳活样例：header + 自动导航 + footer）、`foundation/compositions/AppHeader.vue`（响应式头部）、`foundation/components/ThemeToggle.vue`（直接 `<ThemeToggle />`）。

## 根组件（`app/app.vue`）

`UApp` 包裹整个应用，提供 toast / overlay / tooltip 上下文；`NuxtPage` 渲染 `app/pages/` 路由。favicon、标题、语言都在 `useHead` 里声明。

```vue
<script setup lang="ts">
import { zh_cn } from '@nuxt/ui/locale'

useHead({
  title: 'Developer Portal',
  meta: [
    { name: 'description', content: 'Product documentation and API reference.' },
  ],
  link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
  htmlAttrs: { lang: 'zh-CN' },
})
</script>

<template>
  <UApp :locale="zh_cn">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
```

## 明暗切换（`ThemeToggle`，foundation 提供）

`ThemeToggle` 是稳定的 foundation 组件名，内部直接委托 Nuxt UI 的 `<UColorModeButton>`。切换状态、SSR 处理、图标和可访问名称都由 Nuxt UI 维护；可访问名称会读取根 `<UApp :locale="...">` 的 locale。不要在这里重复实现 `useColorMode()`、`ClientOnly`、class 或 localStorage 逻辑。

```vue
<template>
  <UColorModeButton />
</template>
```

`nuxt.config.ts` 里配 `colorMode: { preference: 'system', fallback: 'light' }`——Geist 是浅色优先的画布。

## Header（`<AppHeader>`，foundation 提供）

粘顶 + 响应式头部是 foundation 的 composition 组件（`foundation/compositions/AppHeader.vue`），
基于 Nuxt UI `UHeader mode="slideover"`：**桌面横排导航、移动端汉堡 + slideover 抽屉、断点 `lg`、路由变化自动收起**——全部内建，不手写 `<header>`、不手写 media query。它**数据无关**：

- **prop `items: NavigationMenuItem[]`** —— 导航数据由消费方传入（如从路由树自动派生，见 `references/gallery.md`「页面组织」）。
- **prop `brand`** —— 未提供 slot 时的中性 wordmark，默认 `Application`。
- **slot `#brand`** —— logo / wordmark / badge，可完全覆盖 `brand` fallback。
- **slot `#actions`** —— 右侧动作区，**默认内置 `<ThemeToggle />`**；覆盖后需自己带上。

```vue
<script setup lang="ts">
// items 通常来自导航数据源（gallery 用 useGalleryNav() 从路由树自动派生）
const items = useGalleryNav()
</script>
<template>
  <AppHeader :items="items">
    <template #brand>
      <NuxtLink to="/" class="flex items-center gap-2.5 text-highlighted" aria-label="Developer Docs home">
        <span class="font-mono text-sm font-semibold tracking-tight">Developer Docs</span>
      </NuxtLink>
    </template>
    <template #actions>
      <UButton label="Guides" color="neutral" variant="ghost" to="/guides" class="max-sm:hidden" />
      <ThemeToggle />
    </template>
  </AppHeader>
</template>
```

导航项按 `to` 与当前路由**自动高亮**（`NavigationMenuItem` 内部用 `ULink`），无需手写 active 逻辑。

## 要点

- 头部观感（`bg-default/75 backdrop-blur`、`border-b border-default`、`sticky top-0`、`h-(--ui-header-height)`）由 `UHeader` 主题内建，不要另写。
- 图标按钮都带 `aria-label`；logo 图片 `alt=""`（旁边有文字）。
- `UApp` 只在 `app/app.vue` 挂一次（提供 toast/overlay 上下文），不要重复挂载。
- 明暗切换委托 `UColorModeButton`（封装在 `ThemeToggle`），根 `UApp` 负责 locale；不要手写 class / localStorage。
