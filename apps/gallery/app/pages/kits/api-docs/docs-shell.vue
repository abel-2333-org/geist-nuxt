<script setup lang="ts">
definePageMeta({ nav: { label: '文档站外壳', icon: 'i-lucide-layout-template', order: 3 } })

// API 文档场景的「文档站外壳」整页 demo（不是可分发切片）——把三块拼成一个
// 完整可用的文档站骨架，作为下游 copy & adapt 的活样板：
//
//   顶栏     品牌 + <ApiDocsSiteSearch>（⌘K 全站搜索，真实可用）
//   侧栏     <ApiDocsSidebarNav>（sticky，树内过滤 + 拖宽）
//   正文     指南锚点 section + reference 式端点页（字段树 + 代码栏）
//
// 三层搜索/导航各司其职、不互相顶替：
//   1. 顶栏 ⌘K 全站搜索 —— 「从任何地方去任何页面」（跨指南与端点）；
//   2. 侧栏 '/' 树内过滤 —— 「在当前菜单里快速缩小范围」；
//   3. 字段树深链接（useFieldAnchor）—— 「直达端点里的某个字段」。
// 两级搜索刻意匹配同样的维度（用途名 / 请求方法 / 场景标签），读者对「什么可
// 被搜到」的心智模型在两层都成立。
//
// 「一份导航数据、两处消费」：侧栏的 groups 是唯一真源，全站搜索的索引由它
// 派生（见 toSearchGroups）——真实项目里新增一个页面只改一处。
// 数据一律由本页内联假 ViewModel 驱动（payments 世界观，与 sidebar-nav /
// reference 两个 demo 一致），不写进 kit。

// --- 侧栏导航数据（唯一真源；每个锚点在正文都有落点——#checkout-create 是
//     完整 reference，其余端点是紧凑 stub，见页尾说明） ---
type NavItem = { label: string; to?: string; method?: string; scenarios?: string[]; icon?: string; badge?: string | number }
type NavSection = { label: string; kind?: 'guide' | 'endpoints'; icon?: string; defaultOpen?: boolean; items: NavItem[] }
type NavGroup = { label?: string; sections: NavSection[] }

const navGroups: NavGroup[] = [
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
          { label: '快速开始', to: '#quickstart', icon: 'i-lucide-rocket' },
          { label: '认证与密钥', to: '#auth', icon: 'i-lucide-key-round' },
          { label: 'Webhook 通知', to: '#webhooks', icon: 'i-lucide-webhook' },
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
    ],
  },
]

// --- 全站搜索索引：由侧栏 groups 派生（一份数据、两处消费）。
//     指南 section 折叠进「文档」组，端点 section 折叠进「API 参考」组；
//     method/scenarios 原样带过去，让 ⌘K 面板与侧栏过滤匹配同样的维度。 ---
type SearchItem = { label: string; to: string; method?: string; scenarios?: string[]; icon?: string }
type SearchGroup = { id: string; label: string; items: SearchItem[] }

function toSearchGroups(groups: NavGroup[]): SearchGroup[] {
  return groups.map((group, i) => ({
    id: `g${i}-${group.label ?? 'group'}`,
    label: group.label ?? '',
    items: group.sections.flatMap(section =>
      section.items
        .filter((item): item is NavItem & { to: string } => Boolean(item.to))
        .map(item => ({
          label: item.label,
          to: item.to,
          method: item.method,
          scenarios: item.scenarios,
          icon: item.icon ?? section.icon,
        })),
    ),
  }))
}

const searchGroups = toSearchGroups(navGroups)

// --- 正文全文检索（SiteSearch 异步引擎 demo）：模拟消费项目的正文切片检索。
//     真实项目里 searchContent 换成 @nuxt/content 的 useSearchCollection、
//     自建搜索接口等；组件侧的防抖、竞态丢弃、loading、结果组渲染完全一致。
//     静态索引（searchGroups）与异步结果并存：条目级导航搜前者，正文片段搜
//     后者（接法沉淀在 site-search.md「正文检索」）。 ---
type ContentSection = { title: string; to: string; content: string }
const contentSections: ContentSection[] = [
  { title: '概览 · 两条收款路径', to: '#overview', content: '托管收银台适合快速上线，Direct API 适合完全自定义支付体验，两条路径共用同一套密钥与 Webhook。' },
  { title: '认证与密钥 · 密钥存放', to: '#auth', content: '生产密钥请存放在服务端环境变量，切勿写进前端代码；测试密钥以 sk_test_ 开头、只操作沙箱数据。' },
  { title: 'Webhook 通知 · 幂等去重', to: '#webhooks', content: '校验签名头后再处理事件，并以事件 id 幂等去重——同一事件可能重复投递。' },
  { title: '取消支付 · 资金解冻', to: '#pay-cancel', content: '取消一笔尚未捕获的支付或预授权，资金原路解冻。' },
]

async function searchContent(query: string) {
  // 模拟网络往返，展示 loading 态与竞态丢弃（真实项目由后端检索承担）
  await new Promise(resolve => setTimeout(resolve, 250))
  const q = query.trim().toLowerCase()
  if (!q) return []
  return contentSections
    .filter(s => s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q))
    .map(s => ({ label: s.title, to: s.to, suffix: s.content, icon: 'i-lucide-text' }))
}

// --- 快速开始示例（指南正文里的普通代码块） ---
const quickstartVariants = [
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

// --- 端点：创建结算会话（正文里唯一的 <h1>） ---
const endpoint = {
  method: 'POST',
  path: '/v1/checkout/sessions',
  summary: '创建结算会话',
  description:
    '为一次支付或订阅创建托管结算会话。返回会话对象与托管收银台 URL，将顾客重定向到该 URL 完成支付。',
}

const requestScenarios = [
  {
    id: 'pay',
    label: '一次性支付',
    variants: [
      {
        label: 'cURL',
        language: 'bash',
        code: `curl -X POST https://api.example.com/v1/checkout/sessions \\
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
        code: `const res = await fetch("https://api.example.com/v1/checkout/sessions", {
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
]

const responseScenarios = [
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
    ],
  },
]

const bodyFields = [
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

const responseFields = [
  { path: 'res_id', name: 'id', type: 'string', required: true, description: '结算会话唯一 id。', examples: ['cs_7Hq3kL'] },
  { path: 'res_url', name: 'url', type: 'string', required: true, description: '托管收银台地址，将顾客重定向到此完成支付。' },
  { path: 'res_expiresAt', name: 'expiresAt', type: 'integer', format: 'unix_ms', required: true, description: '会话过期时间（毫秒时间戳）。' },
]

// --- 其余端点的紧凑 stub（保证侧栏/搜索里的每个锚点都有落点；完整 reference
//     形态见上方 #checkout-create，真实项目里每个端点都长成那样） ---
const endpointStubs = [
  { id: 'pay', method: 'POST', path: '/v1/payments', summary: '发起支付', description: '绕过托管收银台，直接对已保存的支付方式发起一笔支付或订阅扣款。' },
  { id: 'pay-cancel', method: 'DELETE', path: '/v1/payments/{id}', summary: '取消支付', description: '取消一笔尚未捕获的支付或预授权，资金原路解冻。' },
  { id: 'customers', method: 'GET', path: '/v1/customers', summary: '客户管理', description: '分页列出客户及其绑定的支付方式与订阅状态。' },
  { id: 'customer-update', method: 'PATCH', path: '/v1/customers/{id}', summary: '更新客户', description: '更新客户资料或替换默认支付方式，变更即时生效于后续扣款。' },
  { id: 'refund-create', method: 'POST', path: '/v1/refunds', summary: '创建退款', description: '对一笔已捕获的支付发起全额或部分退款。' },
  { id: 'search-refund', method: 'POST', path: '/v1/refunds/search', summary: '搜索退款', description: '按订单号、时间区间或状态检索退款记录。' },
]

// 深链接：带 `#path` 进入时自动展开 + 滚动定位到对应字段。
const anchor = useFieldAnchor()
onMounted(() => anchor.initFromHash())
</script>

<template>
  <div>
    <UContainer class="pt-16 pb-10 sm:pt-24">
      <div class="space-y-2">
        <h2 class="text-2xl font-semibold tracking-tight text-highlighted">文档站外壳</h2>
        <p class="max-w-2xl text-muted">
          把 kit 的三块拼成一个完整文档站骨架：<b class="font-medium text-toned">顶栏</b>（品牌 +
          <code class="font-mono text-[0.8125rem]">ApiDocsSiteSearch</code> 全站搜索）、<b class="font-medium text-toned">侧栏</b>（<code class="font-mono text-[0.8125rem]">ApiDocsSidebarNav</code>）与
          <b class="font-medium text-toned">正文</b>（指南 + reference 式端点页）。三层导航各司其职：顶栏
          <UKbd value="meta" /><UKbd value="K" /> 是<b class="font-medium text-toned">全站搜索</b>（跨指南与端点，同时匹配用途名、请求方法与场景标签），侧栏
          <UKbd value="/" /> 是<b class="font-medium text-toned">树内过滤</b>，字段树支持<b class="font-medium text-toned">锚点深链接</b>直达字段。
          全站搜索的索引由侧栏导航数据<b class="font-medium text-toned">派生</b>——一份数据、两处消费。
        </p>
      </div>
    </UContainer>

    <!-- ===================== 文档站外壳本体（全宽出血） ===================== -->
    <!-- 出血：外壳本体不放进 UContainer——通栏立柱要贴到窗口左边缘，居中容器
         的左右 padding 会在立柱外露出页面背景形成色差。真实项目整页都是外壳时
         同理：外壳直接铺满 body，正文列自己管理内边距。 -->
    <div class="border-y border-default">
      <!-- 顶栏：品牌 + 全站搜索。gallery 自己有全局 header，因此外壳顶栏内嵌
           在页面里；真实项目把这一条提升为 app 顶栏即可。 -->
      <div class="flex items-center justify-between gap-4 border-b border-default bg-elevated/40 px-4 py-2.5 sm:px-6">
        <div class="flex items-center gap-2 text-sm font-medium text-highlighted">
          <UIcon name="i-lucide-credit-card" class="size-4 text-muted" />
          支付 API 文档
        </div>
        <ApiDocsSiteSearch
          :groups="searchGroups"
          :search="searchContent"
          search-group-label="正文内容"
          trigger-label="搜索全部文档"
          aria-label="搜索全部文档"
          modal-title="搜索全部文档"
          placeholder="搜索指南与接口…"
          empty-label="没有匹配的结果"
        />
      </div>

      <!-- 两栏：sticky 通栏侧栏 + 正文。侧栏列宽 auto 跟随其可拖拽宽度。
           组件本身就是通栏立柱（唯一形态）：高度归外层容器所有（视口减 sticky
           顶距），上接顶栏、下抵视口底、左贴窗口边缘，与菜单项多少无关；菜单
           太长时在组件内部滚动。边框归布局：桌面档给右分隔边（两列之间不留
           gap），小屏侧栏顺排在正文上方、父级无定高时立柱自然收缩，给下分隔
           边即可——都是透传的「追加类」，可靠。 -->
      <div class="grid lg:grid-cols-[auto_1fr]">
        <div class="lg:sticky lg:top-16 lg:h-[calc(100dvh-4rem)] lg:self-start">
          <ApiDocsSidebarNav
            class="border-default max-lg:border-b lg:border-r"
            :groups="navGroups"
            aria-label="支付文档"
            search-placeholder="搜索文档"
            clear-label="清除搜索"
            empty-label="没有匹配的页面"
            resize-label="调整侧栏宽度"
            scenarios-label="服务场景"
            :results-announcement="(count: number) => `找到 ${count} 个匹配结果`"
            :no-results-announcement="(q: string) => `没有与“${q}”匹配的结果`"
            :scenario-overflow-label="(total: number) => `查看全部 ${total} 个服务场景`"
            scenario-separator="、"
            width-storage-key="docs-shell-sidebar-width"
          />
        </div>

        <!-- 正文：指南锚点 section + 端点 reference。出血布局下由正文列自己
             管理内边距（不再依赖外层容器）。 -->
        <div class="min-w-0 space-y-14 px-4 py-10 sm:px-6 lg:px-10 lg:py-12">
          <section id="overview" class="scroll-mt-24 space-y-3">
            <h3 class="text-xl font-semibold tracking-tight text-highlighted">概览</h3>
            <p class="max-w-2xl leading-relaxed text-muted text-pretty">
              支付 API 按业务用途组织：先用「创建结算会话」把顾客送进托管收银台，需要更细控制时改用
              Direct API 自行编排授权、捕获与退款。所有接口共用同一套密钥与 Webhook 通知机制。
            </p>
            <p class="max-w-2xl leading-relaxed text-muted text-pretty">
              左侧菜单里接口按<b class="font-medium text-toned">用途</b>命名，行首的方法色标说「怎么调」、行尾的场景标签说「用在哪」。
              找不到入口时用顶栏的全站搜索（<UKbd value="meta" /><UKbd value="K" />），输入场景名（如「订阅」）或方法名（如「POST」）都能命中。
            </p>
          </section>

          <section id="quickstart" class="scroll-mt-24 space-y-3">
            <h3 class="text-xl font-semibold tracking-tight text-highlighted">快速开始</h3>
            <p class="max-w-2xl leading-relaxed text-muted text-pretty">
              用测试密钥创建一个结算会话，把返回的 <code class="font-mono text-[0.8125rem]">url</code> 交给顾客即可完成一笔沙箱支付：
            </p>
            <ApiDocsCodeBlock
              :variants="quickstartVariants"
              title="创建你的第一个结算会话"
              :labels="{ language: '语言', copy: '复制代码', copied: '已复制到剪贴板', copyToast: '代码' }"
            />
          </section>

          <section id="auth" class="scroll-mt-24 space-y-3">
            <h3 class="text-xl font-semibold tracking-tight text-highlighted">认证与密钥</h3>
            <p class="max-w-2xl leading-relaxed text-muted text-pretty">
              所有请求通过 <code class="font-mono text-[0.8125rem]">Authorization: Bearer</code> 头携带密钥。测试密钥以
              <code class="font-mono text-[0.8125rem]">sk_test_</code> 开头、只操作沙箱数据；生产密钥请存放在服务端环境变量，切勿写进前端代码。
            </p>
          </section>

          <section id="webhooks" class="scroll-mt-24 space-y-3">
            <h3 class="text-xl font-semibold tracking-tight text-highlighted">Webhook 通知</h3>
            <p class="max-w-2xl leading-relaxed text-muted text-pretty">
              支付结果以 Webhook 异步送达（如 <code class="font-mono text-[0.8125rem]">payment.succeeded</code>、<code class="font-mono text-[0.8125rem]">refund.completed</code>）。
              校验签名头后再处理事件，并以事件 id 幂等去重——同一事件可能重复投递。
            </p>
          </section>

          <USeparator />

          <!-- 端点 reference：正文里唯一的 <h1>。 -->
          <section id="checkout-create" class="scroll-mt-24">
            <SplitPane
              direction="row"
              mode="fixed"
              fixed-pane="end"
              sticky
              sticky-top="5rem"
              storage-key="docs-shell-code-rail"
              :default-size="400"
              :min-size="340"
              :max-size="560"
              :min-opposite="340"
              label="调整文档与代码面板宽度"
            >
              <template #start>
                <div class="lg:pe-8">
                  <header class="space-y-4 border-b border-default pb-8">
                    <div class="flex flex-wrap items-center gap-2.5">
                      <ApiDocsMethodBadge :method="endpoint.method" />
                      <code class="min-w-0 truncate font-mono text-sm text-highlighted">{{ endpoint.path }}</code>
                    </div>
                    <h1 class="text-2xl font-semibold tracking-tight text-highlighted text-balance">
                      {{ endpoint.summary }}
                    </h1>
                    <p class="max-w-2xl leading-relaxed text-muted text-pretty">
                      {{ endpoint.description }}
                    </p>
                  </header>

                  <div class="mt-8 space-y-10">
                    <ApiDocsFieldGroup label="Request Body" :count="bodyFields.length">
                      <ApiDocsFieldItem v-for="f in bodyFields" :key="f.path ?? f.name" v-bind="f" />
                    </ApiDocsFieldGroup>

                    <ApiDocsFieldGroup label="Response Body" :count="responseFields.length">
                      <ApiDocsFieldItem v-for="f in responseFields" :key="f.path ?? f.name" v-bind="f" />
                    </ApiDocsFieldGroup>
                  </div>
                </div>
              </template>

              <template #end>
                <div class="lg:sticky lg:top-20 lg:h-[calc(100dvh-7rem)]">
                  <DemoApiDocsCodeRail class="h-full max-lg:space-y-4">
                    <template #top="{ maxHeight }">
                      <ApiDocsRequestExample :scenarios="requestScenarios" :max-height="maxHeight" />
                    </template>
                    <template #bottom="{ maxHeight }">
                      <ApiDocsResponseExample :scenarios="responseScenarios" :max-height="maxHeight" />
                    </template>
                  </DemoApiDocsCodeRail>
                </div>
              </template>
            </SplitPane>
          </section>

          <USeparator />

          <!-- 其余端点的紧凑 stub：让侧栏与全站搜索里的每个锚点都有落点。
               真实项目里每个端点都是一个完整的 reference section（同上）。 -->
          <div class="space-y-6">
            <section
              v-for="stub in endpointStubs"
              :id="stub.id"
              :key="stub.id"
              class="scroll-mt-24 space-y-2"
            >
              <div class="flex flex-wrap items-center gap-2.5">
                <ApiDocsMethodBadge :method="stub.method" />
                <code class="min-w-0 truncate font-mono text-sm text-highlighted">{{ stub.path }}</code>
              </div>
              <h3 class="text-lg font-semibold tracking-tight text-highlighted">{{ stub.summary }}</h3>
              <p class="max-w-2xl leading-relaxed text-muted text-pretty">{{ stub.description }}</p>
            </section>
          </div>
        </div>
      </div>
    </div>

    <UContainer class="py-8">
      <p class="text-sm text-dimmed">
        数据由本页内联假 ViewModel 驱动，不写进 kit。「创建结算会话」展示完整 reference 形态（字段树 + 代码栏），其余端点以紧凑
        stub 呈现——真实项目里每个端点都长成前者的样子。外壳本体做了左右出血：通栏立柱贴到窗口边缘，不裹进居中容器。
      </p>
    </UContainer>
  </div>
</template>
