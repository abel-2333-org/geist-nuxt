// 「文档站外壳」demo 的内联假 ViewModel——gallery-private，不进 kit / registry。
//
// 世界观与文案策略：与 sidebar-nav / reference 两个 demo 一致的中文支付世界观
// （四个文档域：支付 / 付款 / 发卡 / 账户），demo 单语（中文）直写、品牌保持
// 中性（不携带任何消费项目品牌、路由或 contract）。消费项目里域的 label /
// description 与页面其余文案一样走 i18n（$t）注入——入口本身天然支持多语言，
// 接线属消费项目职责（见 references/kits/api-docs/project-setup.md）。
//
// 「一份导航数据、多处消费」：每个域的 navGroups 是唯一真源——侧栏、⌘K 全站
// 搜索索引（toSiteSearchGroups 派生）、正文检索切片、正文渲染全部按当前域派生。
// 真实项目里新增一个页面只改一处。
//
// 支付域是完整样板（指南 + reference 式端点页，字段树 + 代码栏），其余三域用
// 紧凑 stub 展示切换的真实效果——真实项目里每个域都长成支付域那样。

export interface DocsShellNavItem {
  label: string
  /**
   * 路由无关的导航目标，由外壳（DocsShell）解析成完整路径：
   * - `#hash` → 域首页锚点（参考长滚动内定位，如 `#checkout-create`）
   * - 无 `#` 前缀 → 指南子页 slug（如 `quickstart` → `/[domain]/quickstart`）
   * 这就是「指南分页、参考长滚动」的数据层体现（见 project-setup.md）。
   */
  to: string
  method?: string
  scenarios?: string[]
  icon?: string
}

export interface DocsShellNavSection {
  label: string
  kind?: 'guide' | 'endpoints'
  icon?: string
  defaultOpen?: boolean
  items: DocsShellNavItem[]
}

export interface DocsShellNavGroup {
  label: string
  sections: DocsShellNavSection[]
}

/** 正文检索切片：⌘K 异步正文搜索的数据源（真实项目由后端检索承担）。 */
export interface DocsShellContentSection {
  title: string
  to: string
  content: string
}

/** stub 域的指南段落（支付域正文是完整样板，不走 stub 渲染）。 */
export interface DocsShellGuideSection {
  id: string
  title: string
  body: string
}

/**
 * 指南子页（支付域）：一页一文、线性阅读，页尾 prev/next 串成学习路径——
 * 与端点参考的「一域长滚动」相对（消费项目对应 @nuxt/content 一个 .md 文件
 * + UContentSurround）。段落里的 `反引号` 片段渲染为内联代码。
 */
export interface DocsShellGuidePage {
  slug: string
  title: string
  description: string
  paragraphs: string[]
  code?: { title: string, variants: { label: string, language: string, code: string }[] }
}

/** 端点紧凑 stub：保证侧栏 / 搜索里的每个锚点在正文都有落点。 */
export interface DocsShellEndpointStub {
  id: string
  method: string
  path: string
  summary: string
  description: string
  /** 操作级生命周期（deprecated 等），驱动 LifecycleBadge / LifecycleNotice。 */
  lifecycle?: EndpointLifecycle
}

/** webhook 紧凑 stub：与端点 stub 同构，identity 是事件名而非 method+path。 */
export interface DocsShellWebhookStub {
  id: string
  /** 事件名，如 `payment.failed`——webhook 的 identity。 */
  event: string
  summary: string
  description: string
}

export interface DocsShellDomainSummary {
  id: string
  label: string
  description: string
  icon: string
}

export interface DocsShellDomain extends DocsShellDomainSummary {
  navGroups: DocsShellNavGroup[]
  contentSections: DocsShellContentSection[]
  guideSections: DocsShellGuideSection[]
  stubs: DocsShellEndpointStub[]
}

/* ===================== 支付域：完整样板的内容数据 ===================== *
 * 字段树 / 请求 / 响应 / 快速开始由 DocsShellReference 消费；形态与
 * reference demo 一致（嵌套 children、enumValues、conditional required）。 */

export const paymentsQuickstartVariants = [
  {
    label: 'cURL',
    language: 'bash',
    code: `curl -X POST https://api.example.com/v1/checkout/sessions \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "amount": 4900, "currency": "CNY" }'`,
  },
  {
    label: 'JavaScript',
    language: 'js',
    code: `const res = await fetch("https://api.example.com/v1/checkout/sessions", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${apiKey}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ amount: 4900, currency: "CNY" }),
})
const session = await res.json()`,
  },
]

/** 支付域指南子页：数组序即阅读序，prev/next 由此推导。 */
export const paymentsGuidePages: DocsShellGuidePage[] = [
  {
    slug: 'quickstart',
    title: '快速开始',
    description: '用测试密钥创建第一个结算会话，完成一笔沙箱支付。',
    paragraphs: [
      '用测试密钥创建一个结算会话，把返回的 `url` 交给顾客即可完成一笔沙箱支付：',
    ],
    code: { title: '创建你的第一个结算会话', variants: paymentsQuickstartVariants },
  },
  {
    slug: 'auth',
    title: '认证与密钥',
    description: '密钥的携带方式、测试与生产环境的区分及存放规范。',
    paragraphs: [
      '所有请求通过 `Authorization: Bearer` 头携带密钥。测试密钥以 `sk_test_` 开头、只操作沙箱数据；生产密钥请存放在服务端环境变量，切勿写进前端代码。',
      '密钥泄露时在控制台一键轮换：旧密钥立即失效，正在处理中的请求不受影响。',
    ],
  },
  {
    slug: 'webhooks',
    title: 'Webhook 通知',
    description: '支付结果的异步送达、签名校验与幂等去重。',
    paragraphs: [
      '支付结果以 Webhook 异步送达（如 `payment.succeeded`、`refund.completed`）。校验签名头后再处理事件，并以事件 id 幂等去重——同一事件可能重复投递。',
      '回调端点返回非 2xx 时按指数退避重试 24 小时；对账兜底请以「查询付款」接口的结果为准。',
    ],
  },
]

export const paymentsEndpoint = {
  method: 'POST',
  path: '/v1/checkout/sessions',
  summary: '创建结算会话',
  lifecycle: 'active' as EndpointLifecycle,
  description:
    '为一次支付或订阅创建托管结算会话。返回会话对象与托管收银台 URL，将顾客重定向到该 URL 完成支付。',
}

/** OperationTarget 的环境列表：生产 + 沙箱，地址随 host 切换重算。 */
export const paymentsHosts = [
  { id: 'production', label: '生产', baseUrl: 'https://api.example.com' },
  { id: 'sandbox', label: '沙箱', baseUrl: 'https://sandbox.example.com' },
]

/**
 * 请求示例按选中环境派生：页面持有选中 host（OperationTarget 的 v-model），
 * 把 baseUrl 传进来生成对应示例——地址栏、复制值与右栏代码永远指向同一环境，
 * 不再各自硬编码。
 */
export function makePaymentsRequestScenarios(baseUrl: string) {
  return [
    {
      id: 'pay',
      label: '一次性支付',
      variants: [
        {
          label: 'cURL',
          language: 'bash',
          code: `curl -X POST ${baseUrl}/v1/checkout/sessions \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 4900,
    "currency": "CNY",
    "successUrl": "https://shop.example.com/thanks"
  }'`,
        },
        {
          label: 'JavaScript',
          language: 'js',
          code: `const res = await fetch("${baseUrl}/v1/checkout/sessions", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${apiKey}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    amount: 4900,
    currency: "CNY",
    successUrl: "https://shop.example.com/thanks",
  }),
})
const session = await res.json()`,
        },
      ],
    },
    {
      id: 'subscription',
      label: '订阅',
      variants: [
        {
          label: 'cURL',
          language: 'bash',
          code: `curl -X POST ${baseUrl}/v1/checkout/sessions \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 4900,
    "currency": "CNY",
    "mode": "subscription",
    "successUrl": "https://shop.example.com/thanks",
    "subscription": { "planId": "plan_basic", "trialDays": 7 }
  }'`,
        },
      ],
    },
  ]
}

export const paymentsResponseScenarios = [
  {
    id: 'pay',
    label: '一次性支付',
    statuses: [
      {
        status: 200,
        statusText: 'OK',
        variants: [
          {
            language: 'json',
            code: `{
  "id": "cs_7Hq3kL",
  "amount": 4900,
  "currency": "CNY",
  "mode": "payment",
  "url": "https://pay.example.com/cs_7Hq3kL",
  "expiresAt": 1720003600000
}`,
          },
        ],
      },
      {
        status: 400,
        statusText: 'Bad Request',
        variants: [
          {
            language: 'json',
            code: `{
  "error": {
    "code": "invalid_amount",
    "message": "Amount must be a positive integer in the smallest currency unit."
  }
}`,
          },
        ],
      },
      {
        status: 401,
        statusText: 'Unauthorized',
        variants: [
          {
            language: 'json',
            code: `{
  "error": { "code": "forbidden", "message": "Missing or invalid token." }
}`,
          },
        ],
      },
    ],
  },
]

export const paymentsBodyFields = [
  {
    path: 'body_amount',
    name: 'amount',
    type: 'integer',
    required: true,
    description: '支付金额，以货币最小单位计（人民币为分）。',
    examples: ['4900'],
    notes: [{ label: 'Rule', text: '必须为正整数。' }],
  },
  {
    path: 'body_currency',
    name: 'currency',
    type: 'enum',
    required: true,
    description: '结算货币。',
    enumValues: [
      { value: 'CNY', description: '人民币。' },
      { value: 'USD', description: '美元。' },
      { value: 'EUR', description: '欧元。' },
    ],
  },
  {
    path: 'body_mode',
    name: 'mode',
    type: 'enum',
    required: false,
    defaultValue: 'payment',
    description: '会话模式：一次性支付或订阅。',
    enumValues: [
      { value: 'payment', description: '一次性支付。' },
      { value: 'subscription', description: '周期性订阅，需同时提供 `subscription` 对象。' },
    ],
  },
  {
    path: 'body_successUrl',
    name: 'successUrl',
    type: 'string',
    required: true,
    description: '支付成功后顾客被重定向到的地址。',
    examples: ['https://shop.example.com/thanks'],
  },
  {
    path: 'body_subscription',
    name: 'subscription',
    type: 'object',
    required: 'conditional' as const,
    condition: '当 `mode` 为 `subscription` 时必填。',
    description: '订阅计划信息。',
    children: [
      {
        path: 'body_subscription_planId',
        name: 'planId',
        type: 'string',
        required: true,
        description: '订阅计划 id。',
        examples: ['plan_basic'],
      },
      {
        path: 'body_subscription_trialDays',
        name: 'trialDays',
        type: 'integer',
        required: false,
        defaultValue: '0',
        description: '试用天数。',
      },
    ],
  },
]

export const paymentsResponseFields = [
  { path: 'res_id', name: 'id', type: 'string', required: true, description: '结算会话唯一 id。', examples: ['cs_7Hq3kL'] },
  { path: 'res_url', name: 'url', type: 'string', required: true, description: '托管收银台地址，将顾客重定向到此完成支付。' },
  { path: 'res_expiresAt', name: 'expiresAt', type: 'integer', format: 'unix_ms', required: true, description: '会话过期时间（毫秒时间戳）。' },
]

export const paymentsEndpointStubs: DocsShellEndpointStub[] = [
  { id: 'pay', method: 'POST', path: '/v1/payments', summary: '发起支付', description: '绕过托管收银台，直接对已保存的支付方式发起一笔支付或订阅扣款。' },
  { id: 'pay-cancel', method: 'DELETE', path: '/v1/payments/{id}', summary: '取消支付', description: '取消一笔尚未捕获的支付或预授权，资金原路解冻。' },
  { id: 'customers', method: 'GET', path: '/v1/customers', summary: '客户管理', description: '分页列出客户及其绑定的支付方式与订阅状态。' },
  { id: 'customer-update', method: 'PATCH', path: '/v1/customers/{id}', summary: '更新客户', description: '更新客户资料或替换默认支付方式，变更即时生效于后续扣款。' },
  { id: 'refund-create', method: 'POST', path: '/v1/refunds', summary: '创建退款', description: '对一笔已捕获的支付发起全额或部分退款。' },
  { id: 'search-refund', method: 'POST', path: '/v1/refunds/search', summary: '搜索退款', description: '按订单号、时间区间或状态检索退款记录。', lifecycle: 'deprecated' },
]

/* ===================== 支付域：Webhook 样板数据 ===================== *
 * webhook 与端点同为 operation（OpenAPI 3.1），identity 换成事件名：正文用
 * <ApiDocsOperationHeader kind="webhook">（EVENT 徽章 + mono 事件名）渲染。 */

export const paymentsWebhook = {
  event: 'payment.succeeded',
  summary: '支付成功',
  description:
    '一笔支付被成功捕获后投递。先校验签名头再处理事件，并以事件 id 幂等去重——同一事件可能重复投递；回调返回非 2xx 时按指数退避重试 24 小时。',
}

/** payload 字段树：形态对齐 paymentsBodyFields（嵌套 children、enumValues）。 */
export const paymentsWebhookPayloadFields = [
  { path: 'evt_id', name: 'id', type: 'string', required: true, description: '事件唯一 id，幂等去重的依据。', examples: ['evt_9Xk2mR'] },
  {
    // 本页只文档化 payment.succeeded 这一个事件（其他事件各有独立页面/stub），
    // 所以 type 收窄为单值常量，与页面 identity 和下方 data 结构保持一致。
    path: 'evt_type',
    name: 'type',
    type: 'enum',
    required: true,
    description: '事件类型。本事件固定为 `payment.succeeded`；其他事件见各自的文档页。',
    enumValues: [
      { value: 'payment.succeeded', description: '支付成功捕获。' },
    ],
  },
  { path: 'evt_createdAt', name: 'createdAt', type: 'integer', format: 'unix_ms', required: true, description: '事件产生时间（毫秒时间戳）。' },
  {
    path: 'evt_data',
    name: 'data',
    type: 'object',
    required: true,
    description: '事件载荷；`payment.succeeded` 的载荷为支付对象。',
    children: [
      { path: 'evt_data_paymentId', name: 'paymentId', type: 'string', required: true, description: '支付唯一 id。', examples: ['pay_3Fq8sN'] },
      { path: 'evt_data_amount', name: 'amount', type: 'integer', required: true, description: '实际捕获金额，以货币最小单位计。' },
      { path: 'evt_data_currency', name: 'currency', type: 'string', required: true, description: '结算货币。', examples: ['CNY'] },
      { path: 'evt_data_sessionId', name: 'sessionId', type: 'string', required: false, description: '关联的结算会话 id（托管收银台路径才有）。' },
    ],
  },
]

export const paymentsWebhookPayloadExample = {
  language: 'json',
  code: `{
  "id": "evt_9Xk2mR",
  "type": "payment.succeeded",
  "createdAt": 1720003600000,
  "data": {
    "paymentId": "pay_3Fq8sN",
    "amount": 4900,
    "currency": "CNY",
    "sessionId": "cs_7Hq3kL"
  }
}`,
}

/** protocol facts：<ApiDocsWebhookProtocol> 的三段协议事实（已本地化的展示数据）。 */
export const paymentsWebhookProtocol = {
  verification: {
    label: 'VERIFICATION',
    description: '每次投递都携带签名头。用密钥重新计算并比对签名，再处理事件。',
    facts: [
      { term: '签名头', value: 'X-Pay-Signature', code: true },
      { term: '算法', value: 'HMAC-SHA256', code: true, note: '对原始请求体计算，编码为十六进制小写。' },
      { term: '密钥来源', value: '控制台 Webhook 设置页生成的 signing secret。' },
      { term: '时效', value: '签名含时间戳，偏差超过 5 分钟应拒绝，防止重放。' },
    ],
  },
  acknowledgement: {
    label: 'ACKNOWLEDGEMENT',
    description: '返回下列响应即视为确认成功；其它响应触发重试。',
    facts: [
      { term: 'HTTP status', value: '200', code: true },
      { term: 'Media type', value: 'application/json', code: true },
      { term: '响应体', value: '固定 JSON 字面量，字段与示例完全一致。' },
    ],
    example: {
      code: '{\n  "received": true\n}',
      language: 'json',
      title: '确认响应体',
    },
  },
  delivery: {
    label: 'DELIVERY',
    description: '未收到成功确认时按退避序列重试，共约 24 小时。',
    facts: [
      { term: '总次数', value: '首次投递 + 最多 8 次重试。' },
      { term: '超时', value: '每次请求 10 秒未响应即视为失败。' },
      { term: '成功条件', value: '任意一次收到上述确认响应即停止重试。' },
    ],
    schedule: {
      term: '重试节奏',
      summary: '从 1 分钟起逐步退避到 12 小时，共 8 次。',
      steps: ['1 分钟', '5 分钟', '30 分钟', '1 小时', '2 小时', '4 小时', '8 小时', '12 小时'],
      expandLabel: (hidden: number) => `展开其余 ${hidden} 档`,
      collapseLabel: '收起',
    },
  },
}

export const paymentsWebhookStubs: DocsShellWebhookStub[] = [
  { id: 'webhook-payment-failed', event: 'payment.failed', summary: '支付失败', description: '支付被拒绝或超时后投递，载荷含失败码与可读原因，便于触发挽回流程。' },
  { id: 'webhook-refund-completed', event: 'refund.completed', summary: '退款完成', description: '退款资金原路退回后投递，对账请以该事件为准而非发起退款的同步响应。' },
  { id: 'webhook-checkout-expired', event: 'checkout.session.expired', summary: '会话过期', description: '结算会话超时未支付后投递，可据此释放库存或引导顾客重新下单。' },
]

/* ===================== 四个文档域 ===================== */

const paymentsNavGroups: DocsShellNavGroup[] = [
  {
    label: '文档',
    sections: [
      {
        label: '指南',
        kind: 'guide',
        icon: 'i-lucide-book-open',
        defaultOpen: true,
        items: [
          { label: '概览', to: '#overview', icon: 'i-lucide-compass' },
          { label: '快速开始', to: 'quickstart', icon: 'i-lucide-rocket' },
          { label: '认证与密钥', to: 'auth', icon: 'i-lucide-key-round' },
          { label: 'Webhook 通知', to: 'webhooks', icon: 'i-lucide-webhook' },
        ],
      },
    ],
  },
  {
    label: 'API 参考',
    sections: [
      {
        label: 'CHECKOUT',
        kind: 'endpoints',
        defaultOpen: true,
        items: [
          { label: '创建结算会话', to: '#checkout-create', method: 'POST', scenarios: ['支付', '订阅'] },
        ],
      },
      {
        label: 'DIRECT API',
        kind: 'endpoints',
        items: [
          { label: '发起支付', to: '#pay', method: 'POST', scenarios: ['支付', '订阅', '授权'] },
          { label: '取消支付', to: '#pay-cancel', method: 'DELETE', scenarios: ['支付', '授权'] },
          { label: '客户管理', to: '#customers', method: 'GET', scenarios: ['订阅', '授权'] },
          { label: '更新客户', to: '#customer-update', method: 'PATCH', scenarios: ['订阅'] },
        ],
      },
      {
        label: '退款',
        kind: 'endpoints',
        items: [
          { label: '创建退款', to: '#refund-create', method: 'POST', scenarios: ['退款'] },
          { label: '搜索退款', to: '#search-refund', method: 'POST', scenarios: ['退款'] },
        ],
      },
      {
        // Webhook 一等身份（item.kind 泛化）是后续 scope；这里 `method: 'EVENT'`
        // 走 MethodBadge 的 fallback（neutral+subtle），渲染效果与 EventBadge
        // 一致——是数据层 stopgap，不是词汇方案的一部分。
        label: 'WEBHOOKS',
        kind: 'endpoints',
        items: [
          { label: '支付成功', to: '#webhook-payment-succeeded', method: 'EVENT', scenarios: ['支付', '订阅'] },
          { label: '支付失败', to: '#webhook-payment-failed', method: 'EVENT', scenarios: ['支付'] },
          { label: '退款完成', to: '#webhook-refund-completed', method: 'EVENT', scenarios: ['退款'] },
          { label: '会话过期', to: '#webhook-checkout-expired', method: 'EVENT', scenarios: ['支付'] },
        ],
      },
    ],
  },
]

export const docsShellDomains: DocsShellDomain[] = [
  {
    id: 'payments',
    label: '支付',
    icon: 'i-lucide-credit-card',
    description: '线上收款、订阅与退款',
    navGroups: paymentsNavGroups,
    contentSections: [
      { title: '概览 · 两条收款路径', to: '#overview', content: '托管收银台适合快速上线，Direct API 适合完全自定义支付体验，两条路径共用同一套密钥与 Webhook。' },
      { title: '认证与密钥 · 密钥存放', to: 'auth', content: '生产密钥请存放在服务端环境变量，切勿写进前端代码；测试密钥以 sk_test_ 开头、只操作沙箱数据。' },
      { title: 'Webhook 通知 · 幂等去重', to: 'webhooks', content: '校验签名头后再处理事件，并以事件 id 幂等去重——同一事件可能重复投递。' },
      { title: '取消支付 · 资金解冻', to: '#pay-cancel', content: '取消一笔尚未捕获的支付或预授权，资金原路解冻。' },
      { title: '支付成功 · payment.succeeded', to: '#webhook-payment-succeeded', content: '一笔支付被成功捕获后投递，先校验签名再以事件 id 幂等去重处理，载荷含支付金额与关联会话。' },
      { title: '会话过期 · checkout.session.expired', to: '#webhook-checkout-expired', content: '结算会话超时未支付后投递，可据此释放库存或引导顾客重新下单。' },
    ],
    guideSections: [], // 支付域正文是完整样板，不走 stub 渲染
    stubs: [],
  },
  {
    id: 'transfer',
    label: '付款',
    icon: 'i-lucide-send',
    description: '向收款人单笔或批量付款',
    navGroups: [
      {
        label: '文档',
        sections: [
          {
            label: '指南',
            kind: 'guide',
            icon: 'i-lucide-book-open',
            defaultOpen: true,
            items: [
              { label: '概览', to: '#overview', icon: 'i-lucide-compass' },
              { label: '收款人管理', to: '#beneficiaries', icon: 'i-lucide-users-round' },
            ],
          },
        ],
      },
      {
        label: 'API 参考',
        sections: [
          {
            label: 'PAYOUTS',
            kind: 'endpoints',
            defaultOpen: true,
            items: [
              { label: '发起付款', to: '#payout-create', method: 'POST', scenarios: ['单笔', '批量'] },
              { label: '查询付款', to: '#payout-list', method: 'GET', scenarios: ['对账'] },
              { label: '创建收款人', to: '#beneficiary-create', method: 'POST', scenarios: ['单笔', '批量'] },
            ],
          },
        ],
      },
    ],
    contentSections: [
      { title: '收款人管理 · 信息校验', to: '#beneficiaries', content: '登记收款人时按币种校验账户要素（IBAN、SWIFT、本地清算号），校验失败的付款不会进入清算。' },
      { title: '发起付款 · 到账时效', to: '#payout-create', content: '主流币种当日到账，跨境路径按清算网络 T+1 起；用 Webhook 跟踪 payout.settled 事件。' },
    ],
    guideSections: [
      { id: 'beneficiaries', title: '收款人管理', body: '付款前先登记收款人：按币种校验账户要素（IBAN、SWIFT、本地清算号），校验通过后获得可复用的收款人 id。' },
    ],
    stubs: [
      { id: 'payout-create', method: 'POST', path: '/v1/payouts', summary: '发起付款', description: '向已登记的收款人发起一笔付款，支持单笔与批量两种模式。' },
      { id: 'payout-list', method: 'GET', path: '/v1/payouts', summary: '查询付款', description: '按状态、时间区间或收款人分页检索付款记录，用于对账。' },
      { id: 'beneficiary-create', method: 'POST', path: '/v1/beneficiaries', summary: '创建收款人', description: '登记收款人账户要素并校验，返回可复用的收款人 id。' },
    ],
  },
  {
    id: 'issuing',
    label: '发卡',
    icon: 'i-lucide-wallet-cards',
    description: '发行与管理虚拟卡、实体卡',
    navGroups: [
      {
        label: '文档',
        sections: [
          {
            label: '指南',
            kind: 'guide',
            icon: 'i-lucide-book-open',
            defaultOpen: true,
            items: [
              { label: '概览', to: '#overview', icon: 'i-lucide-compass' },
              { label: '卡片生命周期', to: '#lifecycle', icon: 'i-lucide-refresh-cw' },
            ],
          },
        ],
      },
      {
        label: 'API 参考',
        sections: [
          {
            label: 'CARDS',
            kind: 'endpoints',
            defaultOpen: true,
            items: [
              { label: '创建卡片', to: '#card-create', method: 'POST', scenarios: ['虚拟卡', '实体卡'] },
              { label: '更新卡片状态', to: '#card-update', method: 'PATCH', scenarios: ['冻结', '注销'] },
              { label: '查询卡交易', to: '#card-transactions', method: 'GET', scenarios: ['对账'] },
            ],
          },
        ],
      },
    ],
    contentSections: [
      { title: '卡片生命周期 · 冻结与恢复', to: '#lifecycle', content: '冻结即时生效、可随时恢复；注销不可逆，注销前未清算的交易仍会正常入账。' },
      { title: '创建卡片 · 虚拟卡即时可用', to: '#card-create', content: '虚拟卡创建后即时可用；实体卡走制卡与邮寄流程，激活前处于 inactive 状态。' },
    ],
    guideSections: [
      { id: 'lifecycle', title: '卡片生命周期', body: '卡片状态在 active、frozen、cancelled 间流转：冻结即时生效、可恢复；注销不可逆，注销前未清算的交易仍会正常入账。' },
    ],
    stubs: [
      { id: 'card-create', method: 'POST', path: '/v1/cards', summary: '创建卡片', description: '为持卡人发行一张虚拟卡或实体卡，虚拟卡即时可用。' },
      { id: 'card-update', method: 'PATCH', path: '/v1/cards/{id}', summary: '更新卡片状态', description: '冻结、恢复或注销一张卡片，冻结即时生效。' },
      { id: 'card-transactions', method: 'GET', path: '/v1/cards/{id}/transactions', summary: '查询卡交易', description: '分页查询单卡的授权与清算记录，用于对账。' },
    ],
  },
  {
    id: 'account',
    label: '账户',
    icon: 'i-lucide-landmark',
    description: '余额、对账单与子账户',
    navGroups: [
      {
        label: '文档',
        sections: [
          {
            label: '指南',
            kind: 'guide',
            icon: 'i-lucide-book-open',
            defaultOpen: true,
            items: [
              { label: '概览', to: '#overview', icon: 'i-lucide-compass' },
              { label: '余额与对账', to: '#reconciliation', icon: 'i-lucide-scale' },
            ],
          },
        ],
      },
      {
        label: 'API 参考',
        sections: [
          {
            label: 'ACCOUNT',
            kind: 'endpoints',
            defaultOpen: true,
            items: [
              { label: '查询余额', to: '#balance-list', method: 'GET', scenarios: ['对账'] },
              { label: '下载对账单', to: '#statement-download', method: 'GET', scenarios: ['对账'] },
              { label: '创建子账户', to: '#sub-account-create', method: 'POST', scenarios: ['多业务线'] },
            ],
          },
        ],
      },
    ],
    contentSections: [
      { title: '余额与对账 · 三类余额', to: '#reconciliation', content: '余额分可用、待结算、冻结三类；对账单按自然日切割，T+1 早晨生成前一日全量流水。' },
    ],
    guideSections: [
      { id: 'reconciliation', title: '余额与对账', body: '余额分可用、待结算、冻结三类；对账单按自然日切割，T+1 早晨生成前一日全量流水，按流水号与业务侧订单一一对齐。' },
    ],
    stubs: [
      { id: 'balance-list', method: 'GET', path: '/v1/balances', summary: '查询余额', description: '按币种返回可用、待结算与冻结三类余额快照。' },
      { id: 'statement-download', method: 'GET', path: '/v1/statements', summary: '下载对账单', description: '按自然日下载全量资金流水，支持 CSV 与 JSON 两种格式。' },
      { id: 'sub-account-create', method: 'POST', path: '/v1/sub-accounts', summary: '创建子账户', description: '按业务线或站点开设子账户，资金独立核算、汇总入主账户。' },
    ],
  },
]

/* ===================== 派生消费 ===================== */

/** ⌘K 全站搜索索引：由侧栏 groups 派生（一份数据、两处消费）。
 *  method / scenarios 原样带过去，让 ⌘K 面板与侧栏过滤匹配同样的维度。 */
export function toSiteSearchGroups(domain: DocsShellDomain) {
  return domain.navGroups.map((group, i) => ({
    id: `g${i}-${group.label}`,
    label: group.label,
    items: group.sections.flatMap(section => section.items.map(item => ({
      label: item.label,
      to: item.to,
      method: item.method,
      scenarios: item.scenarios,
      icon: item.icon ?? section.icon,
    }))),
  }))
}

/** ⌘K 的异步正文检索（模拟网络往返，展示 loading 态与竞态丢弃；真实项目由
 *  后端检索承担）。按空白分词、逐词求交（AND）——对齐静态索引的 token 搜索
 *  行为，「幂等 去重」也能命中同一切片；真实检索后端通常也是这个语义。 */
export async function searchDocsBody(domain: DocsShellDomain, query: string) {
  await new Promise(resolve => setTimeout(resolve, 250))
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return []
  return domain.contentSections
    .filter((s) => {
      const haystack = `${s.title} ${s.content}`.toLowerCase()
      return tokens.every(t => haystack.includes(t))
    })
    .map(s => ({ label: s.title, to: s.to, suffix: s.content, icon: 'i-lucide-text' }))
}
