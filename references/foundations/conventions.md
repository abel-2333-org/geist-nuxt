# 工程惯例（Nuxt + Nuxt UI）

geist-nuxt starter 是一个 **Nuxt 4** 应用。下面是在其之上开发时必须遵守的约定与常见坑。

## 目录结构

```
app/
  app.vue                 # 根组件：<UApp> 包裹 <NuxtPage>，useHead 设 favicon/标题
  pages/                  # 文件路由：index.vue → /，about.vue → /about
  components/             # 自动导入的组件（pathPrefix: true：子目录名 = 场景 = 组件名前缀）
    GeistShowcase.vue     # 根目录（无场景）→ <GeistShowcase />
    pricing/Hero.vue      # → <PricingHero />（子目录 pricing 表场景，文件名精简不重复场景）
  composables/            # 自动导入的组合式函数（如有）
nuxt.config.ts            # extends ['@geist-nuxt/core'] + 模块（@nuxt/ui）
public/                   # 静态资源（favicon.svg 等），以 / 开头引用
```

Geist token 全局 CSS（`app/assets/css/main.css`）、语义别名（`app.config.ts`）、公共组件（`CopyButton`、`ThemeToggle`、`SplitPane`、`GeistShowcase`）与 composables（`useCopy`、`useSplitPane`）都由 **`@geist-nuxt/core` layer 提供**，项目里不需要也不应该有副本；需要覆盖 token 时在项目自建 CSS 覆盖（不放 `@layer`）。

## 自动导入（最容易踩的点）

- **Nuxt UI 组件**（`UButton`、`UCard`、`UModal`…）自动全局可用，**不要手写 `import`**。
- **你自己 `app/components/**` 下的组件**也自动导入。**约定用目录前缀**（`nuxt.config.ts` 里 `components: [{ path: '~/components', pathPrefix: true }]`，也是 Nuxt 默认）。规则与心智：
  - **组件名 = 子目录名 + 文件名**（PascalCase 拼接）。`app/components/pricing/Hero.vue` → `<PricingHero />`；`app/components/reference/Field.vue` → `<ReferenceField />`。
  - **子目录名 = 组件的使用场景**（`pricing`、`reference`、`gallery`、`showcase`…）；**文件名精简、不重复场景**（写 `pricing/Hero.vue` 而非 `pricing/PricingHero.vue`）。两者拼出的调用名自带场景上下文。
  - **根目录组件（无场景归属的公共件）保持裸名**：`app/components/GeistShowcase.vue` → `<GeistShowcase />`、`CopyButton.vue` → `<CopyButton />`。所以跨场景公共 API 放根目录，场景专属件放对应子目录。
  - **收益**：① 冲突安全——不同场景各自命名空间，`pricing/Hero` 与 `home/Hero` 天然不撞；② 调用点自描述——`<ReferenceField />` 一眼知归属，不像裸 `<Field />` 丢上下文。
  - **纪律**：子目录名会进入**每一个**调用名，所以**目录命名必须精确且简洁**——它是场景的公共前缀，含糊或冗长的目录名（如 `misc/`、`componentsForXxx/`）会污染所有调用名。
- **Vue API**（`ref`、`computed`、`reactive`、`watch`、`onMounted`…）和 **Nuxt 组合式函数**（`useColorMode`、`useHead`、`useRoute`、`useState`…）都自动导入，**不要手写 `import { ref } from 'vue'`**。
- 需要显式导入的：类型（`import type ...`）、第三方库、以及 `defineAppConfig`/`defineNuxtConfig`（宏，全局可用无需导入）。

## 组件写法

- 一律 `<script setup lang="ts">`。
- Props 用 `defineProps<{ ... }>()`（类型化）；事件用 `defineEmits<{ ... }>()`。
- 双向绑定优先 `defineModel<T>()`（Nuxt UI 表单组件全部支持 `v-model`）。
- SFC 顺序：`<script setup>` → `<template>`（starter 全部如此）。
- **文案处理：区分「用户内容」与「结构性标签」两类**（对齐 Nuxt UI 自身的 locale 模型——它内置 50+ 语言的结构标签，如 `alert.close`、`contentToc.title`、`table.noData`，同时用户内容一律走 props/slot）：
  - **用户内容**（数据、说明、真实的请求/响应体等）→ **永远** props/slot 传入，组件**绝不内置**。例：`<ResponseExample :scenarios="..." />`、富文本用 `<slot>`。
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

- **组件找不到 / 解析为空**：约定 `pathPrefix: true`，调用名 = 目录 + 文件（`pricing/Hero.vue` → `<PricingHero />`），不要用裸文件名（`<Hero />` 找不到）。根目录组件才是裸名（`<GeistShowcase />`）。若改了目录名，记得同步所有调用点（目录名是调用名的一部分）。
- **覆盖的 token 不生效**：多半是放进了 `@layer`，或选择器优先级不够。starter 用未分层的 `:root`/`.dark`，照抄即可。
- **深色模式颜色没变**：确认用的是语义 token 类（`bg-muted`、`text-muted`），而不是写死的 `bg-neutral-100`——后者不会随主题切换。
- **图标不显示**：图标名拼错，或对应 Iconify 集合没装。UI 图标用 `i-lucide-*`，品牌用 `i-simple-icons-*`；新集合要 `pnpm add @iconify-json/<collection>`。
- **在 `<script setup>` 里手动 import 了 `ref`/组件**：多余，且可能与自动导入冲突——删掉。

## 脚本

- `pnpm dev`、`pnpm build`、`pnpm generate`（静态）、`pnpm preview`、`pnpm typecheck`。
- 版本组合已锁定为官方推荐：Nuxt 4.4.x + `@nuxt/ui` 4.9 + vue-router 5 + `@vueuse/core` 14.3。改动依赖前先确认兼容。

## 源码参考

- 结构与接线：`starter/`（`app/app.vue`、`nuxt.config.ts`）；token/别名真源：`packages/core/`（`app/assets/css/main.css`、`app.config.ts`）
- 组件写法样例：`packages/core/app/components/`
