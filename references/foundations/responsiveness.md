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

- **`UContainer`** — 带内边距的内容容器，最大宽度 `--ui-container`（设为 **100%**，默认全宽）。内边距随断点增大（`px-4 sm:px-6 lg:px-8`）。页面主体统一包一层；阅读宽度在内容级用 `max-w-*` 约束。
- **`UPage` / `UPageHeader` / `UPageBody` / `UPageSection`** — 文档/落地页级别的页面骨架。
- **`UPageGrid` / `UPageColumns`** — 响应式网格 / 多列布局，自动按断点回流。
- **`UPageAside`** — 侧栏（文档、仪表盘）。

## 组件按自身宽度自适应（容器查询 / 测量式溢出）

视口断点（`sm:`/`lg:`…）回答「屏幕多大」，但**可变宽的组件**（可拖拽的侧栏、放进不同栏宽的卡片、宽度不定的面板）真正在乎的是「**我自己**多宽」——这跟视口未必相关。这类场景按组件自身宽度自适应，别用视口前缀去猜。

- **优雅降级、宁降不崩**：宽度不够时主动换一种更省地方的形态，而不是硬塞导致截断/溢出/挤成空壳。分级降级的典型顺序：完整 → 缩略（截断 + tooltip） → 图标/计数替身 → 隐藏（同时保留 `sr-only` 或 tooltip 承载全量信息，别把无障碍一起降没）。
- 永远保护主标识：让次要装饰（标签、元信息）先让路，核心 label 留 `min-w-*` 可读地板，绝不出现「被 `truncate` 挤成零字符的空壳元素」。
- **两种落地方式，按需选**：
  - ① 纯 CSS **容器查询**——在尺寸边界标 `@container`，容器内元素用 `@sm:` / `@min-[15rem]:` 等**容器前缀**（相对容器宽度、非视口）。无 JS、无测量，适合「到某宽度就整体换一种形态」的**离散档位切换**。
  - ② **测量式溢出（responsive overflow）**——需要「能放几个算几个」的**连续**行为（标签溢出折 `+N`、工具栏挤不下收进 more 菜单）时纯 CSS 做不到：用 `ResizeObserver` 观察可用宽度 + 一个 `aria-hidden` 隐藏层量出各项真实像素宽，再贪心取舍。范例见 `kits/api-docs/sidebar-nav.md` 的场景标签簇（够宽平铺全部标签、窄了逐个折进 `+N`、极窄收成计数 chip，与拖拽调宽联动；SSR 先渲染确定性默认再于 `onMounted` 测量精修，避免 hydration 失配）。

> 何时用哪个：布局随**屏幕**变 → 视口断点；组件随**自身容器**变（宽度可被用户/父级改变）→ 容器查询（离散换形态）或测量式溢出（连续取舍）。

## 惯例

- 页面主体：`<UContainer>` 包裹，垂直分区用 `space-y-*` 或 `py-*`。
- 卡片网格：`<UPageGrid>` 或 `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6`。
- 移动优先：先写单列，再用 `md:`/`lg:` 升级为多列。
- 需要 JS 判断断点时用 VueUse 的 `useBreakpoints`，不要自己监听 resize。VueUse 已作为 `@vueuse/core` 直接依赖声明在 starter 的 `package.json`（不要靠 Nuxt UI 的传递依赖直接 import——pnpm 严格 node_modules 下解析不到）。显式 `import { useBreakpoints } from '@vueuse/core'`。
- **中英对等（bilingual parity）**：EN 与中文是结构对等的，不是「先做一种、再补另一种」。布局、标签、组件必须在两种语言各自的文本宽度下都成立——中文标签通常更短、英文更长，按更长的一方预留空间，避免换行或截断破坏对齐。不要为单一语言写死宽度。

## 源码参考

 - 容器主题：`src/theme/container.ts`（reference workspace: nuxt/ui@v4）
 - starter 用法：`packages/core/app/components/showcase/Hero.vue`（`UContainer`）、`Compositions.vue`（响应式 grid）
