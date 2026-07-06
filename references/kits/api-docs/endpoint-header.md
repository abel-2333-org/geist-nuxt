# EndpointHeader `<ApiEndpointHeader>`

HTTP 端点的标题行：method badge + 路径 + 描述。

## Props

| prop | 类型 | 说明 |
|---|---|---|
| `method` | `string` | HTTP 方法（GET/POST/PUT/PATCH/DELETE…） |
| `path` | `string` | 端点路径，如 `/v1/deployments` |
| `description?` | `string` | 端点说明 |

## 关键点

- method → 语义色映射：`GET`=info、`POST`=success、`PUT/PATCH`=warning、`DELETE`=error，其余 neutral。
- **不只靠颜色**：method 文本本身就是 verb，色仅作强化（无障碍双通道）。
- path 用 `font-mono text-highlighted`。

## 用法

```vue
<ApiEndpointHeader method="POST" path="/v1/deployments" description="创建一个新的部署。" />
```

## 规格与源码

- 规格化流程见 `method/component-spec-template.md`，落地范例见 `method/spec-example.md`（就是以本组件为例）。
- 源码：`assets/kits/api-docs/components/EndpointHeader.vue`。
