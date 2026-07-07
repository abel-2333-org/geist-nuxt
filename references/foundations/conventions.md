# 工程惯例（Nuxt + Nuxt UI）

geist-nuxt starter 是一个 **Nuxt 4** 应用。下面是在其之上开发时必须遵守的约定与常见坑。

## 目录结构

```
app/
  app.vue                 # 根组件：<UApp> 包裹 <NuxtPage>，useHead 设 favicon/标题
  pages/                  # 文件路由：index.vue → /，about.vue → /about
  components/             # 自动导入的组件（含子目录前缀）
    AppHeader.vue         # → <AppHeader />
    ThemeToggle.vue       # → <ThemeToggle />
    sections/HeroSection.vue  # → <SectionsHeroSection />
  assets/css/main.css     # Geist token 覆盖（全局 CSS）
  composables/            # 自动导入的组合式函数（如有）
nuxt.config.ts            # 模块（@nuxt/ui）、CSS、colorMode 配置
app.config.ts             # 运行时 UI 配置：ui.colors 语义别名
public/                   # 静态资源（favicon.svg 等），以 / 开头引用
```

## 自动导入（最容易踩的点）

- **Nuxt UI 组件**（`UButton`、`UCard`、`UModal`…）自动全局可用，**不要手写 `import`**。
- **你自己 `app/components/**` 下的组件**也自动导入。**子目录名会作为前缀**：`app/components/sections/HeroSection.vue` 在模板里是 `<SectionsHeroSection />`，不是 `<HeroSection />`。
- **Vue API**（`ref`、`computed`、`reactive`、`watch`、`onMounted`…）和 **Nuxt 组合式函数**（`useColorMode`、`useHead`、`useRoute`、`useState`…）都自动导入，**不要手写 `import { ref } from 'vue'`**。
- 需要显式导入的：类型（`import type ...`）、第三方库、以及 `defineAppConfig`/`defineNuxtConfig`（宏，全局可用无需导入）。

## 组件写法

- 一律 `<script setup lang="ts">`。
- Props 用 `defineProps<{ ... }>()`（类型化）；事件用 `defineEmits<{ ... }>()`。
- 双向绑定优先 `defineModel<T>()`（Nuxt UI 表单组件全部支持 `v-model`）。
- SFC 顺序：`<script setup>` → `<template>`（starter 全部如此）。
- **文案处理：区分「用户内容」与「结构性标签」两类**（对齐 Nuxt UI 自身的 locale 模型——它内置 50+ 语言的结构标签，如 `alert.close`、`contentToc.title`、`table.noData`，同时用户内容一律走 props/slot）：
  - **用户内容**（数据、说明、真实的请求/响应体等）→ **永远** props/slot 传入，组件**绝不内置**。例：`<ApiResponseExample :scenarios="..." />`、富文本用 `<slot>`。
  - **结构性标签 / chrome**（组件骨架里固定的非内容文字，如 `Request`/`Response`、区块标题、`Show more`、复制按钮提示）→ **内置合理默认值，并暴露 label prop 可覆盖**。例：`defineProps<{ requestLabel?: string }>()` 默认 `'Request'`。单语言项目零负担；i18n 项目通过覆盖注入 `$t(...)`。
  - **反模式**：① 把结构标签硬编码到无法覆盖（i18n 时改不了）；② 强迫调用方每次都传结构标签（过度设计，单语言项目付 i18n 税）。正确姿势是 **给默认、留出口**。
  - **i18n 机制属消费项目**：装 `@nuxtjs/i18n`、用 `$t('...')` key、组织 locale 文件都在项目侧完成，基座 starter 不含 i18n。API 文档场景的具体接线见 `references/kits/api-docs/project-setup.md`。
  - 文案本身仍遵守 Geist Voice（大小写、按钮措辞等，见 `voice-content.md`）——每种语言各自遵守。

## 主题与颜色

- **改语义别名** → `app.config.ts` 的 `ui.colors`（如把 `secondary` 换成别的 Tailwind 调色板）。
- **改具体颜色值 / token** → `app/assets/css/main.css`（紫色 ramp、Geist 灰阶、圆角、字体）。覆盖**不要放进 `@layer`**，否则会被 Nuxt UI 的 `@layer theme` 默认值盖过。
- **明暗模式**：只用 `useColorMode()`，不要手动切 `<html>` 的 class。`nuxt.config.ts` 里 `colorMode.preference: 'system'`、`fallback: 'light'`。
- 组件配色用 `color`/`variant` prop（`color="primary"`、`variant="outline"`），不要写死 CSS 颜色。

## 常见坑

- **`<SectionsHeroSection />` 找不到组件**：子目录前缀没加对。检查文件所在目录。
- **覆盖的 token 不生效**：多半是放进了 `@layer`，或选择器优先级不够。starter 用未分层的 `:root`/`.dark`，照抄即可。
- **深色模式颜色没变**：确认用的是语义 token 类（`bg-muted`、`text-muted`），而不是写死的 `bg-neutral-100`——后者不会随主题切换。
- **图标不显示**：图标名拼错，或对应 Iconify 集合没装。UI 图标用 `i-lucide-*`，品牌用 `i-simple-icons-*`；新集合要 `pnpm add @iconify-json/<collection>`。
- **在 `<script setup>` 里手动 import 了 `ref`/组件**：多余，且可能与自动导入冲突——删掉。

## 脚本

- `pnpm dev`、`pnpm build`、`pnpm generate`（静态）、`pnpm preview`、`pnpm typecheck`。
- 版本组合已锁定为官方推荐：Nuxt 4.4.x + `@nuxt/ui` 4.9 + vue-router 5。改动依赖前先确认兼容。

## 源码参考

- 结构与接线：`assets/starter/`（`app/app.vue`、`nuxt.config.ts`、`app.config.ts`）
- 组件写法样例：`assets/starter/app/components/`
