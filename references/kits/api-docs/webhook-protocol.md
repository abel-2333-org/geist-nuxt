# ApiDocsWebhookProtocol `<ApiDocsWebhookProtocol>`

连贯呈现一个 webhook 的 **Verification / Acknowledgement / Delivery** 三段协议事实，是 `OperationHeader`（`kind="webhook"`）的**正文伙伴**：header 管 identity（事件名、语义摘要），本件管「怎么验证、怎么确认、怎么投递重试」。三段共享同一套排版骨架（`FieldGroup` 段头 + `<dl>` 事实行），读者在一处顺序读完整套协议约定，而不是散落在三处各自发明的排版里。

> 真源在 `kits/api-docs/components/WebhookProtocol.vue`（+ `kits/api-docs/utils/webhook-protocol.ts`）；根 registry target 保留 `app/components/api-docs/WebhookProtocol.vue`，所以模板名是 `<ApiDocsWebhookProtocol>`。数据无关、locale-ready：label、term、value、总结句由调用方以**已本地化文本**注入（展开/收起按钮提供可覆盖的英文默认文案，结构 chrome 惯例）；组件不解析 Contract、不实现签名或重试逻辑。

## Anatomy（结构）

```
root（无外框列，space-y 分段；外框/留白归页面布局）
└─ section ×0..3（未提供的 section 整段省略——绝不渲染空卡片或 "none"）
   ├─ header       ── ApiDocsFieldGroup（mono 大写 label + headingLevel 接入大纲）
   ├─ description  ── 可选导语（text-muted）
   ├─ facts <dl>   ── term/value 行；value 可为 InlineCode token；可选 note
   ├─ ACK 专属     ── 可选 CodeBlock example（仅 literal 语义且确有文本 body）
   └─ Delivery 专属── 可选 schedule 行：总结句是可访问真源；
                      chips 为视觉序列，长序列折叠 +N、可展开/收起
```

组件根不拥有边框、圆角或内边距——standalone demo / 参考页的父布局负责 chrome，嵌套时不产生双边框。

## 三条核心呈现规则

1. **section 省略**：三段各自独立出现或省略。契约没写的段**整段不出现**，绝不渲染空卡片、占位符或 "none" 行——只传 `label` 或空 `facts` 也不算正文；至少要有 description、fact、ACK example 或 delivery schedule 才进入文档大纲。
2. **ACK body 三语义**由数据形状表达，不靠额外的 mode 枚举：
   - **literal**（固定字面 body）→ 传 `example`，用 CodeBlock 展示精确文本；
   - **echo**（回显请求参数）→ 不传 `example`，用 facts 行文字说明、`code: true` 呈现被回显的参数名；
   - **intentional empty**（约定就是空）→ facts 行明说「空。返回任何内容都会被忽略。」——明说，而不是留白。
3. **schedule 双层呈现**：调用方给的**总结句**（如「从 1 分钟起逐步退避到 12 小时，共 8 次」）是屏幕阅读器与拷贝场景的**真源**；`steps` chips 只是视觉序列（逐个 `aria-hidden`），超过 `maxScheduleSteps` 折叠为前 N-1 个 + `+N` 展开按钮（`aria-expanded`，可访问名由 `expandLabel`/`collapseLabel` 注入）。不传 `steps` 就只显示总结句（适合均匀间隔）。

## Props

| prop | 类型 | 说明 |
|---|---|---|
| `verification` | `WebhookProtocolSectionData` | 验证段。省略则整段不渲染 |
| `acknowledgement` | `WebhookProtocolSectionData & { example?: WebhookProtocolAckExample }` | 确认段；`example` 仅 literal 语义时提供 |
| `delivery` | `WebhookProtocolSectionData & { schedule?: WebhookProtocolSchedule }` | 投递段；`schedule` 行渲染在 facts 之后 |
| `headingLevel` | `2 \| 3 \| 4` | 段头接入文档大纲；默认 `2`（standalone），嵌在 h2 操作标题下传 `3` |
| `maxScheduleSteps` | `number` | schedule chips 正整数折叠阈值，默认 `6`：超过则铺前 5 个 + 展开按钮；传 `1` 时初始不铺 chip，仍保留展开按钮；非法值安全退化为不折叠 |

### 数据模型（内联，随切片走）

```ts
interface WebhookProtocolFact {
  term: string    // 事实名（已本地化），如 '签名头'
  value: string   // 主值（已本地化文案或字面 token）
  code?: boolean  // value 以 InlineCode（mono token）呈现，用于 header 名、参数名等字面值
  note?: string   // 可选补充说明
}
interface WebhookProtocolSectionData {
  label: string           // 段标题（已本地化），mono 大写呈现
  description?: string    // 可选导语
  facts?: WebhookProtocolFact[]  // 未知事实直接不传对应行
}
interface WebhookProtocolAckExample {
  code: string       // ACK 文本 body 字面值
  language?: string  // 默认 'json'
  title?: string     // CodeBlock 工具栏标题（已本地化）
  labels?: ApiCodeLabels // 内嵌 CodeBlock 的按钮、反馈与空态文案（已本地化）
}
interface WebhookProtocolSchedule {
  term: string                        // 行名（已本地化），如 '重试节奏'
  summary: string                     // 总结句——schedule 的可访问文本真源
  steps?: string[]                    // 逐次间隔短文本（如 '5 分钟'），纯视觉；省略则只显示总结句
  expandLabel?: (hidden: number) => string  // 展开按钮可访问名（已本地化）
  collapseLabel?: string              // 收起按钮文案（已本地化）
}
```

## A11y

- `headingLevel` 接入文档大纲（`FieldGroup` 先例）；DOM 顺序 = 阅读顺序。
- facts 用 `<dl>`/`<dt>`/`<dd>` 语义；schedule 行同样是一个 `<dt>`/`<dd>` 对。
- schedule chips 与箭头**逐个** `aria-hidden`（视觉冗余，真源是总结句）；展开按钮可聚焦，故 `aria-hidden` 不落在容器上。
- 展开按钮带 `aria-expanded` 与可访问名；**展开时 `<dd>` 内追加一段 `sr-only` 全序列文本**（以 ' → ' 连接 steps），保证 `aria-expanded` 状态切换对屏幕阅读器有可感知的内容变化——折叠态的可访问真源仍是总结句，不重复播报。不用纯颜色传意；`focus-visible` 由 UButton 提供。

## 与相邻组件的分工

| 组件 | 职责 | 不做 |
|---|---|---|
| `OperationHeader`（kind="webhook"） | webhook 的 identity：事件名 + EVENT 徽章 + 摘要 | 协议事实 |
| **`WebhookProtocol`** | 三段协议事实的 IA、省略规则与 a11y | 解析 Contract、实现签名/重试逻辑 |
| `ResponseExample` | API 端点**响应**的 status/body 建模 | ACK body（它不是端点响应，勿强行复用） |
| `FieldGroup` | 段头排版原语（本件复用） | — |

## Registry

```bash
pnpm geist:copy -- geist-foundation api-docs-webhook-protocol --target <consumer> --to <checkout-40-char-sha>
```

切片含组件 + `webhook-protocol.ts`（section 正文判定与折叠派生纯函数，`tests/webhook-protocol.test.mjs` 覆盖）。依赖闭包：`geist-foundation`、`foundation-inline-code`、`api-docs-field-group`、`api-docs-code-block`。

Demo：`/kits/api-docs/webhook-protocol`（本页内联中性 fixture；变体演示省略规则、ACK 三语义与 schedule 边界）。
