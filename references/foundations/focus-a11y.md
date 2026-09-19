# Focus & Accessibility

本设计系统的 focus 指示**沿用 Nuxt UI 的 `focus-visible` 机制**（跟随语义色，本系统即紫色 primary）——这是正式约定，不是"目前碰巧如此"。生成任何交互元素都必须遵循下列规格。

> 说明：Geist 原版 focus 是"2px 表面色 + 4px 蓝色"双环。本系统 primary 为紫色，且 Nuxt UI 的 focus 已跟随 primary，故**采用 Nuxt UI 的紫色 focus 策略**，不强上 Geist 蓝环，以保持与品牌一致。这是相对 Geist 的有意偏离。

## Focus 规格

Nuxt UI 组件的 focus 表现（源码 `src/theme/*.ts`）：

- **实底控件**（如主按钮）：`focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-{color}` —— 2px 描边 + 2px 偏移，颜色为组件语义色。
- **outline/输入类**（input、select、textarea）：`focus-visible:ring-2 focus-visible:ring-{color}` —— 2px 内环。

规则：

- **一律用 `:focus-visible`，不要用 `:focus`** —— 避免鼠标点击也冒出 focus 环，只在键盘导航时显示。
- **绝不 `outline: none` 而不给可见替代** —— 这是硬性无障碍要求。
- 自建交互组件时，套用与 Nuxt UI 一致的 focus：实底用 `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`，输入类用 `focus-visible:ring-2 focus-visible:ring-primary`。不要各写各的。

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
- **表单**：一律用 `UFormField` 包裹，自动关联 label/error/描述与控件（`for`/`aria-describedby`）。

## 语义色的可及性

- 使用语义 token，不要手挑 hex；token 名称不等于所有搭配都通过。功能色、反色、透明度、叠加层及 hover/focus 必须验证实际前景与背景的合成对比，不能用正常中性文字的 40 对结果替代。
- 反色容器的正常文字用 `text-inverted`，排版承担层级；已有五类 solid slot 覆盖见 `tokens.md`。自定义 slot 或实例覆盖需单独检查。
- 真正不可操作的 disabled 控件与纯装饰内容可单独记录例外；用 Nuxt UI 的 `:disabled` 表达禁用行为，不能仅靠 `text-muted` 或 `text-dimmed` 判断。readonly、失焦、未选中、deprecated 和普通 placeholder 仍需满足正常文字对比度。

## 源码参考

- Nuxt UI focus 实现：`src/theme/button.ts`、`src/theme/input.ts`（reference workspace: nuxt/ui@v4）
- 无障碍要求：`vercel.com/design`（Do's and Don'ts）
