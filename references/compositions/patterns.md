# 局部组合（Patterns）

把通用组件拼成**页面内的一块**：内容区块、卡片网格、表单、空状态、加载/反馈，以及每屏无障碍自检。都只用核心 Nuxt UI 组件 + Geist token 组合，与是否有领域组件无关。目标是在 Geist 视觉语言下保持一致：大留白、高对比、克制边框。

> 想拼**整页外壳**（header/根组件/主题切换）看同目录 `page-shell.md`；想造「新的领域组件」看 `method/`；想查「单个组件用法」看 `components/`。本文件只讲**页面内一块怎么拼**。

## 内容区块（Section）

一致的区块骨架：容器 + 大纵向留白 + 标题簇 + 内容。

```vue
<UContainer class="py-14 sm:py-20">
  <div class="space-y-10">
    <div class="space-y-2">
      <p class="text-sm font-medium uppercase tracking-wide text-muted">分组标签</p>
      <h2 class="text-2xl font-semibold tracking-tight text-highlighted">区块标题</h2>
      <p class="text-muted max-w-2xl">一句话说明。</p>
    </div>
    <!-- 内容 -->
  </div>
</UContainer>
```

## 卡片网格

```vue
<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
  <UCard v-for="item in items" :key="item.id">
    <template #header>
      <h3 class="text-lg font-medium text-highlighted">{{ item.title }}</h3>
    </template>
    <p class="text-muted text-sm">{{ item.desc }}</p>
    <template #footer>
      <UButton variant="ghost" trailing-icon="i-lucide-arrow-right">了解更多</UButton>
    </template>
  </UCard>
</div>
```

- 卡片靠 `border border-default` + `rounded-lg` 定义，而非阴影。
- 列数用响应式（1 → 2 → 3），`gap-6` 保持呼吸感。

## 表单

- 用 `UForm` + `UFormField` 包裹每个字段，`UFormField` 提供 label / 帮助文本 / 错误信息的正确关联（a11y）。
- 校验绑 schema（`UForm` 的 `:schema`），提交用 `@submit`。
- 按钮：主操作 `color="primary"`，次操作 `color="neutral" variant="outline"`；加载态用 `:loading`。
- 详见 `components/forms.md`。

## 空状态（Empty state）

居中图标 + 标题 + 说明 + 主操作：

```vue
<div class="flex flex-col items-center justify-center gap-3 py-16 text-center">
  <UIcon name="i-lucide-inbox" class="size-10 text-dimmed" />
  <h3 class="text-lg font-medium text-highlighted">还没有内容</h3>
  <p class="text-muted text-sm max-w-sm">创建第一条记录后会显示在这里。</p>
  <UButton class="mt-2" icon="i-lucide-plus">新建</UButton>
</div>
```

## 加载态

- 骨架屏用 `USkeleton`（占位块），匹配最终内容的尺寸与圆角。
- 内联/按钮加载用组件的 `:loading` prop。
- 页面级异步：Nuxt 的 `<NuxtLoadingIndicator />` 或区块级 `USkeleton` 网格。
- 详见 `components/feedback.md`。

## 反馈（Toast / Alert）

- 瞬时反馈用 toast：`const toast = useToast(); toast.add({ title, color })`（需要 `app.vue` 里有 `<UApp>`，starter 已具备）。
- 常驻上下文提示用 `UAlert`（`color` 表意：`success`/`warning`/`error`/`info`）。

## 无障碍清单（每屏自检）

- [ ] 每个页面有唯一 `<h1>`，标题层级不跳级。
- [ ] 交互元素可键盘聚焦，聚焦环可见（Nuxt UI 默认提供，不要 `outline-none` 去掉）。
- [ ] 图标按钮有 `aria-label`（见 `ThemeToggle` 的 label）。
- [ ] 表单字段用 `UFormField` 关联 label / 错误信息。
- [ ] 颜色不作为唯一信息载体（状态同时用图标/文字）。
- [ ] 明暗两套都验证对比度（Geist 灰阶已按明暗分别调过，用语义 token 即可继承）。
- [ ] 图片有 `alt`；装饰性图标 `aria-hidden`。

## 不要做

- 不要用重阴影或大圆角堆视觉；靠留白 + 细边框 + 浅表面。
- 不要写死颜色/宽度/间距；用语义 token、`UContainer`、4px scale。
- 不要跳过 `UFormField`/`aria-label` 等 a11y 关联。
