# 覆盖层

覆盖层基于 Reka UI，焦点管理 / Esc 关闭 / ARIA 大多内置——**确认而非重写**。注意行为边界（见规格模板 a11y）。

## UModal

模态对话框（需焦点陷阱、遮罩、Esc 关闭）。**props**：`v-model:open` `title` `description` `:ui`；slot `#body` `#footer` `#content`。

```vue
<UModal v-model:open="open" title="确认删除" description="此操作不可撤销。">
  <UButton color="error">删除</UButton>
  <template #footer>
    <UButton color="error">确认</UButton>
    <UButton color="neutral" variant="outline" @click="open = false">取消</UButton>
  </template>
</UModal>
```

## USlideover

从边缘滑入的面板（同模态语义，侧向）。`v-model:open` `side`(`left`/`right`/`top`/`bottom`) `title`。

## UPopover

非模态浮层（可含交互），点击/hover 触发。`mode`(`click`/`hover`) + 默认 slot(触发器) + `#content`。

```vue
<UPopover>
  <UButton>筛选</UButton>
  <template #content>…筛选表单…</template>
</UPopover>
```

## AnnotationPopover

foundation 组件（非 Nuxt UI 原语）：narrative 文本中的**行内注释壳**——真实 `<button>` 触发器（dashed underline）+ 锚定非模态浮层 + hover 增强 + loading / error 铬件。registry item：`foundation-annotation-popover`。

**props**：`label`（eyebrow 类别名，如 "Term"）`icon`（eyebrow 前导图标，装饰性）`loading` `error`（truthy 切换错误态）`disabled` `triggerClass`（形态组件设置强调色）`labels`（chrome 文案本地化）。**slots**：默认（行内触发文本）`#content`（浮层正文）`#actions`（跳转 / 动作按钮）。**emits**：`open`（每次打开，调用方决定是否加载）`retry`。

```vue
限流采用 <AnnotationPopover label="Term" icon="i-lucide-book-open">
  滑动窗口
  <template #content><p>按滚动时间跨度统计请求数……</p></template>
  <template #actions><UButton size="xs" variant="link">查看正文</UButton></template>
</AnnotationPopover> 算法。
```

关键行为（实现契约，改动须过 `tests/component/annotation-popover.spec.ts`）：

- **click 为骨架、hover 为增强**：底层 `UPopover mode="click"` 受控 `v-model:open`；鼠标（`pointerType === 'mouse'`）`pointerenter/leave` 经 150ms 开 / 250ms 关定时器实现 hover 提前开合，浮层本体可进入。tap / 点击 / Enter 三端行为一致——这是不用 `mode="hover"`（HoverCard）的根因，见下方行为边界。
- **焦点按打开来源（OpenSource）管理**：触发器的 keydown / pointerdown / hover 定时器显式记录本次打开来源。keyboard 打开 → 焦点移入面板首个动作（无动作则面板本体 `tabindex="-1"`）；pointer / hover 打开 → 阻止 reka 自动聚焦，保持 focus-neutral。关闭时仅当焦点确实在面板内（或 keyboard 会话）才归还触发器，且在 nextTick 验证"焦点已丢失"后才动手；外部点击落到可聚焦目标时不抢回。hover 已开且触发器持焦时，forward Tab 被引导进面板并把所有权切为 keyboard。
- **异步铬件**：`loading` → `USkeleton` 三行 + `aria-busy` + sr-only 播报；`error` → 错误文案 + Retry 按钮（emit `retry`）；长内容浮层宽度受限（`w-72 sm:w-80`，且不超视口），完整内容须经 `#actions` 跳转可达（永不死路）。
- **disabled**：降透明度、不可聚焦触发，卸载时清理在途 hover 定时器。

> 形态组件（TermAnnotation / DocAnnotation / FieldAnnotation）是 playground 候选，spec 见 `playground/annotation.spec.md`；壳的本节即正式契约。

## UTooltip

纯辅助提示，**不承载交互**。`text` + 默认 slot(触发器)。
```vue
<UTooltip text="复制到剪贴板">
  <UButton icon="i-lucide-copy" variant="ghost" aria-label="复制" />
</UTooltip>
```

> ⚠️ **触摸端不触发**：底层 reka-ui 对 `pointerType === 'touch'` 直接 early-return，tooltip 只响应鼠标 hover 与键盘 focus。因此 tooltip **绝不能是某信息的唯一入口**——触摸设备上根本打不开。且触发器须本身可聚焦（`UButton` 等），套在纯 `span`/`UBadge` 上连键盘 focus 都进不来。**要让触摸/键盘用户主动获取的内容（如「+N」折叠项、缩略详情），改用 `click` 态 `UPopover`**，它 tap / 点击 / Enter 三端一致。

## UDropdownMenu

动作菜单：`:items`(分组数组，含 `label`/`icon`/`onSelect`/`kbds`) + 默认 slot(触发器)。键盘可达。
```vue
<UDropdownMenu :items="[[{ label: '编辑', icon: 'i-lucide-pen' }, { label: '删除', icon: 'i-lucide-trash', color: 'error' }]]">
  <UButton icon="i-lucide-ellipsis" variant="ghost" aria-label="更多" />
</UDropdownMenu>
```

## 行为边界（务必区分）

- **tooltip**：仅锦上添花的提示，不放按钮/链接；**触摸端不触发**，故不可作为信息的唯一入口。
- **popover**：可交互、可触摸/键盘打开（`click` 态），非模态、点外部关闭；折叠项 / 需主动获取的信息用它，而非 tooltip。
- **modal / slideover**：模态，焦点陷阱 + Esc + 遮罩。

## 源码参考

 - `src/runtime/components/{Modal,Slideover,Popover,Tooltip,DropdownMenu}.vue`（reference workspace: nuxt/ui@v4）
