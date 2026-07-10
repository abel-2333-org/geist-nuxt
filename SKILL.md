---
name: geist-nuxt
description: geist-nuxt 是一套基于 Nuxt UI v4 (Vue) 的 Geist 风格设计系统，是本项目构建 UI 的唯一权威来源。在这个项目里创建或修改任何界面时都要使用它——页面、布局（落地页、仪表盘、文档、设置、表单）、导航、表格、反馈、覆盖层、主题与品牌。视觉参考 Vercel Geist（Geist Sans/Mono 字体、紫色主色、真中性灰、近黑深色表面、6px 圆角、大留白），组件方法论参考 Adobe Spectrum（anatomy → state model → accessibility 规格化），组件基座为 Nuxt UI (Vue，非 React)。触发词："geist-nuxt"、"Geist"、"Nuxt UI"，或本项目内任何创建/修改 UI 的请求。
metadata:
  v0.kind: design-system
---

# geist-nuxt 设计系统

geist-nuxt 是本项目 UI 的**唯一权威来源**。它把三层正交定位固化为一套可复用基座：

- **视觉/品牌 = Vercel Geist**：Geist Sans / Mono 字体、紫色 primary、真中性灰、近黑深色表面、6px 圆角、大留白。
- **组件方法论 = Adobe Spectrum**：每个组件按 anatomy → state model → accessibility 规范设计与评审，见 `references/method/component-spec-template.md`。
- **组件基座 = Nuxt UI v4 (Vue)**：所有组件来自公共 npm 包 `@nuxt/ui`，作为 Nuxt 模块（`modules: ['@nuxt/ui']`）接入。**不使用 React。**

## 起点：pnpm workspace（多包）

repo 已原地重构为 **pnpm workspace 单一真源**，成员见 `pnpm-workspace.yaml`（`packages/*`、`packages/kits/*`、`apps/*`、`starter`）。四块职责如下：

- **`packages/core`（`@geist-nuxt/core`）** = 公共基座 Nuxt layer：token/紫色 ramp/Geist 覆盖的全局 CSS（`packages/core/app/assets/css/main.css`）、跨场景公共组件（`CopyButton`、`SplitPane`、`ThemeToggle` 等）、公共 composables（`useCopy`、`useSplitPane`）。别的包 `extends: ['@geist-nuxt/core']` 即自动获得组件/CSS/composables。
- **`packages/kits/<场景>`（如 `@geist-nuxt/kit-api-docs`）** = 场景增量组件，依赖 core（`"@geist-nuxt/core": "workspace:*"`），各带 `registry.json` 分片。做别的项目时忽略。
- **`apps/gallery`（`@geist-nuxt/gallery`）** = 聚合画廊，独立 Nuxt app，`extends` core + 各 kit，展示页（`app/pages/index.vue` + `AppHeader.vue` + `sections/*`）都在这里。**这是 v0 预览默认跑的包。**
- **`starter`** = 干净脚手架，只 `extends` core、**不含**任何 kit 组件。消费项目从这里起步：在 `starter/app/pages/` 加路由、`starter/app/components/` 加组件，需要某场景时再把对应 kit 装进来。

整套已验证（Nuxt 4.4.x + `@nuxt/ui` 4.9 + vue-router 5，根目录 `pnpm -r typecheck` / `pnpm -r build` 均通过）。provider（各 app 的 `app/app.vue` 里的 `UApp`）、全局 CSS、字体、明暗切换都已在 core layer 接好。**在此基础上开发，不要重建脚手架。**

- **组件自动导入**：Nuxt UI 组件（`UButton`、`UCard`、`UInput` 等）与 core/kit/app 各自 `app/components/**` 下的组件都由 Nuxt 自动导入，模板里直接用，无需手写 import。默认关闭目录前缀（`components: [{ path: '~/components', pathPrefix: false }]`），所以 `CodeBlock.vue` 的模板名就是 `<CodeBlock>`——保持文件 basename 唯一即可。layer 下自动导入同样成立。
- **明暗模式**由 Nuxt UI 内置的 `@nuxtjs/color-mode`（模块自动注册）管理，组合式 API 用 `useColorMode()`；见 `packages/core/app/components/ThemeToggle.vue`。`colorMode.preference: 'system'`。
- **字体**由 `@nuxt/fonts`（Nuxt UI 自动注册）按名解析 `Geist` / `Geist Mono` 并自托管，无需手写 `<link>` 或 `@font-face`。
- **图标**用 Iconify：`i-lucide-*`（UI 图标）、`i-simple-icons-*`（品牌）。新增图标集合需 `pnpm add @iconify-json/<collection>`。

## 硬规则

- **只用 Nuxt UI 组件 + 语义 token**，不要手写等价组件，不要用原始 CSS 颜色值（用 `--ui-*` token 或 Tailwind 语义类如 `text-muted`、`bg-elevated`、`border-default`）。
- **primary 是紫色 ramp**，定义在 `packages/core/app/assets/css/main.css`（完整 50–950），`--ui-primary` 浅色用 500、深色用 400。不要改成别的语义机制。
- **响应式用 Nuxt UI 的方式**：`UContainer`、`UPage*` 布局原语 + Tailwind 断点（sm/md/lg/xl/2xl），不要写固定宽度或临时 media query。见 `references/foundations/responsiveness.md`。
- **新增组件先走「新增组件工作流」**（见下节）：唯一硬前置是「先确认 Nuxt UI / 现有组件没有现成的」；规格模板按组件复杂度分级使用，不是每个组件都要写满三张表。
- **层级用色调表面 + 边框优先，阴影克制**：卡片 `shadow-xs`、浮层 `shadow-lg`、模态 `shadow-xl`（已在 token 里对齐 Geist 三层）。动效只在澄清变化时用、并尊重 `prefers-reduced-motion`（starter 已全局处理）。见 `references/foundations/elevation-motion.md`。
- **无障碍是硬要求**：交互元素一律 `:focus-visible` 显示 focus 环，绝不 `outline:none` 不给替代；正文对比度 WCAG AA；不要只用颜色表达状态（配图标/文字）；纯图标按钮加 `aria-label`；表单用 `UFormField`。见 `references/foundations/focus-a11y.md`。
- **文案遵循 Geist Voice**：标签/按钮/标题用 Title Case，正文/toast 用 sentence case；动作用"动词+名词"（不用 `OK`/`Confirm`）；toast 不带句号、不说 "successfully"；错误写"发生了什么+怎么办"。见 `references/foundations/voice-content.md`。
- 用系统资源，不要用占位图；logo/favicon 见 `references/brand-assets.md`。
- 不要臆造不存在的 props / variants / token 名——以 references 与 Nuxt UI 源码为准。

## 新增组件工作流

要造一个新组件时，按下面走——**目的是用对方法，不是套流程**，请按组件复杂度决定投入，别为一个纯展示原子写满三张规格表。

1. **先查有没有现成的（唯一硬前置，几乎零成本，不许跳过）**：翻 `references/components/index.md` 的决策表和 Nuxt UI 原语。大多数「新组件」其实是**用现有原语组合**（`UCard` + `UBadge` + `UButton` 拼业务块），或现成原语本身就够（要「状态标记」→ 就是 `UBadge`）。确认无现成、也无法简单组合，才真的进入「造新组件」。

2. **按复杂度决定要不要写规格**（`references/method/component-spec-template.md`）：
   - **有交互 / 状态 / 焦点管理的组件**（可展开、可复制、可切换、带校验等，如 `CodeBlock`、`CopyButton`）→ **走全套**：anatomy → state model → accessibility 三张表都过一遍再实现。这是 geist-nuxt 方法论的核��价值所在。
   - **纯展示 / 无状态的原子**（只映射 token 的标记、容器）→ **轻量**：口头过一遍 anatomy 与 a11y 要点即可，不必产出三张完整表。
   - 拿不准就往「全套」靠——规格便宜，返工贵。

3. **实现**：`<script setup lang="ts">`，只用 `@nuxt/ui` 原语 + 语义 token 拼装，守住上面的硬规则（focus 环、aria-label、`UFormField`、无固定宽度）。注意自动导入的子目录前缀（见 `conventions.md`）。**组件文案要「无关化」——通过 props/slot 传入，不硬编码字符串**（多语言接线见下方 i18n 说明）。

4. **验证**：在 starter 里跑起来，明暗两种模式 + 移动到宽屏都过一遍。

5. **归类**：任何项目都可能用的通用组件 → 进 `components/` 分组；只服务特定场景（如 API 文档）→ 沉淀到对应 `kits/<场景>/`，别塞进通用基座。

> **多语言（i18n）**：组件本身保持文案无关（props/slot 传��本）；`@nuxtjs/i18n` 的接线、locale 组织、`$t` key 属于**消费项目**职责，不进基座。API 文档场景的接线见 `references/kits/api-docs/project-setup.md`。

## 路由（按任务读取 references）

- **Token / 主题 / 颜色 / 圆角**：`references/foundations/tokens.md`
- **排版 / 字阶 / Geist Sans·Mono**：`references/foundations/typography.md`
- **间距 / 留白 / 容器 / 布局节奏**：`references/foundations/spacing-layout.md`
- **响应式 / 断点 / 布局原语**：`references/foundations/responsiveness.md`
- **阴影 / 层级 / 动效（easing·时长·reduced-motion）**：`references/foundations/elevation-motion.md`
- **focus / 键盘 / 无障碍（对比度、focus 环规格）**：`references/foundations/focus-a11y.md`
- **文案规范（大小写、按钮、错误、toast、空态）**：`references/foundations/voice-content.md`
- **工程惯例（自动导入、命名、Nuxt 目录、常见坑）**：`references/foundations/conventions.md`
- **组件选择决策 + 组件总览与分组索引**：`references/components/index.md`
  - 按钮：`components/buttons.md`｜表单：`components/forms.md`｜反馈：`components/feedback.md`
  - 数据展示：`components/data-display.md`｜导航：`components/navigation.md`｜覆盖层：`components/overlays.md`
- **整屏装配（页面外壳、区块、卡片网格、表单、空/加载态、a11y 清单，含完整外壳示例）**：`references/compositions.md`
- **资源（logo/favicon/图标）**：`references/brand-assets.md`
- **方法论（造新组件时才读，低频）**：
  - 组件规格模板（设计评审标准）：`references/method/component-spec-template.md`
  - 规格落地范例：`references/method/spec-example.md`
- **领域包 kits（仅当项目属于该场景时加载）**：
  - API 文档场景（CodeBlock / RequestExample / ResponseExample）：`references/kits/api-docs/index.md`
    - 该场景的项目配置（推荐模块、i18n 接线、@nuxt/content 取舍）：`references/kits/api-docs/project-setup.md`
- **维护（仅维护本 skill 时读，非使用者内容）**：改动本 skill 后如何对账同步到 GitHub 真源 `Abel-Wang777/geist-nuxt`：`references/maintenance/sync.md`

### 分层与加载策略

- **通用层（任何 UI 项目必读）**：`foundations/` + `components/` + `compositions.md`。这是 Geist 观感 + Nuxt UI 原语 + 整屏装配，对所有项目生效。
- **方法论层（低频）**：`method/`，仅在需要新造领域组件时读；只放规格模板 + 范例两份，不放具体组件。
- **领域包层（按需）**：`kits/<场景>/`，只有当项目是该场景（如 API 文档）时才加载，并把对应 `packages/kits/<场景>/` 作为依赖 `extends` 进消费应用。做别的项目时忽略。
- **需要新领域组件时**：用 `method/` 的规格模板现造，沉淀到对应 `kits/`。

## 最终检查

- 组件全部来自 Nuxt UI，颜色/间距全部走 token。
- 明暗两种模式都验证过（starter 右上角有切换）。
- 布局在移动到宽屏都成立（用 `UContainer` / 断点）。
- 新组件已过一遍规格模板。
