# 整页骨架（Page shell）

把一整屏页面搭起来的成品级外壳：根组件（`UApp`）、粘顶 header、主题切换、`--ui-container` 约束的主体。都只用核心 Nuxt UI 组件 + Geist token，全部由 Nuxt 自动导入，无需手写 `import`。

> 想拼**页面内的一块**（区块/卡片网格/表单/空态/反馈）看同目录 `patterns.md`；想查「单个组件用法」看 `components/`。本文件只讲**整页外壳怎么搭**。

## 一套外壳：Geist 顶栏

geist-nuxt 用**单一顶栏外壳**（`<CompositionAppHeader>`）：粘顶 header 放导航与全局动作，下面接一个 `--ui-container` 约束的主体。**header 与页面内容共用同一个 `UContainer` 宽度**，因此 brand 左缘与内容左缘对齐、动作右缘与内容右缘对齐——一列居中的 Geist 版式，不会出现「header 缩在中间、内容铺满」的错位。

> **不用文档站那种左侧 sidebar 外壳**：对少量顶级区段而言，侧栏又重又像模板。深层级导航不靠侧栏解决，而是靠下面「导航深度」一节的下拉分组。

## 导航深度：横向两层上限怎么破

Nuxt UI 的**横向** `UNavigationMenu` 渲染器只吃两层（触发器 → 一层子项；孙级 children 被丢弃，`content-orientation` 只切换那一层子项的排布方向、不加深度）。所以有真实层级时：

- **桌面**：顶级项内联平铺；更深的分组（如「多个 kit，每个 kit 又有多页」）收进一个**分组 `UDropdownMenu`**——items 用嵌套数组 `T[][]` + `type: 'label'` 起每组标题，组间自动分隔。加再多组也清爽，且全是原生能力。
- **移动端**：`#body` slideover 用**竖向** `UNavigationMenu`，children 原生渲染为 accordion、`type:'label'` 渲染为分组标题，**层级不限深**——直接喂完整导航树即可。

也就是说：一份路由数据派生出三个视图（顶级链接、分组、完整树），桌面用前两者、移动端用第三者。gallery 的 `useGalleryNav()` 就返回 `{ primary, kits, tree }` 三视图（`apps/gallery/app/composables/useGalleryNav.ts`）。

## 结构总览

标准结构：`UApp` 根 → 粘顶 header + 主内容区 + 可选 footer。用 Nuxt `layouts/default.vue` 承载外壳，`pages/**` 只写内容（各页自带 `UContainer`，与 header 同宽对齐）。

```vue
<!-- app/layouts/default.vue —— 外壳；app.vue 里 <NuxtLayout><NuxtPage/></NuxtLayout> -->
<script setup lang="ts">
const nav = useGalleryNav() // { primary, kits, tree }
</script>
<template>
  <div class="min-h-screen flex flex-col bg-default text-default antialiased">
    <CompositionAppHeader :items="nav.tree">   <!-- items 供移动端竖向菜单兜底 -->
      <template #brand>…</template>            <!-- logo/wordmark -->
      <template #nav>                          <!-- 桌面导航：顶级链接 + 分组下拉 -->
        <GalleryHeaderNav :primary="nav.primary" :kits="nav.kits" />
      </template>
      <template #actions>…<ThemeToggle /></template>
    </CompositionAppHeader>
    <main class="flex-1"><slot /></main>       <!-- 各页自带 UContainer -->
    <footer class="border-t border-default">…</footer>
  </div>
</template>
```

- **粘顶 header 用 core 的 `<CompositionAppHeader>`**（下详），移动端抽屉、断点、汉堡都内建，不手写。
- **主题切换**默认已内置在 `#actions`；覆盖该 slot 时需自己带上 `<ThemeToggle />`。
- **logo/wordmark**用真实资源（见 `brand-assets.md`），不要占位图。

已验证的应用外壳（Nuxt 4）源码：`starter/app/app.vue`（根组件）、`apps/gallery/app/layouts/default.vue`（外壳装配活样例）、`packages/core/app/components/composition/AppHeader.vue`（core 顶栏）、`apps/gallery/app/components/gallery/HeaderNav.vue`（桌面导航：顶级链接 + 分组 Kits 下拉）、`packages/core/app/components/ThemeToggle.vue`（core 提供，直接 `<ThemeToggle />`）。

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

粘顶 + 响应式头部是 core 的 composition（`packages/core/app/components/composition/AppHeader.vue`），基于 Nuxt UI `UHeader mode="slideover"`：**桌面横排导航、移动端汉堡 + slideover 抽屉、断点 `lg`、路由变化自动收起、与内容同宽的容器**——全部内建，不手写 `<header>`、不手写 media query。它**场景无关**（分组逻辑留给消费方，不写死在 core）：

- **prop `items: NavigationMenuItem[]`** —— 兜底导航数据；`#nav`/`#body` 未覆盖时，桌面渲染横向菜单、移动端渲染竖向菜单。
- **slot `#brand`** —— logo / wordmark / badge，默认给 geist-nuxt 兜底，可完全覆盖。
- **slot `#nav`** —— **桌面中部导航**；默认是 `items` 的横向菜单，需要顶级链接 + 分组下拉时在这里注入消费方组件（如 gallery 的 `<GalleryHeaderNav>`）。
- **slot `#actions`** —— 右侧动作区，**默认内置 `<ThemeToggle />`**；覆盖后需自己带上。
- **slot `#body`** —— **移动端 slideover 导航**；默认是 `items` 的竖向菜单（支持完整层级），一般传完整导航树即可。

active 高亮：横向/竖向 `UNavigationMenu` 都按 `to` 与当前路由**自动高亮**（`variant="link"` + `highlight` + `highlight-color="primary"` 给出 Geist 紫色指示条）；自定义的下拉触发器需自己按 `route.path` 判活（见 `HeaderNav.vue`）。

```vue
<!-- 消费方桌面导航：顶级链接（横向菜单）+ 分组下拉（UDropdownMenu, T[][]） -->
<script setup lang="ts">
const props = defineProps<{ primary: NavigationMenuItem[]; kits: KitGroup[] }>()
const route = useRoute()
const kitsActive = computed(() => route.path.startsWith('/kits'))
const kitMenu = computed<DropdownMenuItem[][]>(() =>
  props.kits.map((kit) => [
    { label: kit.label, type: 'label' },
    ...kit.pages.map((p) => ({ label: p.label, icon: p.icon, to: p.to })),
  ]),
)
</script>
<template>
  <div class="flex items-center gap-1">
    <UNavigationMenu :items="primary" variant="link" color="primary" highlight highlight-color="primary" />
    <UDropdownMenu v-if="kits.length" :items="kitMenu">
      <UButton label="Kits" trailing-icon="i-lucide-chevron-down" color="neutral" variant="ghost"
        :class="kitsActive ? 'text-highlighted' : 'text-muted hover:text-highlighted'" />
    </UDropdownMenu>
  </div>
</template>
```

## 要点

- 头部观感（`bg-default/75 backdrop-blur`、`border-b border-default`、`sticky top-0`、`h-(--ui-header-height)`、内建 `UContainer`）由 `UHeader` 主题提供，不要另写；页面内容也用 `UContainer`，二者同宽即对齐。
- 图标按钮都带 `aria-label`；logo 图片 `alt=""`（旁边有文字）。
- `UApp` 只在 `app/app.vue` 挂一次（提供 toast/overlay 上下文），不要重复挂载。
- 明暗切换只用 `useColorMode()`（封装在 `ThemeToggle`），不要手写 class / localStorage。
- 导航深了别加侧栏：桌面用分组 `UDropdownMenu`，移动端用竖向菜单的 accordion。
