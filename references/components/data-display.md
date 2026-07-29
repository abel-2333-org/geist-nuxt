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

## SemanticBadge

语义 tone 原子（foundation），建于 `UBadge` 之上。**它只认 tone，不认业务**——把"某个域值 → tone"的映射留给 preset（如 api-docs kit 的 LifecycleBadge / HttpMethodBadge）。**props**：`tone`(`success`/`warning`/`neutral`/`error`/`info`/`secondary`) `label` `icon?` `variant?`(默认 `subtle`) `size?`。tone 全集与 tone→色映射的唯一权威是 `foundation/utils/badge.ts` 的 `BADGE_TONE_COLOR`（`Record<BadgeTone, …>`，新增 tone 漏配即编译报错）；组件读该表而非透传。tone→色是设计系统的语义校准；语义绝不只靠颜色，务必配 `icon` + 文本。
```vue
<SemanticBadge tone="warning" label="Deprecated" icon="i-lucide-alert-triangle" />
```

## InlineCode

行内代码 token（foundation），落在浅色 tonal 表面。委托 Nuxt UI 的 `ProseCode`（`ui.prose: true`，无需 @nuxt/content），仅覆盖两处回到 Geist 基础：圆角回控件档（`rounded-sm`，6px）、字号 Copy 13 Mono。用于正文里的示例值 / 默认值 / 允许值。
```vue
将 <InlineCode>timeout_ms</InlineCode> 设为如 <InlineCode>3000</InlineCode>。
```

## InlineMarkdown

行内 markdown 子集渲染器（foundation）：同步、SSR 稳定。由 `marked` 负责 CommonMark inline tokenization，仅将 `` `code` ``、`[链接](url)`、`**粗**` / `__粗__`、`*斜*` / `_斜_`、`***粗斜***` / `___粗斜___`、`~~删除~~` 映射到设计系统组件；解析递归可嵌套。**props**：`text`(string)。仅面向"永远是行内"的作者文案——比 MDC 轻、且不会在一页多实例时触发 SSR→client hydration 失配；若真需要块级 markdown 再使用块级 renderer。

**技术文本边界**：`snake_case`、Unicode 标识符和数值分隔符按 CommonMark 保持字面；adapter 还会将两侧都紧邻词字符的单星号 emphasis 降回原文，避免把 `2*3*4`、`foo*bar*baz` 或 `参数*必填*说明` 当成格式。正则和 glob 常用的反斜杠也原样保留（如 `^\d{3}\*$`、`C:\*.txt`）。其它闭合且受支持的定界符会被渲染；未匹配或超出的定界符仍是字面文本，因此不能以“输出中没有 `*` / `_`”作为正确性判断。

**安全白名单**：只有显式的 `[label](url)` 且协议为站内相对地址、`http:`、`https:` 或 `mailto:` 时才生成链接；HTML、image、autolink 与不安全协议均按原始文本显示。组件不使用 `v-html`，也不把 `marked` 的 HTML 输出注入页面。

```vue
<InlineMarkdown text="支持 **粗体**、`code` 和 [链接](https://vercel.com)。" />
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
- 基础用法：`app/components/gallery/showcase/Foundations.vue`；反馈组合 specimen：`app/components/gallery/showcase/Compositions.vue`
