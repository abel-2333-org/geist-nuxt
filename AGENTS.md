# AGENTS.md — geist-nuxt 设计系统

> 本文件是 **Codex / 通用 agent** 的入口,只是**指针**——正文全部在 `references/**`,
> 按需打开对应文件,不要凭记忆臆造组件、token 或 API。
> 目录结构与架构决策只写在 `references/architecture-decisions.md`,本文件不复述。

## 权威来源

构建**任何 UI**(页面、布局、表单、导航、反馈、覆盖层、主题)时,
**geist-nuxt 是唯一权威的设计系统来源**。视觉参考 Vercel Geist,
组件基座为 Nuxt UI v4(Vue,**不用 React**),方法论参考 Adobe Spectrum。
基座以 npm 公共包 **`@geist-nuxt/core`**(Nuxt layer)分发,项目 `extends: ['@geist-nuxt/core']` 获得全部。

## 路由(用到哪个读哪个)

- **契约与总规则**:`SKILL.md`
- **基础地基(必读)**:`references/foundations/`
  - `tokens.md`|`typography.md`|`spacing-layout.md`|`responsiveness.md`
  - `elevation-motion.md`|`focus-a11y.md`|`conventions.md`|`voice-content.md`
- **通用组件(任务域分组 + 官方名映射)**:`references/components/index.md`
  - `buttons.md`|`forms.md`|`feedback.md`|`data-display.md`|`navigation.md`|`overlays.md`
- **整屏装配(页面外壳、卡片网格、空/加载态、a11y 清单)**:`references/compositions.md`
- **品牌资源(logo/favicon/图标)**:`references/brand-assets.md`
- **方法论(造新组件时才读)**:`references/method/component-spec-template.md`、`references/method/spec-example.md`
- **领域包(仅当项目属于该场景时加载)**:`references/kits/api-docs/index.md`
  - 组件源码在真源 `packages/kits/api-docs/`;使用时按该 kit 的 `registry.json` **整切片 copy-in**
    (条目 `files` 里的组件 + composables 一起拷进项目 `app/`)

## 硬规则

- 只用 **Nuxt UI (Vue) 原语 + 设计 token**;**不用 React**。
- 用设计 token,**不硬编码颜色 / 尺寸 / 圆角**。
- 响应式用系统自己的断点与 primitive(见 `references/foundations/responsiveness.md`),
  不要用临时 media query 或固定宽度。
- 用系统资源,不用占位图。
- 领域组件(如 API 文档那套)默认**不加载**,只有做该场景时才按 registry 切片装入。
- kit 依赖方向:kit→自身、kit→core;**禁止 kit→kit**。

## 起步

新项目从 `starter/` 起步——自足项目,依赖发布版 `@geist-nuxt/core`,
provider、全局样式、字体已接好,`pnpm install && pnpm dev` 即跑。
首页默认渲染 `<GeistShowcase />`,替换 `app/pages/index.vue` 开始做自己的应用,不要重建脚手架。
