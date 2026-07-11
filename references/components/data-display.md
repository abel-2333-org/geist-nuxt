# 数据展示

## UCard

内容容器。**Anatomy**：`#header` slot · 默认 slot(body) · `#footer` slot。

```vue
<UCard>
  <template #header>
    <h3 class="font-medium text-highlighted">标题</h3>
  </template>
  正文内容，用语义 token 着色。
  <template #footer>
    <UButton size="sm">操作</UButton>
  </template>
</UCard>
```
默认已用 `bg-default`/`border-default`/`--ui-radius`——不要手写边框颜色。

## UTable

数据表格。**props**：`:data`(行数组) `:columns`(列定义) `loading` `sticky`。列可自定义单元格渲染（`#<column>-cell` slot）。

```vue
<UTable :data="rows" :columns="columns" />
```

**A11y**：语义 `<table>` 结构；表头用 `<th scope>`（组件处理）。大数据量配 `UPagination`。

## UBadge

状态 / 分类 / 计数标记（纯展示，无交互）。**props**：`color`(7 个语义别名) `variant`(`solid`/`soft`/`subtle`/`outline`) `size`。常用于表格状态列、卡片标签。
```vue
<UBadge color="success" variant="subtle">已发布</UBadge>
```

## UKbd

键盘按键提示（纯展示）：`<UKbd value="⌘" />` 或 `<UKbd>Esc</UKbd>`。

## USeparator

分隔线：`<USeparator />` 或带标签 `<USeparator label="或" />`；`orientation="vertical"`。

## UAvatar

头像：`src` `alt` `icon`(回退) `size`。`UAvatarGroup` 叠放多个。
```vue
<UAvatar src="/user.png" alt="用户名" size="md" />
```

## 源码参考

 - `src/runtime/components/{Card,Table,Badge,Kbd,Separator,Avatar}.vue`（reference workspace: nuxt/ui@v4）
 - starter 用法：`packages/core/app/components/showcase/ShowcaseComponents.vue`、`ShowcaseFoundations.vue`
