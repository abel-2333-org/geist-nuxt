# 整页骨架（Page shell）

把一整屏页面搭起来的成品级外壳：根组件（`UApp`）、导航外壳、主题切换、主体内容区。都只用核心 Nuxt UI 组件 + Geist token，全部由 Nuxt 自动导入，无需手写 `import`。

> 想拼**页面内的一块**（区块/卡片网格/表单/空态/反馈）看同目录 `patterns.md`；想查「单个组件用法」看 `components/`。本文件只讲**整页外壳怎么搭**。

## 两种外壳，按导航体量选

core 提供两个并列的外壳 composition，**按站点的导航体量选**：

| 外壳 | 导航布局 | 适用 |
|---|---|---|
| `<CompositionAppShell>`（侧栏，**多区站点默认**） | 左侧常驻 sidebar：brand → 分组竖向导航 → 底部动作区；移动端收进 slideover | 多个顶级区段 + 多页 kit（gallery 本身即用此） |
| `<CompositionAppHeader>`（顶栏） | 粘顶 header 横排导航 + 全局动作 | 扁平站点：落地页、少量顶级页 |

两者都**只用 Nuxt UI 原语 + Geist token**，共享同一份 `NavigationMenuItem[]` 数据源，可直接互换。下面以 gallery 采用的**侧栏外壳**为主线。

## 导航深度：竖向菜单原生解决

侧栏用**竖向** `UNavigationMenu`——`children` 原生渲染为 accordion、`type: 'label'` 渲染为分组标题，**层级不限深**。所以有真实层级（如「多个 kit，每个 kit 又有多页」）时，直接喂一棵完整导航树即可，不需要任何下拉或 hack：

- 顶级项（Overview / Components / …）平铺在最上；
- 一个 `{ type: 'label' }` 项起「Kits」区段标题；
- 每个 kit：单页 → 一条链接；多页 → 一个 `children` accordion（`defaultOpen: true` 让当前区段默认展开）。

移动端（`< lg`）sidebar 隐藏，同一棵树落进顶栏 `UHeader mode="slideover"` 的抽屉里，竖向菜单照样展开完整层级。一份路由数据派生出这一棵树即可，桌面/移动共用——gallery 的 `useGalleryNav()` 就返回这棵 `NavigationMenuItem[]`（`apps/gallery/app/composables/useGalleryNav.ts`）。

> 顶栏外壳（`AppHeader`）遇到深层级时才需要变通：Nuxt UI 的**横向** `UNavigationMenu` 只吃两层（孙级 children 被丢弃），届时把分组收进一个 `UDropdownMenu`（`items` 用嵌套数组 `T[][]` + `type:'label'` 起每组标题）。这是顶栏的专属考量，侧栏没有这个限制。

## 结构总览

标准结构：`UApp` 根 → 侧栏外壳（sidebar + 内容列）。用 Nuxt `layouts/default.vue` 承载外壳，`pages/**` 只写内容（各页自带 `UContainer`）。

```vue
<!-- app/layouts/default.vue —— 外壳；app.vue 里 <NuxtLayout><NuxtPage/></NuxtLayout> -->
<script setup lang="ts">
const nav = useGalleryNav() // 一棵 NavigationMenuItem[]：顶级项 + Kits 分组 + kit accordion
</script>
<template>
  <CompositionAppShell :items="nav">
    <template #brand>…</template>              <!-- logo / wordmark -->
    <template #actions>…<ThemeToggle /></template>  <!-- 底部动作区（桌面）/ 顶栏右侧（移动） -->
    <slot />                                    <!-- 页面内容，各页自带 UContainer -->
    <template #footer>…</template>              <!-- 可选：内容列下方页脚 -->
  </CompositionAppShell>
</template>
```

- **侧栏 + 移动 slideover、断点 `lg`、路由变化自动收起**全部由 `<CompositionAppShell>` 内建，不手写 `<aside>`、不手写 media query。
- **主题切换**放在 `#actions`；该 slot 覆盖后需自己带上 `<ThemeToggle />`。
- **logo/wordmark** 用真实资源（见 `brand-assets.md`），不要占位图；窄侧栏里 wordmark 加 `whitespace-nowrap`、图标 `shrink-0`，别塞装饰性 badge。

已验证的应用外壳（Nuxt 4）源码：`starter/app/app.vue`（根组件）、`apps/gallery/app/layouts/default.vue`（侧栏外壳装配活样例）、`packages/core/app/components/composition/AppShell.vue`（侧栏外壳）、`packages/core/app/components/composition/AppHeader.vue`（顶栏外壳）、`packages/core/app/components/ThemeToggle.vue`（core 提供，直接 `<ThemeToggle />`）。

## 侧栏外壳（`<CompositionAppShell>`，core 提供）

`packages/core/app/components/composition/AppShell.vue`。桌面是一条常驻左侧栏（`fixed inset-y-0 w-64`，`bg-elevated/40` + 右侧 hairline），内容列用 `lg:pl-64` 让位；`< lg` 时 sidebar 隐藏、导航收进顶部 `UHeader mode="slideover"` 抽屉。**场景无关**（分组/文案留给消费方）：

- **prop `items: NavigationMenuItem[]`** —— 导航树，桌面侧栏与移动抽屉共用同一份，竖向渲染，层级不限深。
- **slot `#brand`** —— sidebar 顶部与移动 bar 的 logo / wordmark 区。
- **slot `#actions`** —— sidebar 底部动作区（主题切换、外链等），桌面固定在底、移动落在顶栏右侧。
- **默认 slot** —— 页面内容（进内容列）。
- **slot `#footer`** —— 可选，内容列下方页脚。

active 高亮：竖向 `UNavigationMenu` 按 `to` 与当前路由**自动高亮**（`color="primary"` + `highlight` + `highlight-color="primary"` 给出 Geist 紫色指示条），无需手写 active 逻辑。sidebar 三段式结构（brand `h-16` + 可滚动 `nav` + 底部 `actions`）已在组件内定好，消费方只填 slot。

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

## 顶栏外壳（`<CompositionAppHeader>`，core 提供）

扁平站点用它替代侧栏（`packages/core/app/components/composition/AppHeader.vue`），基于 `UHeader mode="slideover"`：桌面横排导航、移动端汉堡 + slideover 抽屉、断点 `lg`、路由自动收起、与内容同宽的内建容器。slot 对齐 `AppShell`：`#brand` / `#actions`（默认内置 `ThemeToggle`）/ `#nav`（桌面中部导航，默认 `items` 横向菜单）/ `#body`（移动竖向菜单）。深层级时按上文「导航深度」把分组收进 `UDropdownMenu`。

## 要点

- 外壳观感（sidebar 的 `bg-elevated/40` + `border-r`、header 的 `backdrop-blur` + `sticky`、`--ui-header-height`）由组件与 `UHeader`/token 提供，不要另写。
- 图标按钮都带 `aria-label`；logo 图片 `alt=""`（旁边有文字）。
- `UApp` 只在 `app/app.vue` 挂一次（提供 toast/overlay 上下文），不要重复挂载。
- 明暗切换只用 `useColorMode()`（封装在 `ThemeToggle`），不要手写 class / localStorage。
- 多区站点默认侧栏（`AppShell`），竖向菜单原生撑起任意层级；扁平站点才用顶栏（`AppHeader`）。
