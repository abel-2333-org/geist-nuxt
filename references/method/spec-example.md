# 示例：用规格模板落地一个新领域组件

演示把 `method/component-spec-template.md` 应用到一个组合组件。以 `EndpointHeader`（API 文档场景，显示 HTTP 方法 + 路径 + 描述）为例——先填规格，再实现。

## 1. 规格（先写，作为评审依据）

**Anatomy**
| 部位 | 使用 | 映射 |
|---|---|---|
| container | ✓ | `<div>` + `border-default` |
| label | ✓ | HTTP 方法 → `UBadge` |
| value | ✓ | 路径 → `<code>` (`font-mono`) |
| description | ✓ | 端点说明文字 |
| action | ✓ | 复制按钮 → `UButton` + `UTooltip` |
| icon/error/helper/affordance | — | 不使用 |
| focus target | ✓ | 复制按钮 |

**State model**：default；复制按钮 hover/active/focus-visible；复制成功用 toast 反馈。无 disabled/loading/invalid。

**Accessibility**：方法 badge 颜色按语义（GET=info、POST=success、DELETE=error…）且**不只靠颜色**（有文字）；复制按钮 `aria-label="复制端点路径"`；复制后 `useToast` 播报。

## 2. 实现

```vue
<script setup lang="ts">
const props = defineProps<{
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  description?: string
}>()

const methodColor: Record<string, 'info' | 'success' | 'warning' | 'error'> = {
  GET: 'info', POST: 'success', PUT: 'warning', DELETE: 'error',
}
const toast = useToast()
async function copyPath() {
  await navigator.clipboard.writeText(props.path)
  toast.add({ title: '已复制端点路径', color: 'success', icon: 'i-lucide-check' })
}
</script>

<template>
  <div class="space-y-2 rounded-md border border-default bg-elevated/40 p-4">
    <div class="flex items-center gap-3">
      <UBadge :color="methodColor[method]" variant="subtle" class="font-mono">{{ method }}</UBadge>
      <code class="font-mono text-sm text-highlighted">{{ path }}</code>
      <UTooltip text="复制端点路径" class="ms-auto">
        <UButton
          icon="i-lucide-copy"
          color="neutral"
          variant="ghost"
          size="sm"
          aria-label="复制端点路径"
          @click="copyPath"
        />
      </UTooltip>
    </div>
    <p v-if="description" class="text-sm text-muted">{{ description }}</p>
  </div>
</template>
```

## 要点

- 全部走语义 token（`border-default` `bg-elevated` `text-highlighted` `text-muted`）与语义 color。
- 方法用颜色 + 文字双编码，不违反"不只靠颜色"。
- 组合现成 Nuxt UI 组件（UBadge/UButton/UTooltip/useToast），不重造。
- 先规格后实现——这就是评审时对照的依据。
