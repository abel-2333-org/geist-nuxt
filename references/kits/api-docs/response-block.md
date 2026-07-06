# ResponseBlock `<ApiResponseBlock>`

响应块：状态码 badge + 响应 body（body 委托给 `<ApiCodeSample>`）。

## Props

| prop | 类型 | 说明 |
|---|---|---|
| `status` | `number` | HTTP 状态码 |
| `statusText?` | `string` | 状态说明文字 |
| `body` | `string` | 响应体内容 |
| `language?` | `string` | body 语言，默认 `json` |
| `title?` | `string` | 代码块标题，默认 `response.json` |

## 关键点

- 状态码 → 色：2xx=success、3xx=info、4xx=warning、5xx=error（色 + 数字/文本双通道）。
- body 委托给 `<ApiCodeSample>` 单例路径（`:code` / `:language` / `:title`）。
- **prop 名用 `body` 而非 `code`**（对齐易错点）。

## 用法

```vue
<ApiResponseBlock :status="200" status-text="部署已创建。" :body="responseBody" language="json" />
```

## 规格与源码

- 规格模板见 `method/component-spec-template.md`。
- 源码：`assets/kits/api-docs/components/ResponseBlock.vue`。
