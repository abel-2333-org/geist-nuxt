# 排版（Typography）

Geist 的排版是其视觉身份的核心：**Geist Sans** 用于所有 UI 文本，**Geist Mono** 用于代码、token、数据与标签。两者都由 `@nuxt/fonts`（Nuxt UI 自带）按字体名自动从 Google Fonts 解析并自托管——无需手写 `<link>` 或 `@font-face`。

## 字体族

在 `app/assets/css/main.css` 的 `@theme static` 里绑定：

```css
--font-sans: "Geist", ui-sans-serif, system-ui, sans-serif;
--font-mono: "Geist Mono", ui-monospace, "SF Mono", Menlo, monospace;
```

- **正文/标题 → `font-sans`**（默认，`<body>` 已应用，通常无需显式写）。
- **代码/token/数字/标签 → `font-mono`**（用 `class="font-mono"`）。Geist 系统里等宽字体承担了强烈的"技术感"表达，是刻意的品牌信号，不要用 sans 代替。

## 字阶（Type scale）

字号阶梯**参考 Vercel Geist 官方排版规范**（`vercel.com/geist/text`），px 值取自 Geist 官方；但**不沿用 Geist 的 `text-heading-*`/`text-copy-*` 命名**——基座是 Nuxt UI + Tailwind，一律用 Tailwind 工具类落地。行高/字重用 Tailwind 工具类贴合 Geist 意图。

Geist 规范的核心不是"一堆字号"，而是**按用途分三族**——先选族，再选 px：

- **Heading（标题族）**：紧行高 + 负字距（`tracking-tight`）+ `font-semibold`。页面/区块标题。
- **Label（标签族）**：单行、`font-medium`、行高适中，便于与图标对齐。菜单项、按钮文字、字段 label、表头。
- **Copy（正文族）**：多行、`leading-relaxed`、`font-normal`。段落、说明。

> 同一 px 在不同族里行高不同——判断"标题 / 单行标签 / 多行正文"比挑 px 更关键。Tailwind 默认阶梯缺 13/40/56/64px，用 arbitrary 值（`text-[..]`）补齐。

### Heading — `tracking-tight font-semibold`

| Geist | px | Tailwind 落地 | 什么时候用 |
| --- | --- | --- | --- |
| Heading 72 | 72 | `text-7xl` | 营销 hero（最大） |
| Heading 64 | 64 | `text-[4rem] leading-[1.1]` | 大型 hero |
| Heading 56 | 56 | `text-[3.5rem] leading-[1.1]` | hero |
| Heading 48 | 48 | `text-5xl` | 落地页大标题 |
| Heading 40 | 40 | `text-[2.5rem] leading-tight` | 页面主标题（营销） |
| Heading 32 | 32 | `text-[2rem] leading-tight` | 仪表盘页标题、区块标题 |
| Heading 24 | 24 | `text-2xl` | 区块标题 |
| Heading 20 | 20 | `text-xl` | 子区块标题 |
| Heading 16 | 16 | `text-base` | 卡片标题、小标题 |
| Heading 14 | 14 | `text-sm` | 最小标题、dense 视图 |

### Copy — `leading-relaxed`（正文 `font-normal`）

| Geist | px | Tailwind 落地 | 什么时候用 |
| --- | --- | --- | --- |
| Copy 24 | 24 | `text-2xl leading-relaxed` | 营销 hero 引导语 |
| Copy 20 | 20 | `text-xl leading-relaxed` | 营销 hero 引导语 |
| Copy 18 | 18 | `text-lg leading-relaxed` | 营销大段引用 |
| Copy 16 | 16 | `text-base leading-relaxed` | Modal 等宽松视图正文 |
| **Copy 14** | 14 | `text-sm leading-relaxed` | **最常用正文** |
| Copy 13 | 13 | `text-[0.8125rem] leading-relaxed` | 次要文本、空间紧张处 |
| Copy 13 Mono | 13 | `font-mono text-[0.8125rem]` | **内联代码提及** |

### Label — 单行 `font-medium`

| Geist | px | Tailwind 落地 | 什么时候用 |
| --- | --- | --- | --- |
| Label 20 | 20 | `text-xl font-medium` | 营销单行文本 |
| Label 18 | 18 | `text-lg font-medium` | — |
| Label 16 | 16 | `text-base font-medium` | 标题中与正文区分 |
| **Label 14** | 14 | `text-sm font-medium` | **全站最常用**：菜单、按钮、字段 label |
| Label 14 Mono | 14 | `font-mono text-sm` | 与 >14 文本搭配的最大 mono |
| Label 13 | 13 | `text-[0.8125rem] font-medium`（数字加 `tabular-nums`） | 次级标签行；表数字用 tabular |
| Label 13 Mono | 13 | `font-mono text-[0.8125rem]` | 与 Label 14 搭配的 mono |
| Label 12 | 12 | `text-xs font-medium uppercase tracking-wide` | 三级文本、日历大写、Show More |
| Label 12 Mono | 12 | `font-mono text-xs` | — |

### Button（仅按钮内，一般由 `UButton size` 自动处理）

Geist Button 16/14/12 → `UButton` 的 `size="lg"` / `"md"`（默认）/ `"xs"`。**通常不用手写字号**，此表仅作对照。

### 速查：最常用几个

- **正文段落** → `text-sm leading-relaxed`（Copy 14）
- **菜单/按钮/字段标签** → `text-sm font-medium`（Label 14）
- **卡片标题** → `text-base font-semibold tracking-tight`（Heading 16）
- **页面标题** → `text-[2rem] leading-tight font-semibold tracking-tight`（Heading 32）
- **内联代码** → `font-mono text-[0.8125rem]`（Copy 13 Mono）

> starter 的 `showcase/Foundations.vue` 是活的字阶展示；`showcase/Hero.vue` 是 Heading/Copy 组合的真实用例。

### 关键约定

- **标题一律配 `tracking-tight`**：Geist 标题的紧字距是标志性特征；漏掉会立刻"不像 Geist"。
- **字重克制**：最重到 `font-semibold`（600）。避免 `font-bold`/`font-black`——Geist 靠对比和留白而非粗字重制造层级。
- **长文本加 `text-balance`（标题）/ `text-pretty`（正文）**：见 hero 里的 `<h1 text-balance>` 与 `<p text-pretty>`，改善换行观感。
- **颜色走语义 token**：标题用 `text-highlighted`，正文用默认 `text-default`，次要文本用 `text-muted`/`text-toned`（见 `tokens.md`），不要写死颜色。
- **中文（CJK）正文放宽行高（基座已零配置处理）**：汉字字面框更满，`leading-relaxed`（≈1.625）对拉丁文合适，但中文多行正文偏挤。基座 `main.css` 有一条全局规则 `:is(:lang(zh),:lang(ja),:lang(ko)) :is(p,li,dd,blockquote,figcaption){line-height:1.7}`，所以只要在 `<html>`（或子树）上设置 `lang`（如 Nuxt i18n 自动注入的 `lang="zh"`），中文段落级正文会自动获得 1.7 行高，无需手写 `leading-*`。标题、控件、代码不受影响（保持 `leading-tight`/`leading-[1.1]`）。仅当某处未落在段落级元素、或需单独覆盖时，再手动加 `leading-[1.7]`。若同一组件需中英对等（bilingual parity），以中文的更高行高为准排版，保证两种语言在各自宽度下都成立。

## 文本颜色语义（与排版配套）

| Tailwind 类 | 语义 token | 典型用途 |
| --- | --- | --- |
| `text-highlighted` | `--ui-text-highlighted` | 标题、强调 |
| `text-default`（默认） | `--ui-text` | 正文 |
| `text-toned` | `--ui-text-toned` | 次要正文 |
| `text-muted` | `--ui-text-muted` | 说明、标签 |
| `text-dimmed` | `--ui-text-dimmed` | 占位、禁用感 |

## 源码参考

- 字体 token：`packages/core/app/assets/css/main.css`（`@theme static`）
- 活的字阶展示：`packages/core/app/components/showcase/Foundations.vue`
- hero 标题用法：`packages/core/app/components/showcase/Hero.vue`

## 不要做

- 不要引入 Geist / Geist Mono 之外的字体族。
- 不要用固�� `px` 字号；用 Tailwind 字阶类保持节奏一致。
- 不要用 `font-bold` 以上字重堆层级——改用字号、颜色与留白。
