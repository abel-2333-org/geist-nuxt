# Foundations — 设计 token

geist-nuxt 建立在 Nuxt UI v4 的语义 token 系统（`--ui-*` CSS 变量）之上，并用 Geist 品牌值做覆盖。全部覆盖集中在 starter 的 `app/assets/css/main.css`，且**不放进 `@layer`**，因此稳定地胜过 Nuxt UI `@layer theme` 默认值。

## 颜色

### 语义别名 → Tailwind 调色板（`app.config.ts` 的 `ui.colors`）

> 每个别名的 `app.config.ts` 值只是「回退调色板名」；**实际色值全部由 `main.css` 用 Geist 值覆盖**（primary 紫 ramp、灰阶、以及 5 条 Geist 功能色阶），因此没有任何角色渲染成 Tailwind 原色。

| 别名 | 回退调色板 | Geist 色值覆盖 | 说明 |
|---|---|---|---|
| `primary` | violet | **CSS ramp** | 品牌紫，见下 |
| `secondary` | teal | **Geist teal 阶** | Geist accent（Geist 无 cyan） |
| `success` | green | **Geist green 阶** | |
| `info` | blue | **Geist blue 阶** | Geist 招牌蓝 `#0072f5` |
| `warning` | amber | **自定义 amber 阶** | 项目自定义琥珀（非 Geist 官方 amber） |
| `error` | red | **Geist red 阶** | |
| `neutral` | neutral | **Geist 灰（语义 token）** | **真中性灰**（非 slate），Geist 的无彩色表面 |

### 紫色 primary ramp（`main.css` 的 `:root`）

完整 50–950 都注册到 `--ui-color-primary-{shade}`：

```
50 #f6f0ff  100 #eee3ff  200 #dfc7ff  300 #c8a0ff  400 #a96eff
500 #7a3ce2  600 #6b30cf  700 #5925b1  800 #4a2290  900 #3d1d74  950 #261047
```

- `--ui-primary` 浅色 = `var(--ui-color-primary-500)`，深色 = `var(--ui-color-primary-400)`（近黑背景上对比更好）。

### 功能色阶（`main.css` 的 `:root`）— success / info / warning / error / secondary

值取自 **Geist 官方 `geist-colors` 包**（green / blue / red / teal 的亮色阶），与 primary 同款机制注册成 `--ui-color-{role}-{shade}`，并设 `--ui-{role}` 浅色取 `500`、深色取 `400`。**例外：`warning` 用项目自定义 amber 阶（非 Geist），50–950 全档手工指定。**

**关键：Geist 是「意图编档」的 100–1000（`700` = solid fill 高对比主色档），Nuxt UI 是「亮度编档」的 50–950（浅色默认取 `500`）。** 映射时把 **Geist-700 对到 Tailwind-500**（锚点），使功能色默认渲染即为 Geist 的实心填充色；`500` 各角色实际值：

```
success #45a557  info #0072f5  warning #e99b18（自定义）  error #e5484d  secondary #12a594
```

- **只用单套亮色 ramp、暗色靠 Nuxt 自动取 400 档**（与 primary 一致）。**不为功能色单拆明/暗两套 ramp**：Geist 暗色功能阶是「100 最暗→1000 最亮」的升序结构，与 Nuxt UI「50 最浅→950 最深 + 暗色取 400」的引擎模型冲突，硬拆会导致 soft 徽章底色等错位。灰阶之所以能明暗分拆，是因为它覆盖的是语义 token（`--ui-bg/text/border`）而非数字 ramp。
- 补全 `900/950` 深档时对 Geist-1000 做等比压暗（这些深档 Nuxt 语义 token 基本不消费，精度影响可忽略）。

### 中性灰阶 — Geist 灰值映射到 Nuxt UI 语义 token（`main.css`）

Geist 灰阶与 Nuxt UI 默认的 Tailwind `neutral` 同为**纯中性灰**（hue 0、饱和 0），但 Geist 明/暗是两套独立色值。Nuxt UI 的 text/bg/border 语义 token 默认都从单一 neutral ramp 按档位派生，无法同时精准命中 Geist 的明暗两套，因此我们**直接覆盖 Nuxt UI 的语义 `--ui-*` token**：在 `:root`/`.light` 与 `.dark` 里各自赋值（色值取自 Geist 灰阶，但**消费方式仍是 Nuxt UI 的语义 token，不引入任何 Geist scale 命名**）。

浅色（`:root, .light`）——注释为**语义角色**（值取自 Geist 灰阶）：

```
--ui-bg:           #ffffff   （页面底）
--ui-bg-muted:     #fafafa   （次级表面）
--ui-bg-elevated:  #f2f2f2   （卡片/输入表面）
--ui-bg-accented:  #ebebeb   （hover 表面）
--ui-border-muted: #ebebeb   （弱边框/分隔线）
--ui-border:       #ebebeb   （默认边框）
--ui-border-accented: #c9c9c9（hover 边框）
--ui-text-dimmed:  #a8a8a8   （最弱文字）
--ui-text-muted:   #8f8f8f   （弱化/占位/禁用）
--ui-text-toned:   #666666   （次要文字）
--ui-text:         #171717   （主要正文，near-black）
--ui-text-highlighted: #171717（强调文字）
```

深色（`.dark`）——同一批语义角色，深色取值：

```
--ui-bg:           #0a0a0a   （页面底，近纯黑）
--ui-bg-muted:     #1a1a1a   （次级表面）
--ui-bg-elevated:  #1f1f1f   （卡片/输入表面）
--ui-bg-accented:  #292929   （hover 表面）
--ui-border-muted: #1f1f1f   （弱边框/分隔线）
--ui-border:       #2e2e2e   （默认边框）
--ui-border-accented: #454545（hover 边框）
--ui-text-dimmed:  #878787   （最弱文字）
--ui-text-muted:   #8f8f8f   （弱化/占位/禁用）
--ui-text-toned:   #a1a1a1   （次要文字）
--ui-text:         #ededed   （主要正文）
--ui-text-highlighted: #ffffff（强调文字）
```

> `app.config.ts` 里的 `neutral` 别名仍指向 Tailwind `neutral`（用于原始 neutral swatch 展示）；实际 background/text/border 一律走上面的语义覆盖，二者都是无彩色纯灰，不冲突。

### 色阶体系：Nuxt UI / Tailwind 50–950（**不是** Geist 的 100–1000）

本系统的色阶是 **Tailwind 的 50–950 十一档**（`50 100 200 300 400 500 600 700 800 900 950`），每条调色板都注册成 `--ui-color-{alias}-{shade}`。**不要用 Geist 的 100–1000 命名**——那是 Geist 自家 React 实现的 scale，与 Nuxt UI 不兼容。虽然我们把 Geist 的品牌色值填了进来，但**档位、命名、消费方式一律走 Nuxt UI**。

**几乎不需要直接写 shade 数字。** Nuxt UI 用两层抽象把 shade 隐藏掉：

1. **彩色别名**（`primary`/`success`/`error`…）：`DEFAULT` 浅色取 `500`、深色取 `400`，hover/active 等状态由组件变体内部在相邻档间切换。你只写 `color="primary"`，不写 `primary-500`。
2. **中性语义 token**（`--ui-*`）：文字/背景/边框各有语义 token，映射到 neutral 档（Nuxt UI 默认映射如下，本系统用 Geist 灰值覆盖了具体色值，但**语义角色不变**）：

   | 语义 token（类名） | 默认映射档 | 用途 |
   |---|---|---|
   | `text-highlighted` | neutral-900 | 强调/主标题文字 |
   | `text`（`text-default`） | neutral-700 | 主要正文 |
   | `text-toned` | neutral-600 | 次要文字 |
   | `text-muted` | neutral-500 | 弱化文字、占位、禁用 |
   | `text-dimmed` | neutral-400 | 最弱文字 |
   | `bg`（`bg-default`） | white / neutral-900 | 页面底 |
   | `bg-muted` | neutral-50 | 次级表面 |
   | `bg-elevated` | neutral-100 | 卡片/输入表面 |
   | `bg-accented` | neutral-200 | hover 表面 |
   | `border`（`border-default`） | neutral-200 | 默认边框 |
   | `border-accented` | neutral-300 | hover 边框 |

### 使用方式

- **永远用语义类 / token**，不要写死颜色，也不要手拼 shade 数字：文字用 `text-highlighted` `text-default` `text-toned` `text-muted` `text-dimmed`；背景用 `bg-default` `bg-muted` `bg-elevated` `bg-accented`；边框用 `border-default` `border-accented`。
- 组件的 `color` prop 取语义别名：`<UButton color="primary">`、`<UBadge color="success">`。状态递进（hover/active）由变体内置，无需手写。
- 信息层级按语义 token 排序：主文字 `text-default`、次要 `text-toned`、弱化/禁用 `text-muted`。
- **用颜色表达状态时务必配图标或文字**（不要仅靠红/绿区分），见 `focus-a11y.md`。

## 排版

- `--font-sans: Geist`、`--font-mono: Geist Mono`（由 `@nuxt/fonts`（Nuxt UI 自带）按字体名自动从 Google Fonts 解析并自托管，`main.css` 的 `@theme` 里绑定到 `--font-sans`/`--font-mono`）。
- 字阶用 Tailwind 类：`text-xs`→`text-4xl`。正文 `text-base`，标题用 `font-semibold`/`font-bold` + `tracking-tight`。

## 圆角

- `--ui-radius: 0.375rem`（6px）——Geist 材质基准（Nuxt UI 默认 4px，已调）。
- 组件圆角自动派生：`rounded-md` 用 `var(--ui-radius)`，其余按倍数。

## 间距 / 容器 / 头部

- 间距用 Tailwind 4px 基准刻度（`p-2`=8px、`gap-4`=16px、`py-6`=24px…），大留白优先。
 - `--ui-container: 1200px`（Geist 内容列宽），用 `<UContainer>` 承载。
- 头部高度 `--ui-header-height: 4rem`（64px）。

## Focus

- 聚焦环用 `--ui-primary`（紫色），组件内置 `focus-visible` 环，不要移除。

## 源码参考

- token 覆盖：`assets/starter/app/assets/css/main.css`
- 语义别名映射：`assets/starter/app.config.ts`
- Nuxt UI token 定义：`src/runtime/index.css`、`src/theme/index.ts`（reference workspace: nuxt/ui@v4）
