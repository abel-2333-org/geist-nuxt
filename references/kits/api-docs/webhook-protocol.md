# WebhookProtocol `<WebhookProtocol>`

连贯呈现一个 webhook 的 **Verification / Acknowledgement / Delivery** 三段协议事实，是 `OperationHeader`（`kind="webhook"`）的**正文伙伴**：header 管 identity（事件名、语义摘要），本件管「怎么验证、怎么确认、怎么投递重试」。三段共享同一套排版骨架（`FieldGroup` 段头 + `<dl>` 事实行），读者在一处顺序读完整套协议约定，而不是散落在三处各自发明的排版里。

> 真源在 `kits/api-docs/components/WebhookProtocol.vue`（+ `kits/api-docs/utils/webhook-protocol.ts` 和 `kits/api-docs/internal/Fact*.vue`）；registry 将公共组件复制到 `app/components/WebhookProtocol.vue`，并将事实排版 helper 复制到 `app/internal/`。公共组件通过显式相对路径使用 internal helper，模板名仍稳定为 `<WebhookProtocol>`，helper 不形成可单独请求的公共 API。数据无关、locale-ready：label、term、value、总结句由调用方以**已本地化文本**注入（展开/收起按钮提供可覆盖的英文默认文案，结构 chrome 惯例）；组件不解析 Contract、不实现签名或重试逻辑。

## Anatomy（结构）

```
root（无外框列，space-y 分段；外框/留白归页面布局）
└─ section ×0..3（未提供的 section 整段省略——绝不渲染空卡片或 "none"）
   ├─ header       ── FieldGroup（mono 大写 label + headingLevel 接入大纲）
   ├─ description  ── 可选导语（text-muted）
   ├─ facts <dl>   ── term/value 行；format 决定 value 呈现
   │                  （text / code / inline-markdown）；可选 note（始终纯文本）
   ├─ ACK 专属     ── 可选 CodeBlock example（仅 literal 语义且确有文本 body）
   └─ Delivery 专属── 可选 schedule 行：总结句是可访问真源；
                      chips 为视觉序列，长序列折叠为带动作文案的展开/收起按钮
```

组件根不拥有边框、圆角或内边距——standalone demo / 参考页的父布局负责 chrome，嵌套时不产生双边框。

## 四条核心呈现规则

1. **section 省略**：三段各自独立出现或省略。契约没写的段**整段不出现**，绝不渲染空卡片、占位符或 "none" 行——只传 `label` 或空 `facts` 也不算正文；至少要有 description、fact、ACK example 或 delivery schedule 才进入文档大纲。
2. **ACK body 三语义**由数据形状表达，不靠额外的 mode 枚举：
   - **literal**（固定字面 body）→ 传 `example`，用 CodeBlock 展示精确文本；
   - **echo**（回显请求参数）→ 不传 `example`，用 facts 行文字说明、`format: 'code'` 呈现被回显的参数名；
   - **intentional empty**（约定就是空）→ facts 行明说「空。返回任何内容都会被忽略。」——明说，而不是留白。
3. **schedule 双层呈现**：调用方给的**总结句**（如「从 1 分钟起逐步退避到 12 小时，共 8 次」）是屏幕阅读器与拷贝场景的**真源**；`steps` chips 只是视觉序列（逐个 `aria-hidden`），超过 `maxScheduleSteps` 折叠为前 N-1 个 + 展开按钮。按钮**可见文案即可访问名**（WCAG 2.5.3 Label in Name，不再有 `aria-label` 与视觉文案分裂）：由 `expandLabel`/`collapseLabel` 注入已本地化动作文案，未注入时回退英文默认 `Show N more` / `Show less`；chevron 图标纯装饰。不传 `steps` 就只显示总结句（适合均匀间隔）。
4. **rich fact 明确 opt-in**：fact 渲染行为只由 `format` 字段驱动，**绝不由 value 内容触发**——默认 `'text'` 纯文本，任何 markdown 语法字面保留；`'code'` 整值 InlineCode；`'inline-markdown'` 经 `InlineMarkdown` 安全子集渲染（code / strong / em / del / internal & external link），internal link 走客户端路由并支持键盘 focus 与 Cmd/Ctrl-click，unsafe scheme 与 raw HTML 不会被执行。`note` 始终纯文本。不提供旧字段别名，避免两套输入契约长期并存。

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
type WebhookProtocolFactFormat = 'text' | 'code' | 'inline-markdown'

interface WebhookProtocolFact {
  term: string    // 事实名（已本地化），如 '签名头'
  value: string   // 主值（已本地化文案或字面 token）；serializable string，不接受 raw HTML
  format?: WebhookProtocolFactFormat // 默认 'text'；'inline-markdown' 为明确 opt-in 的安全富文本
  note?: string   // 可选补充说明，始终纯文本
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
  expandLabel?: (hidden: number) => string  // 展开按钮可见文案兼可访问名（已本地化）；默认 'Show N more'
  collapseLabel?: string              // 收起按钮可见文案兼可访问名（已本地化）；默认 'Show less'
}
```

## A11y

- `headingLevel` 接入文档大纲（`FieldGroup` 先例）；DOM 顺序 = 阅读顺序。
- facts 用 `<dl>`/`<dt>`/`<dd>` 语义；schedule 行同样是一个 `<dt>`/`<dd>` 对。
- schedule chips 与箭头**逐个** `aria-hidden`（视觉冗余，真源是总结句）；展开按钮可聚焦，故 `aria-hidden` 不落在容器上。
- 展开按钮带 `aria-expanded`，**可见文案即可访问名**（Label in Name，语音控制用户念出所见文字即可触发），chevron 图标纯装饰；**展开时 `<dd>` 内追加一段 `sr-only` 全序列文本**（以 ' → ' 连接 steps），保证 `aria-expanded` 状态切换对屏幕阅读器有可感知的内容变化——折叠态的可访问真源仍是总结句，不重复播报。不用纯颜色传意；`focus-visible` 由 UButton 提供。
- rich fact（`format: 'inline-markdown'`）的链接由 `InlineMarkdown` → ProseA/ULink 提供键盘 focus、客户端路由与 Cmd/Ctrl-click；unsafe scheme 与 raw HTML 在解析层即被拒绝。

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

切片含公共组件、`webhook-protocol.ts`（section 正文判定与折叠派生纯函数，`tests/webhook-protocol.test.mjs` 覆盖），以及只负责 `<dl>/<dt>/<dd>` 结构和容器回流的 `FactList.vue` / `FactRow.vue` internal helper。后两者复制到 `app/internal/`，由 `WebhookProtocol.vue` 显式相对导入，不增加公共组件面。rich fact 的 `format` 判别刻意留在 WebhookProtocol（经 `#value` slot），不下沉 FactRow——避免所有含 FactRow 的切片连带 `foundation-inline-markdown` 依赖；待第二个已采纳组件真实需要 rich fact 时再评估下沉（见 #76）。依赖闭包：`geist-foundation`、`foundation-inline-code`、`foundation-inline-markdown`、`api-docs-field-group`、`api-docs-code-block`。

Demo：`/kits/api-docs/webhook-protocol`（本页内联中性 fixture；变体演示省略规则、ACK 三语义、schedule 边界与窄屏长内容 stress）。
