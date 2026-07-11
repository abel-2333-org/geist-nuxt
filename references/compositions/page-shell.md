# 整页骨架（Page shell）

把一整屏页面搭起来的成品级外壳：根组件（`UApp`）、粘顶 header、主题切换、`--ui-container` 约束的主体。都只用核心 Nuxt UI 组件 + Geist token，全部由 Nuxt 自动导入，无需手写 `import`。

> 想拼**页面内的一块**（区块/卡片网格/表单/空态/反馈）看同目录 `patterns.md`；想查「单个组件用法」看 `components/`。本文件只讲**整页外壳怎么搭**。

## 结构总览

标准结构：`UApp` 根 → 粘顶 header + 主内容区 + 可选 footer。

```vue
<!-- app/app.vue 已提供 <UApp> 与 <NuxtPage>；页面只写内容 -->
<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader />                          <!-- 粘顶导航 + 主题切换 -->
    <main class="flex-1">
      <PricingSection />
      <UContainer class="py-14 sm:py-20 space-y-20">
        <!-- 各内容区块，见 patterns.md -->
      </UContainer>
    </main>
    <AppFooter />
  </div>
</template>
```

- **header 粘顶**：`sticky top-0 z-50` + `border-b border-default` + 半透明背景 `bg-default/80 backdrop-blur`。
- **主题切换**放 header 右侧，用 `ThemeToggle`（`useColorMode`）。
- **logo/wordmark**用真实资源（见 `brand-assets.md`），不要占位图。

已验证的应用外壳（Nuxt 4）源码：`starter/app/app.vue`（根组件）、`apps/gallery/app/components/AppHeader.vue`（头部）、`packages/core/app/components/ThemeToggle.vue`（core 提供，项目里直接 `<ThemeToggle />`）。

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

## Header（`app/components/AppHeader.vue`）

`ThemeToggle` 由 core layer 提供，自动导入，无需 `import`。

```vue
<template>
  <header class="sticky top-0 z-40 border-b border-default bg-default/80 backdrop-blur supports-[backdrop-filter]:bg-default/60">
    <div class="mx-auto flex h-16 w-full max-w-(--ui-container) items-center gap-3 px-4 sm:px-6 lg:px-8">
      <a href="/" class="flex items-center gap-2.5 text-highlighted" aria-label="geist-nuxt 首页">
        <img src="/favicon.svg" alt="" class="size-6" width="24" height="24" />
        <span class="font-mono text-sm font-semibold tracking-tight">geist-nuxt</span>
      </a>
      <UBadge color="neutral" variant="subtle" size="sm" class="font-mono max-sm:hidden">Nuxt · Nuxt UI</UBadge>
      <nav class="ms-auto flex items-center gap-1">
        <UButton label="文档" color="neutral" variant="ghost" trailing-icon="i-lucide-arrow-up-right" to="https://ui.nuxt.com" target="_blank" class="max-sm:hidden" />
        <UButton icon="i-simple-icons-github" color="neutral" variant="ghost" aria-label="GitHub 仓库" to="https://github.com/abel-2333-org/geist-nuxt" target="_blank" />
        <ThemeToggle />
      </nav>
    </div>
  </header>
</template>
```

## 要点

- 头部用 `border-default` / `bg-default` 语义 token，宽度用 `max-w-(--ui-container)`。
- 图标按钮都带 `aria-label`；logo 图片 `alt=""`（旁边有文字）。
- `UApp` 只在 `app/app.vue` 挂一次（提供 toast/overlay 上下文），不要重复挂载。
- 明暗切换只用 `useColorMode()`，不要手写 class / localStorage。
