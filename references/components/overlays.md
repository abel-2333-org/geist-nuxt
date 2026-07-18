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
