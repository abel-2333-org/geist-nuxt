# 按钮 / 动作

## UButton

**导入**：自动（Nuxt UI 模块在 Nuxt 里自动注册所有 `U*` 组件，无需手写 import）。

**何时用**：触发动作、提交表单、导航（配 `to`）。

**Anatomy**：container(`<button>`/`<a>`) · label(默认 slot / `label`) · icon(`icon`/`leading-icon`/`trailing-icon`) · focus target(自身)。

**关键 props**：
- `color`：`primary`(默认) `secondary` `success` `info` `warning` `error` `neutral`
- `variant`：`solid`(默认) `outline` `soft` `subtle` `ghost` `link`
- `size`：`xs` `sm` `md` `lg` `xl`
- `icon` / `leading-icon` / `trailing-icon`：`i-lucide-*`
- `loading`（布尔，显示 spinner 并禁用）· `loading-icon`
- `disabled`
- `to`（渲染为链接）· `block`（撑满宽度）· `square`

**State model**：default/hover/active 由 variant 内置；`focus-visible` 紫色环；`loading` 显示 spinner + 禁用；`disabled` 降透明度、不可聚焦。

**Accessibility**：只有图标时**必须**给 `aria-label`（或用 sr-only 文本）；`loading` 时组件自动置 `aria-disabled`；`to` 会渲染为可聚焦 `<a>`。

**组合示例**：
```vue
<UButton color="primary" leading-icon="i-lucide-plus">新建</UButton>
<UButton color="neutral" variant="outline">取消</UButton>
<UButton icon="i-lucide-settings" color="neutral" variant="ghost" aria-label="设置" />
<UButton :loading="pending" @click="save">保存</UButton>
```

**勿臆造**：颜色只能取上面 7 个语义别名，variant 只能取上面 6 个；不要传原始 hex。

## UButtonGroup

把多个 `UButton` / 输入拼成一组（共享圆角边界）。
```vue
<UButtonGroup>
  <UButton color="neutral" variant="outline">左</UButton>
  <UButton color="neutral" variant="outline">中</UButton>
  <UButton color="neutral" variant="outline">右</UButton>
</UButtonGroup>
```

> 状态标记 `UBadge`、键盘提示 `UKbd` 是**纯展示原子**（无交互动作），已归入 `data-display.md`，不在本组。

## 源码参考

 - `src/runtime/components/Button.vue`、`src/theme/button.ts`（reference workspace: nuxt/ui@v4）
