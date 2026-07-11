# 整屏装配（Compositions）

把通用组件拼成一整屏页面的成品级装配指南：页面外壳、内容区块、卡片网格、表单、空状态、加载/反馈，以及每屏无障碍自检。这些只用核心 Nuxt UI 组件 + Geist token 组合而成，与是否有领域组件无关。目标是让整页在 Geist 视觉语言下保持一致：大留白、高对比、克制边框。

> 想造「新的领域组件」（不是拼页面）看 `method/`；想查「单个组件用法」看 `components/`。本文件只讲**整屏怎么拼**。

## 页面外壳（App shell）

标准结构：粘顶 header + 主内容区 + 可选 footer。完整可运行版本见本文件末尾「完整外壳示例」。

```vue
<!-- app/app.vue 已提供 <UApp> 与 <NuxtPage>；页面只写内容 -->
<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader />                          <!-- 粘顶导航 + 主题切换 -->
    <main class="flex-1">
      <PricingSection />
      <UContainer class="py-14 sm:py-20 space-y-20">
        <!-- 各内容区块 -->
      </UContainer>
    </main>
    <AppFooter />
  </div>
</template>
```

- **header 粘顶**：`sticky top-0 z-50` + `border-b border-default` + 半透明背景 `bg-default/80 backdrop-blur`（见 `AppHeader.vue`）。
- **主题切换**放 header 右侧，用 `ThemeToggle`（`useColorMode`）。
- **logo/wordmark**用真实资源（见 `brand-assets.md`），不要占位图。

## 内容区块（Section）

一致的区块骨架：容器 + 大纵向留白 + 标题簇 + 内容。

```vue
<UContainer class="py-14 sm:py-20">
  <div class="space-y-10">
    <div class="space-y-2">
      <p class="text-sm font-medium uppercase tracking-wide text-muted">分组标签</p>
      <h2 class="text-2xl font-semibold tracking-tight text-highlighted">区块标题</h2>
      <p class="text-muted max-w-2xl">一句话说明。</p>
    </div>
    <!-- 内容 -->
  </div>
</UContainer>
```

## 卡片网格

```vue
<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
  <UCard v-for="item in items" :key="item.id">
    <template #header>
      <h3 class="text-lg font-medium text-highlighted">{{ item.title }}</h3>
    </template>
    <p class="text-muted text-sm">{{ item.desc }}</p>
    <template #footer>
      <UButton variant="ghost" trailing-icon="i-lucide-arrow-right">了解更多</UButton>
    </template>
  </UCard>
</div>
```

- 卡片靠 `border border-default` + `rounded-lg` 定义，而非阴影。
- 列数用响应式（1 → 2 → 3），`gap-6` 保持呼吸感。

## 表单

- 用 `UForm` + `UFormField` 包裹每个字段，`UFormField` 提供 label / 帮助文本 / 错误信息的正确关联（a11y）。
- 校验绑 schema（`UForm` 的 `:schema`），提交用 `@submit`。
- 按钮：主操作 `color="primary"`，次操作 `color="neutral" variant="outline"`；加载态用 `:loading`。
- 详见 `components/forms.md`。

## 空状态（Empty state）

居中图标 + 标题 + 说明 + 主操作：

```vue
<div class="flex flex-col items-center justify-center gap-3 py-16 text-center">
  <UIcon name="i-lucide-inbox" class="size-10 text-dimmed" />
  <h3 class="text-lg font-medium text-highlighted">还没有内容</h3>
  <p class="text-muted text-sm max-w-sm">创建第一条记录后会显示在这里。</p>
  <UButton class="mt-2" icon="i-lucide-plus">新建</UButton>
</div>
```

## 加载态

- 骨架屏用 `USkeleton`（占位块），匹配最终内容的尺寸与圆角。
- 内联/按钮加载用组件的 `:loading` prop。
- 页面级异步：Nuxt 的 `<NuxtLoadingIndicator />` 或区块级 `USkeleton` 网格。
- 详见 `components/feedback.md`。

## 反馈（Toast / Alert）

- 瞬时反馈用 toast：`const toast = useToast(); toast.add({ title, color })`（需要 `app.vue` 里有 `<UApp>`，starter 已具备）。
- 常驻上下文提示用 `UAlert`（`color` 表意：`success`/`warning`/`error`/`info`）。

## 无障碍清单（每屏自检）

- [ ] 每个页面有唯一 `<h1>`，标题层级不跳级。
- [ ] 交互元素可键盘聚焦，聚焦环可见（Nuxt UI 默认提供，不要 `outline-none` 去掉）。
- [ ] 图标按钮有 `aria-label`（见 `ThemeToggle` 的 label）。
- [ ] 表单字段用 `UFormField` 关联 label / 错误信息。
- [ ] 颜色不作为唯一信息载体（状态同时用图标/文字）。
- [ ] 明暗两套都验证对比度（Geist 灰阶已按明暗分别调过，用语义 token 即可继承）。
- [ ] 图片有 `alt`；装饰性图标 `aria-hidden`。

## 不要做

- 不要用重阴影或大圆角堆视觉；靠留白 + 细边框 + 浅表面。
- 不要写死颜色/宽度/间距；用语义 token、`UContainer`、4px scale。
- 不要跳过 `UFormField`/`aria-label` 等 a11y 关联。

---

# 完整外壳示例

已验证的应用外壳（Nuxt 4）。展示：`UApp` 根容器、sticky 头部、logo(favicon) + wordmark、导航按钮、明暗切换、`--ui-container` 约束的主体。全部组件由 Nuxt UI 自动导入，无需手写 `import`。源码：`starter/app/app.vue`（根组件）、`apps/gallery/app/components/AppHeader.vue`（头部）、`packages/core/app/components/ThemeToggle.vue`（core 提供，项目里直接 `<ThemeToggle />`）。

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

用 Nuxt UI 内置的 `@nuxtjs/color-mode`（随 `@nuxt/ui` 模块自动注册），通过 `useColorMode()` 读写偏好——不要自己写 class 切换或 localStorage 逻辑。`useColorMode` / `computed` 都由 Nuxt 自动导入��用 `<ClientOnly>` 包裹以避免 SSR 水合闪烁。

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
