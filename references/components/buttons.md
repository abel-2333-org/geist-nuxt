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

## CopyButton

复制到剪贴板按钮（foundation），「复制这个值」的唯一 UI 归宿：`UButton` + 可选 `UTooltip`，剪贴板写入、insecure-context 的 execCommand 兜底与 toast 反馈全部委托给 `useCopy` composable。仓库内 `CodeBlock` / `OperationTarget` 的复制都建在它上面，不各自重写剪贴板逻辑。

**何时用**：任何「点击把一个字符串放进剪贴板」的动作。若按钮除复制外还有别的副作用（如复制深链接并滚动定位），保持调用方自建按钮 + `useCopy`，不往本组件加旁效（见 api-docs kit 的 FieldItem anchor）。

**Anatomy**：`[UTooltip?] > UButton`(icon 随 idle/copied 切换) + sr-only `role="status"` live region。组件用 `inheritAttrs: false` 固定关闭 fallthrough，避免 tooltip / 非 tooltip 分支把 `class` 落到不同根上；需要布局类时一律在外面包一层元素（`OperationTarget` 的行尾包装是参考做法）。

**关键 props**：
- `value`（必填）：写入剪贴板的文本
- `label` / `copiedLabel`：idle / 复制后的可访问名 + tooltip 文案；`copiedLabel` 必须是完整句（默认 `Copied to clipboard`），未传 `successMessage` 时直接复用为成功 toast
- `successMessage` / `failureMessage`：完整 toast 句子——只接受完整句，不接受对象名再拼半句（见 `architecture-decisions.md` 复制 toast 约定）
- `tooltip`（默认 `false`）：密集工具条保持关闭
- `size`(默认 `sm`) / `variant`(默认 `ghost`) / `color`(默认 `neutral`) / `copiedColor`(默认 `success`) / `icon` / `copiedIcon`

**State model**：idle → copied（约 2s 瞬态：图标 copy→check、颜色 neutral→success，无布局位移）→ 自动回 idle；写入失败只出 error toast，不进入 copied 态。

**Accessibility**：图标态按钮自带动态 `aria-label`（idle/copied 切换）；复制结果经 polite live region 播报；`focus-visible` 环由 `UButton` 内置。

```vue
<CopyButton value="pnpm add @nuxt/ui" label="复制命令" copied-label="命令已复制" />
```

**勿臆造**：不存在 `toast-label` 之类的半句 prop；本地化 = 注入完整句。

## 源码参考

 - `src/runtime/components/Button.vue`、`src/theme/button.ts`（reference workspace: nuxt/ui@v4）
 - `foundation/components/CopyButton.vue`、`foundation/composables/useCopy.ts`（CopyButton 为本仓库 foundation 组件）
