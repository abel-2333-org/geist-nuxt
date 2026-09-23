# Focus & Accessibility

本设计系统的 focus 指示**沿用 Nuxt UI 的 `focus-visible` 机制**（跟随语义色，本系统即紫色 primary）——这是正式约定，不是"目前碰巧如此"。生成任何交互元素都必须遵循下列规格。

> 说明：Geist 原版 focus 是"2px 表面色 + 4px 蓝色"双环。本系统 primary 为紫色，且 Nuxt UI 的 focus 已跟随 primary，故**采用 Nuxt UI 的紫色 focus 策略**，不强上 Geist 蓝环，以保持与品牌一致。这是相对 Geist 的有意偏离。

## Focus 规格

实际安装的 Nuxt UI 4.9.0 主题（组件之间不共用一个固定几何规格）：

- **Button solid / link**：`outline-{color}/25 focus-visible:outline-3`；neutral 使用 `outline-inverted/25`。#147 只覆盖实底状态背景与 link 状态文字，不替换这套 focus 样式。不能把文字 4.5:1 结果当作焦点非文字 3:1 证明。
- **输入类**（input、select、textarea）：按实际变体保留上游 focus ring；具体触发选择器与层叠需由对应组件实测，不能由 Button 样式外推。

规则：

- **一律用 `:focus-visible`，不要用 `:focus`** —— 避免鼠标点击也冒出 focus 环，只在键盘导航时显示。
- **绝不 `outline: none` 而不给可见替代** —— 这是硬性无障碍要求。
- 自建交互组件沿用本项目已有的显式配方：实底用 `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`，输入类用 `focus-visible:ring-2 focus-visible:ring-primary`。这是项目配方，不声称与当前 Nuxt UI Button 的描边几何完全相同；实际背景配对仍须验证。

```vue
<!-- 自建可点击卡片：套用系统 focus 规格 -->
<button
  class="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
>
  …
</button>
```

## 无障碍硬要求（Geist Do's）

- **对比度**：正常可读文字保持 WCAG AA（4.5:1），以未舍入值判定。五个中性文字角色在明暗两主题的四个中性背景上均须通过；description/help/hint/type/format/count/constraint/普通 placeholder 都在范围内。用 `text-default`、`text-toned`、`text-muted`、`text-dimmed` 排可读层级，不要手拼 shade 数字；额外 alpha 需重新验证合成对比。
- **不要只用颜色表达状态** —— 必须搭配图标或文字标签（如成功不只是变绿，要带 ✓ 或"已完成"）。
- **每个交互元素**在 `:focus-visible` 都要显示 focus 环。
- **纯图标按钮**必须有可访问名称（`ThemeToggle` 由 `UColorModeButton` 从根 `UApp` locale 提供）。
- **键盘可达**：所有可点击元素用真正的 `<button>`/`<a>` 或带 `tabindex`/`role` 的元素；Nuxt UI 组件默认已处理键盘交互（Reka UI 基座）。
- **触控 tap 目标**：分发组件（foundation / kit）里**每个最终渲染为 `<button>` / `<a>` 的元素**都加 `touch-manipulation`——判定看渲染结果，不看有没有 `@click`（只在 hover / focus 触发 tooltip 的记号按钮同样算），含原生标签、stretched-link 覆盖层、`<component :is>` 与 render function 生成的链接，以及经 `class` 到达根元素的 `UButton` / `ULink` / `UColorModeButton`。它关闭浏览器的双击缩放启发式，让快速连点（展开 → 收起、打开 → Esc → 再打开）稳定触发而不被判为缩放。两类明示例外：拖拽把手用 `touch-none`（`SplitPaneHandle`）；Nuxt UI 原语在**内部**生成、`class` 到不了的非根交互元素（如 `UNavigationMenu` 的菜单项、`UTabs` 的 trigger）由上游主题决定，不在本契约内；根即触发器的原语（`USelect` 的 trigger、`UColorModeButton`）`class` 到得了，照常纳入。组件 spec 用 `classes()` 锁定该 class（先例：`SidebarNav` / `SchemaComposition` / `SiteSearch`）。
- **表单**：一律用 `UFormField` 包裹，自动关联 label/error/描述与控件（`for`/`aria-describedby`）。

## 语义色的可及性

- 使用语义 token，不要手挑 hex；token 名称不等于所有搭配都通过。功能色、反色、透明度、叠加层及 hover/focus 必须验证实际前景与背景的合成对比，不能用正常中性文字的 40 对结果替代。
- 六角色映射、Button solid/link 状态与彩色 Alert description 配对见 [tokens.md](tokens.md#功能色语义配对与组件状态)。required `::after` 必须测生成星号本身；真实 portal、Sidebar 背景和动态响应徽章按实际绘制验证，未知绘制保持 unresolved。
- 反色容器的正常文字用 `text-inverted`，排版承担层级；已有五类 solid slot 覆盖见 `tokens.md`。自定义 slot 或实例覆盖需单独检查。
- 真正不可操作的 disabled 控件与纯装饰内容可单独记录例外；用 Nuxt UI 的 `:disabled` 表达禁用行为，不能仅靠 `text-muted` 或 `text-dimmed` 判断。readonly、失焦、未选中、deprecated 和普通 placeholder 仍需满足正常文字对比度。

## 源码参考

- Nuxt UI focus 实现：`src/theme/button.ts`、`src/theme/input.ts`（reference workspace: nuxt/ui@v4）
- 无障碍要求：`vercel.com/design`（Do's and Don'ts）
