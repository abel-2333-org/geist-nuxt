# ParamsTable `<ApiParamsTable>`

请求参数表：名称 / 类型 / required / 说明。

## Props

| prop | 类型 | 说明 |
|---|---|---|
| `params` | `{ name; type; required?; description? }[]` | 参数列表 |

## 关键点

- 真实语义 `<table>` + `<th scope="col">` 表头（无障碍：表头与单元格正确关联）。
- required 用 `UBadge color="error"` + 文本「Required / Optional」双通道，不只靠颜色。
- 类型列用 `font-mono text-muted`。

## 用法

```vue
<ApiParamsTable :params="[
  { name: 'name', type: 'string', required: true, description: '部署名称' },
  { name: 'target', type: 'string', description: '目标环境' },
]" />
```

## 规格与源码

- 规格模板见 `method/component-spec-template.md`。
- 源码：`assets/kits/api-docs/components/ParamsTable.vue`。
