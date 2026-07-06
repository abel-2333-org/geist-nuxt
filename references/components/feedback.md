# 反馈

## UAlert

内联提示条。**Anatomy**：icon · title · description · action(可选) · close(可选)。

**props**：`color` `variant`(`solid`/`soft`/`subtle`/`outline`) `title` `description` `icon` `close`(布尔或对象) `:actions`。

```vue
<UAlert
  color="warning"
  variant="soft"
  icon="i-lucide-triangle-alert"
  title="配额将满"
  description="本月 API 调用已用 90%。"
/>
```

**A11y**：重要提示用 `role="alert"`（组件按 color 处理）；可关闭时 close 按钮带 aria-label。

## UToast（useToast）

瞬时通知，通过 composable 触发（`UApp` 已在 starter 挂载 toast 容器）。

```vue
<script setup lang="ts">
const toast = useToast()
function onSaved() {
  toast.add({ title: '已保存', color: 'success', icon: 'i-lucide-check' })
}
</script>
```

**A11y**：toast 区域自带 `aria-live`；不要用 toast 承载必须交互的关键信息。

## UProgress

进度条：`v-model`(0–100) 或 `:value` `:max`；不确定态省略 value。`color` `size`。
```vue
<UProgress :value="60" color="primary" />
```

## USkeleton

加载占位：`<USkeleton class="h-8 w-full" />`。用 `bg-elevated` 底色，形状用 Tailwind 尺寸类拼。

## 源码参考

 - `src/runtime/components/{Alert,Toast,Progress,Skeleton}.vue`（reference workspace: nuxt/ui@v4）
