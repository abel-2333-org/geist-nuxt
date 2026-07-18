# 间距与布局（Spacing & Layout）

Geist 的另一个核心特征是**大留白 + 克制的边框**。层级主要靠间距和对比表达，而不是重边框或阴影。所有间距走 Tailwind 的 **4px 基准 scale**（Nuxt UI 的间距工具类也构建在其上），不要写死 `px`。

## 间距基准

| Tailwind | 像素 | 典型用途 |
| --- | --- | --- |
| `1` | 4px | 图标与文字的贴合间隙 |
| `2` | 8px | 紧凑元素内间距、badge |
| `3` | 12px | 按钮组、inline 控件间隙 |
| `4` | 16px | 卡片内 padding、表单字段间距 |
| `6` | 24px | 卡片 padding、区块内元素间距 |
| `8` | 32px | 子区块之间 |
| `10`–`12` | 40–48px | 区块内大分隔 |
| `14`–`20` | 56–80px | 区块之间的纵向节奏（section padding） |

> 活的间距展示见 `showcase/Foundations.vue` 的 spacing scale。

## 容器与页面宽度

 - **主容器用 `UContainer`**：它读取 `--ui-container`（设为 **100%**，布局默认占满整个视口宽度），并自带响应式左右 padding（`px-4 sm:px-6 lg:px-8`）。不要用裸 `<div class="max-w-...">` 手搓容器。
- **正文阅读宽度**：容器全宽后，行长靠内容级约束——长文本/段落限制在 `max-w-2xl`（≈42rem）～`max-w-3xl`，避免过长行长——见 hero 段落的 `max-w-2xl`。
- **需要窄列的区块**（如登录页、单栏长文）在内容级加 `max-w-*` + `mx-auto`，不要改全局 token。

## 纵向节奏（Vertical rhythm）

starter 的真实节奏，直接照用：

- **区块之间**：`py-14 sm:py-20`（section 纵向 padding，移动端收紧、桌面放大）。
- **区块标题与内容**：`space-y-10`（区块级）→ `space-y-4`（组内）→ `space-y-2`（标题+副标题）。
- **hero 内元素**：`gap-6`（`flex flex-col`）。
- **卡片内**：`p-6` padding + `space-y-4` 内容。

```vue
<template>
  <!-- 区块级：容器 + 大纵向留白 -->
  <UContainer class="py-14 sm:py-20">
    <div class="space-y-10">
      <div class="space-y-2">
        <h2 class="text-2xl font-semibold tracking-tight text-highlighted">区块标题</h2>
        <p class="text-muted max-w-2xl">一句话说明，限制阅读宽度。</p>
      </div>
      <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <!-- 卡片网格 -->
      </div>
    </div>
  </UContainer>
</template>
```

## 布局方法

- **优先用 flexbox / grid 工具类**：`flex`+`gap-*` 处理一维排列，`grid`+`gap-*` 处理卡片网格。
- **用 `gap-*` 而非 margin 堆叠**：容器负责间距，子项不带外边距，更可组合。
- **响应式列数**：`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`（见 `responsiveness.md`）。
- **边框克制**：分隔用 `border border-default` 单像素细边 + 圆角 `rounded-lg`，配合 `bg-elevated`/`bg-muted` 的浅表面，而不是阴影。Geist 几乎不用 drop shadow。

## 圆角（Geist 三层：6 / 12 / 16px）

### 机制：单基值比例派生 + 钉住最大档

Nuxt UI **不是**每档独立设值，而是把整条圆角 scale 锚定到单个 `--ui-radius`，用固定倍率派生（源码 `src/templates.ts`）：

```
--radius-xs = --ui-radius × 0.5
--radius-sm = --ui-radius × 1     ← 基准档
--radius-md = --ui-radius × 1.5
--radius-lg = --ui-radius × 2
--radius-xl = --ui-radius × 3
```

starter 把 `--ui-radius` 设为 **6px**（`0.375rem`），于是 scale 自动落成下表。**关键**：base=6px 时控件档（`rounded-sm`=6）和面板档（`rounded-lg`=12）**已精确命中 Geist**；只有最大档会派生成 18px，所以 starter 在 `main.css` 的 `@theme` 里**单独把 `--radius-xl` 钉成 16px**（打断比例），拿到 Geist 的第三层。`--ui-radius` 本身保持 6px 不动，以免破坏其它档。

| 类 | 值 | 语义档 | 用途 |
| --- | --- | --- | --- |
| `rounded-xs` | 3px | — | 极小色块、进度条 |
| `rounded-sm` | **6px** | **控件档** | 按钮、输入框、徽章、开关 |
| `rounded-md` | 9px | — | Nuxt UI 组件默认（多数中间态） |
| `rounded-lg` | **12px** | **面板档** | 卡片、面板、下拉/弹出菜单 |
| `rounded-xl` | **16px**（钉住） | **浮层档** | 模态、全屏浮层、大 sheet |
| `rounded-full` | 全圆 | — | 头像、pill badge |

### 语义映射（按用途选档，不要背 px）

- **控件 / 输入 / 徽章** → `rounded-sm`（6）
- **卡片 / 面板 / 菜单** → `rounded-lg`（12）
- **模态 / 全屏浮层** → `rounded-xl`（16）

> 想整体调圆角强度：改 `--ui-radius` 单个基值即可等比缩放全档；但这样会连 16px 的浮层档一起变，需要时同步调整 `--radius-xl` 的钉值。不要用超大圆角（`rounded-2xl`+，24px+）——与 Geist 的克制观感冲突。

## 源码参考

- 间距/圆角展示：`packages/core/app/components/showcase/Foundations.vue`
- 节奏用法：`packages/core/app/components/showcase/Hero.vue`、`Compositions.vue`
- 容器/圆角 token：`packages/core/app/assets/css/main.css`（`--ui-container`、`--ui-radius`）

## 不要做

- 不要写死 `px` 间距；用 4px scale 的工具类。
- 不要用重阴影表达层级；用留白、细边框、浅表面。
- 不要用超大圆角；保持 6px 基准的小圆角。
