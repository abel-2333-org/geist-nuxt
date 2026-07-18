# Elevation & Motion

Geist 的层级**首先来自色调表面 + 边框**，阴影保持克制；动效**只在澄清变化时使用**，多数交互应"瞬时"。两者数值均取自 Vercel Geist 官方规范（`vercel.com/design` / `design.dark.md`），落地到 Nuxt UI 消费的 Tailwind token。

## Elevation（阴影三层）

### 机制

Nuxt UI 组件消费 Tailwind 的 `--shadow-*` token：卡片用 `shadow-xs`，**所有浮层**（popover / menu / select / toast / modal / slideover）默认都用 `shadow-lg`。foundation 在 `main.css` 重映射这些 token，并通过 `foundation/config/` 把 modal/slideover 单独指向更重的 `shadow-xl`：

| Tailwind 类 | 语义档 | Geist 值 | 用途 |
| --- | --- | --- | --- |
| `shadow-xs` | Raised | 浅 `0 2px 2px /.04`；深 `0 1px 2px /.16` | 抬起的卡片、tooltip（最轻） |
| `shadow-lg` | Overlay | 三层 `…4px 8px… / …16px 24px…` | popover、下拉/选择菜单、toast |
| `shadow-xl` | Modal | 三层 `…8px 16px… / …24px 32px…` | 模态、slideover、对话框 |

- **popover 与 modal 阴影在明暗两主题相同**（Geist 如此），放在 `@theme`；**raised card 明暗不同**，放在 `:root`/`.dark`。
- **单 token 约束**：Nuxt UI 用同一个 `shadow-lg` 服务 popover 和 modal。要让 modal 更重，foundation config 用 `ui.modal.slots.content: 'shadow-xl'`（tailwind-merge 去重后 `shadow-xl` 胜出）。新增需要重阴影的浮层组件时，用同样方式指向 `shadow-xl`。

### 用法

```vue
<!-- 抬起的卡片：加 shadow-xs（默认 UCard 用 ring 分隔，不带阴影） -->
<UCard class="shadow-xs">…</UCard>
```

- **不要**用 `shadow-2xl` 或彩色阴影——与 Geist 克制观感冲突。
- 优先用**表面色 + 边框/ring** 建立层级，阴影只是补充。

## Motion（动效）

### 原则

- **多数交互应瞬时**：`0ms` 常常是最好的选择。只有"揭示/移动元素"等确实有帮助时才加动效。
- **不要**长时间、循环、抢注意力的动画。
- **必须**尊重 `prefers-reduced-motion`——foundation 的 `main.css` 已全局处理（reduce 时动画/过渡收敛到近瞬时）。

### easing 与时长

foundation 把 Geist 的招牌弹性曲线设为 Tailwind 默认 `--ease-out`，故 `transition`/`ease-out` 工具类和 Nuxt UI 自身过渡都采用它：

| token / 类 | 值 | 用途 |
| --- | --- | --- |
| `ease-out`（已覆盖） | `cubic-bezier(0.175, 0.885, 0.32, 1.1)` | Geist 招牌曲线 |
| `duration-150` | 150ms | 状态变化（hover/active） |
| `duration-200` | 200ms | popover、tooltip |
| `duration-300` | 300ms | overlay、modal |

```vue
<div class="transition-colors duration-150 ease-out hover:bg-elevated">…</div>
```

> Nuxt UI 组件内置的进入/退出动画（如 modal 的 `scale-in 200ms`、popover 的 `scale-in 100ms`）已接近 Geist 时长，一般无需改动。自定义动效时套用上表 token。

## 源码参考

- token 定义：`foundation/assets/css/main.css`（`@theme` 的 `--shadow-*`/`--ease-out`、`:root`/`.dark` 的 `--shadow-xs`、末尾 reduced-motion 块）
- modal/slideover 阴影提升：`foundation/config/`
- Nuxt UI 阴影/动画用法：`src/theme/{modal,popover,card}.ts`（reference workspace: nuxt/ui@v4）
- Geist 规范：`vercel.com/design`（Elevation & Depth / Motion）
