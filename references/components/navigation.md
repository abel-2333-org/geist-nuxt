# 导航

## UNavigationMenu

主导航（头部 / 侧栏）。**props**：`:items`(链接数组，支持嵌套) `orientation`(`horizontal`/`vertical`) `highlight`。

```vue
<UNavigationMenu
  :items="[
    { label: '概览', to: '/', icon: 'i-lucide-home' },
    { label: '文档', to: '/docs', icon: 'i-lucide-book' },
  ]"
/>
```

## UTabs

选项卡。**props**：`:items`(`{label,icon,slot,content}[]`) `v-model`(激活值) `orientation` `variant`。

```vue
<UTabs :items="[{ label: '预览', slot: 'preview' }, { label: '代码', slot: 'code' }]">
  <template #preview>…</template>
  <template #code>…</template>
</UTabs>
```

**A11y**：Tab/方向键切换、`role="tab"`/`aria-selected` 由组件处理。

## UBreadcrumb

面包屑：`:items`(`{label,to,icon}[]`)。
```vue
<UBreadcrumb :items="[{ label: '首页', to: '/' }, { label: '设置' }]" />
```

## ULink

带激活态的链接（`to` / `href`）：`active-class` `inactive-class`；比裸 `<a>` 多了激活判定。

## UPagination

分页：`v-model:page` `:total` `:items-per-page`。配合 `UTable` 使用。

## 源码参考

 - `src/runtime/components/{NavigationMenu,Tabs,Breadcrumb,Link,Pagination}.vue`（reference workspace: nuxt/ui@v4）
 - starter 用法：`assets/starter/app/components/AppHeader.vue`
