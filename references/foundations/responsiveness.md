# Foundations — 响应式

geist-nuxt 用 Nuxt UI 的布局原语 + Tailwind 断点做响应式，**不写固定宽度、不写临时 media query**。

## 断点（Geist 官方值，非 Tailwind 默认）

断点像素**对齐 Vercel Geist 官方规范**（`vercel.com/design`），在 `foundation/assets/css/main.css` 里通过覆盖 Tailwind 的 `--breakpoint-*` 实现。前缀名仍是标准 `sm`/`md`/`lg`/`xl`/`2xl`，只是像素值改为 Geist 的：

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

## 组件按自身宽度自适应（回流三档）

视口断点（`sm:`/`lg:`…）回答「屏幕多大」，但**可变宽的组件**（可拖拽的侧栏、放进不同栏宽的卡片、宽度不定的面板）真正在乎的是「**我自己**多宽」——这跟视口未必相关。这类场景按组件自身宽度自适应，别用视口前缀去猜。

- **优雅降级、宁降不崩**：宽度不够时主动换一种更省地方的形态，而不是硬塞导致截断/溢出/挤成空壳。分级降级的典型顺序：完整 → 缩略（截断 + tooltip） → 图标/计数替身 → 隐藏（同时保留 `sr-only` 或 tooltip 承载全量信息，别把无障碍一起降没）。
- 永远保护主标识：让次要装饰（标签、元信息）先让路，核心 label 留 `min-w-*` 可读地板，绝不出现「被 `truncate` 挤成零字符的空壳元素」。

### 第一判定轴：换行阈值由谁决定

选工具的第一步**不是**问「行为是离散还是连续」，而是问「**阈值由谁决定**」。这一步选错，后面写什么都救不回来。

| 阈值来源 | 落地方式 | 典型场景 |
|---|---|---|
| **固定像素**——形态切换与内容无关 | ① 容器查询（纯 CSS） | 侧栏到某宽度整体折成图标条；密度档位（padding / `min-h`）切换 |
| **内容**——「放得下就一行，放不下就分层」 | ② **内在换行分组**（纯 CSS，**无阈值**） | 地址行的 `path + 复制键`；字段签名的 `必填标记 + lifecycle 徽章` |
| **逐项取舍**——「能放几个算几个」 | ③ 测量式溢出（`ResizeObserver` + JS） | 标签簇溢出折 `+N`；工具栏挤不下收进 more 菜单 |

「离散 vs 连续」是**第二**判定轴，只用于在 ① 和 ③ 之间做最后区分。

#### ① 容器查询

在尺寸边界标 `@container`，容器内元素用 `@sm:` / `@min-[15rem]:` 等**容器前缀**（相对容器宽度、非视口）。无 JS、无测量，适合「到某宽度就整体换一种形态」的**离散档位切换**。

> 容器查询前缀吃的是 Tailwind 的 `--container-*`（`@md` = 28rem = 448px），**不是**本页顶部那张 Geist `--breakpoint-*` 表。两套值不同，写的时候别混。

#### ② 内在换行分组（intrinsic wrap grouping）

当契约是「**A 和 B 必须待在同一行**」时，不要去找那个「刚好放得下」的像素值——**它不存在**：内容文案、标签与字体度量都是变量，同一组 props 在不同浏览器上会落到阈值两侧。

做法：把 A、B 包成一个 `flex-nowrap`（或 `inline-flex shrink-0`）的**原子布局单元**，让父容器的 `flex-wrap` 只可能在单元**之间**断行。阈值随之消失——行恰好在两个单元真的放得下时才合并。

```html
<div class="flex flex-wrap items-center gap-1">
  <div class="flex min-w-0 flex-nowrap items-center gap-1 flex-[0_1_auto]">A1 A2</div>
  <div class="flex min-w-0 flex-nowrap items-center gap-1 flex-[1_1_auto]">B1 B2</div>
</div>
```

四条要点：

- **`flex-basis` 必须是 `auto`**。flex 断行比较的是各 item 的 *hypothetical main size*；basis 为 `auto` 才让断行读到真实内容宽度。写成 `flex-1`（basis `0%`）会抹掉这个信号，行永远不断。
- 每个单元加 `min-w-0`，让长内容在**单元内部**降级（truncate / 横向滚动），而不是把页面撑出横向滚动条。
- **单元之间做不了装饰性分隔线**。分隔线断言「这两个此刻相邻」，而内容驱动的换行刻意不让 CSS 知道当前行况；硬做出来的分隔线会在换行态画在行首。用色阶或间距表达接缝。
- 单元在 DOM 上打 `data-*` 标记，测试断言「单元存在且 `flex-nowrap`」，**不要断言断点类名**——后者锁的是实现，而且它全绿的同时缺陷可以照样存在（`OperationTarget` 的旧测试断言 `@md/target:flex-[0_3_auto]`，孤立复制键在那期间一直在）。宽度验证要按**组件容器**宽度连续扫描、断言状态序列，固定宽度抽查只探端点，探不到中间那条带。

实例：`OperationTarget`（`data-target-origin` / `data-target-operation` 两单元）、`FieldItem`（`data-field-qualifiers` 把必填标记与 lifecycle 徽章锁成一簇）。

> **反模式：用容器查询表达内容驱动的阈值。** 断点生效之后、内容其实还放不下之前的那段区间里，布局会退回裸 `flex-wrap`，任何一个尾部元素都可能被单独甩到下一行——形成一条**位置随内容漂移的错误带**。`OperationTarget` 的孤立复制键（#68）正是如此：同一份实现，孤立带在一组 fixture 上是 534–565px，换一条更长的 path 就漂到 719–750px。把断点往上挪救不了它，因为没有一个像素值能同时躲开所有内容。

#### ③ 测量式溢出（responsive overflow）

需要「能放几个算几个」的**连续**行为时纯 CSS 做不到：用 `ResizeObserver` 观察可用宽度 + 一个 `aria-hidden` 隐藏层量出各项真实像素宽，再贪心取舍。范例见 `kits/api-docs/sidebar-nav.md` 的场景标签簇（够宽平铺全部标签、窄了逐个折进 `+N`、极窄收成计数 chip，与拖拽调宽联动；SSR 先渲染确定性默认再于 `onMounted` 测量精修，避免 hydration 失配）。

> 何时用哪个：布局随**屏幕**变 → 视口断点；组件随**自身容器**变（宽度可被用户/父级改变）→ 先过上面那张表定档，再选 ① / ② / ③。一个组件同时用两档是正常的——`OperationTarget` 用 ② 决定回流、用 ① 只切 segment 密度。

## 惯例

- 页面主体：`<UContainer>` 包裹，垂直分区用 `space-y-*` 或 `py-*`。
- 卡片网格：`<UPageGrid>` 或 `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6`。
- 移动优先：先写单列，再用 `md:`/`lg:` 升级为多列。
- 需要 JS 判断断点时用 VueUse 的 `useBreakpoints`，不要自己监听 resize。VueUse 已作为 `@vueuse/core` 直接依赖声明在根 `package.json`；消费项目若安装使用它的切片，也必须有显式依赖。显式 `import { useBreakpoints } from '@vueuse/core'`。
- **中英对等（bilingual parity）**：EN 与中文是结构对等的，不是「先做一种、再补另一种」。布局、标签、组件必须在两种语言各自的文本宽度下都成立——中文标签通常更短、英文更长，按更长的一方预留空间，避免换行或截断破坏对齐。不要为单一语言写死宽度。

## 源码参考

 - 容器主题：`src/theme/container.ts`（reference workspace: nuxt/ui@v4）
- 活用法：`app/components/gallery/showcase/Hero.vue`（`UContainer`）、`app/components/gallery/showcase/Compositions.vue`（响应式 grid）
