# CodeSample `<ApiCodeSample>`

自包含多语言代码块（UTabs + 复制），无语法高亮器依赖。

## Props

| 用法 | prop | 说明 |
|---|---|---|
| 多语言（标签） | `variants?: { label; language?; code }[]` | 每个 variant 一个标签 |
| 单例快捷 | `code` + `language?` + `title?` | 单块代码 |

## 关键点

- **多语言用 `variants`**（不是 `samples`——prop 名务必对上，否则回退单例、显示空占位）。
- `UTabs` **必须用 string value 受控**（Reka UI 按 identity 比较）：`active = ref('0')`，tabItems 的 `value` 也用 `String(i)`。曾因用 computed getter/setter 做 String↔Number 转换导致切换失效。
- header：terminal 图标 + 标签/文件名 + 复制按钮（copied 态图标切 check、`aria-label` 动态 + `role=status` live region）。
- **无语法高亮器**：Geist 代码块偏冷静近单色，`<pre><code>` 直出即可，不引入 Shiki（避免 content/SQLite 那套重量级依赖）。

## 用法

```vue
<!-- 多语言 -->
<ApiCodeSample :variants="[
  { label: 'cURL', language: 'bash', code: 'curl ...' },
  { label: 'JavaScript', language: 'js', code: 'await fetch(...)' },
]" />

<!-- 单例 -->
<ApiCodeSample :code="'{ \"ok\": true }'" language="json" title="response.json" />
```

## 规格与源码

- 规格模板见 `method/component-spec-template.md`。
- 源码：`assets/kits/api-docs/components/CodeSample.vue`。
