# Foundations — 响应式

geist-nuxt 用 Nuxt UI 的布局原语 + Tailwind 断点做响应式，**不写固定宽度、不写临时 media query**。

## 断点（Geist 官方值，非 Tailwind 默认）

断点像素**对齐 Vercel Geist 官方规范**（`vercel.com/design`），在 starter 的 `main.css` 里通过覆盖 Tailwind 的 `--breakpoint-*` 实现。前缀名仍是标准 `sm`/`md`/`lg`/`xl`/`2xl`，只是像素值改为 Geist 的：

| 前缀 | 最小宽度（Geist） | Tailwind 默认（对照） |
|---|---|---|
| `sm` | **401px** | 640px |
| `md` | **601px** | 768px |
| `lg` | **961px** | 1024px |
| `xl` | **1200px** | 1280px |
| `2xl` | **1400px** | 1536px |

> 这是全局重映射：Nuxt UI 内置的 `sm:`/`lg:` 类和你自己写的响应式前缀**都**按上表像素生效。Nuxt UI 组件不硬编码像素、也无 JS 读死断点，故完全兼容。

用响应式前缀叠加：`class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"`。

## 布局原语

- **`UContainer`** — 居中、带内边距的内容容器，最大宽度 `--ui-container`（**1200px**，Geist 内容列宽）。内边距随断点增大（`px-4 sm:px-6 lg:px-8`）。页面主体统一包一层。
- **`UPage` / `UPageHeader` / `UPageBody` / `UPageSection`** — 文档/落地页级别的页面骨架。
- **`UPageGrid` / `UPageColumns`** — 响应式网格 / 多列布局，自动按断点回流。
- **`UPageAside`** — 侧栏（文档、仪表盘）。

## 惯例

- 页面主体：`<UContainer>` 包裹，垂直分区用 `space-y-*` 或 `py-*`。
- 卡片网格：`<UPageGrid>` 或 `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6`。
- 移动优先：先写单列，再用 `md:`/`lg:` 升级为多列。
- 需要 JS 判断断点时用 VueUse 的 `useBreakpoints`，不要自己监听 resize。VueUse 已作为 `@vueuse/core` 直接依赖声明在 starter 的 `package.json`（不要靠 Nuxt UI 的传递依赖直接 import——pnpm 严格 node_modules 下解析不到）。显式 `import { useBreakpoints } from '@vueuse/core'`。
- **中英对等（bilingual parity）**：EN 与中文是结构对等的，不是「先做一种、再补另一种」。布局、标签、组件必须在两种语言各自的文本宽度下都成立——中文标签通常更短、英文更长，按更长的一方预留空间，避免换行或截断破坏对齐。不要为单一语言写死宽度。

## 源码参考

 - 容器主题：`src/theme/container.ts`（reference workspace: nuxt/ui@v4）
 - starter 用法：`packages/core/app/components/showcase/ShowcaseHero.vue`（`UContainer`）、`ShowcaseComponents.vue`（响应式 grid）
