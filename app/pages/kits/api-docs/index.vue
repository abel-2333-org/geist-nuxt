<script setup lang="ts">
definePageMeta({ nav: { label: '组件目录', icon: 'i-lucide-file-code', order: 0 } })

// API 文档场景的组合演示（demo/story）——按 geist-nuxt「demo 归 gallery、kit 只 ship
// 数据无关积木」的分层，这里用内联假 ViewModel 驱动 kit 的数据无关组件：代码块 /
// 请求 / 响应（ApiDocsCodeBlock、ApiDocsResponseExample）+ method / lifecycle 徽章
// + enum 值表（ApiDocsMethodBadge、ApiDocsLifecycleBadge、ApiDocsEnumTable）+ 字段树
// （ApiDocsFieldGroup、ApiDocsFieldItem，含递归子字段与 useFieldAnchor 深链接）。
const requestSamples = [
  {
    label: 'cURL',
    language: 'bash',
    code: `curl -X POST https://api.example.com/v1/deployments \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{ "name": "my-app", "target": "production" }'`,
  },
  {
    label: 'JavaScript',
    language: 'js',
    code: `const res = await fetch("https://api.example.com/v1/deployments", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${token}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ name: "my-app", target: "production" }),
})
const deployment = await res.json()`,
  },
  {
    label: 'Python',
    language: 'python',
    code: `import requests

res = requests.post(
    "https://api.example.com/v1/deployments",
    headers={"Authorization": f"Bearer {token}"},
    json={"name": "my-app", "target": "production"},
)
deployment = res.json()`,
  },
]

const responseScenarios = [
  {
    id: 'created',
    label: '创建部署',
    statuses: [
      {
        status: 200,
        statusText: '部署已创建。',
        variants: [
          {
            language: 'json',
            code: `{
  "id": "dpl_8Kx2fQ",
  "name": "my-app",
  "target": "production",
  "state": "READY",
  "url": "https://my-app.example.app",
  "createdAt": 1720000000000
}`,
          },
        ],
      },
    ],
  },
]

// Domain badges + enum table — preset wrappers over core's SemanticBadge, plus
// the allowed-values table. Data-agnostic, driven here by inline sample data.
const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const lifecycles = ['new', 'beta', 'active', 'maintenance', 'deprecated', 'sunset'] as const

// 端点头演示：完整形态（divider + #badges 共现 lifecycle 徽章）与紧凑 stub 形态。
// 目录页的组件标题是 h3，故演示里的端点头降为 h4，保持页面大纲成立。
const operationHeaderDemo = {
  method: 'POST',
  path: '/v1/checkout/sessions',
  summary: '创建结算会话',
  description: '为一次支付创建托管收银台会话，返回可跳转的结算 URL。',
}
const operationHeaderStubDemo = {
  method: 'GET',
  path: '/v1/checkout/sessions/{id}',
  summary: '查询结算会话',
  description: '按 ID 拉取会话当前状态与支付结果。',
}
const enumValues = [
  { value: 'production', description: 'Live environment served to end users.' },
  { value: 'preview', description: 'Per-branch deploy for review. Supports `?token=` access.' },
  { value: 'development', description: 'Local or ephemeral environment. **Not** publicly routed.' },
]

// Field tree — the recursive schema view. Inline sample data exercises every
// facet ApiDocsFieldItem renders: the three requiredness states, default value,
// examples, a condition, an enum, constraint notes (both tones), field
// lifecycle (new/beta/deprecated), and nested object children (collapsible +
// deep-linkable). `path` is the stable id used for the URL hash anchor.
const fields = [
  {
    path: 'body_name',
    name: 'name',
    type: 'string',
    required: true,
    description: 'Unique project name. Becomes part of the default domain.',
    examples: ['my-app'],
    notes: [
      { label: 'Range', text: '1–52 characters.' },
      { tone: 'caution' as const, label: 'Rule', text: 'Lowercase letters, digits and `-` only.' },
    ],
  },
  {
    path: 'body_target',
    name: 'target',
    type: 'enum',
    required: false,
    defaultValue: 'production',
    description: 'Deploy environment.',
    enumValues,
  },
  {
    path: 'body_gitSource',
    name: 'gitSource',
    type: 'object',
    required: 'conditional' as const,
    condition: 'Required when `type` is `git`.',
    lifecycle: { status: 'beta' as const, since: 'v2.4', description: 'Shape may still change during beta.' },
    description: 'Git repository to deploy from.',
    children: [
      {
        path: 'body_gitSource_repoId',
        name: 'repoId',
        type: 'string',
        required: true,
        description: 'Connected repository id.',
        examples: ['ghr_9f2a'],
      },
      {
        path: 'body_gitSource_ref',
        name: 'ref',
        type: 'string',
        required: false,
        defaultValue: 'main',
        description: 'Branch, tag, or commit SHA to build.',
      },
      {
        path: 'body_gitSource_legacyBranch',
        name: 'legacyBranch',
        type: 'string',
        required: false,
        lifecycle: { status: 'deprecated' as const, since: 'v2.4', description: 'Use `ref` instead.' },
        description: 'Legacy branch selector.',
      },
    ],
  },
  {
    path: 'body_meta',
    name: 'meta',
    type: 'object',
    required: false,
    lifecycle: { status: 'new' as const, since: 'v2.5' },
    description: 'Arbitrary key/value metadata attached to the deployment.',
    children: [
      {
        path: 'body_meta_key',
        name: 'key',
        type: 'string',
        required: true,
        notes: [{ label: 'Range', text: 'Up to 64 characters.' }],
      },
      {
        path: 'body_meta_value',
        name: 'value',
        type: 'string',
        required: true,
      },
    ],
  },
]

// A second, deliberately DENSE tree — the layout torture test the compact
// example above never reaches. It pushes what a real API endpoint throws at the
// row: very long field names, many summary facets on a single line
// (name · type · format · requiredness · default · lifecycle badge → wrap
// behavior), four levels of nesting, and an enum long enough to trip
// EnumTable's filter/scroll threshold (30) when embedded inside a field.
const currencyCodes = [
  'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'AUD', 'CAD', 'CHF', 'HKD', 'SGD', 'SEK',
  'NOK', 'DKK', 'NZD', 'KRW', 'INR', 'BRL', 'ZAR', 'MXN', 'RUB', 'TRY', 'PLN',
  'THB', 'IDR', 'MYR', 'PHP', 'CZK', 'HUF', 'ILS', 'AED', 'SAR', 'TWD', 'CLP', 'COP',
]
const currencyEnum = currencyCodes.map(code => ({
  value: code,
  description: `ISO 4217 alphabetic code for ${code}.`,
}))

const denseFields = [
  {
    path: 'payload_transactionSettlementInstruction',
    name: 'transactionSettlementInstruction',
    type: 'object',
    format: 'json_string',
    required: true,
    lifecycle: { status: 'beta' as const, since: 'v3.1' },
    description: 'Full settlement instruction envelope for a cross-border transfer.',
    children: [
      {
        path: 'payload_transactionSettlementInstruction_originatingAccountReference',
        name: 'originatingAccountReference',
        type: 'string',
        format: 'iban',
        required: true,
        defaultValue: 'DE00 0000 0000 0000',
        description: 'IBAN of the account to debit.',
        examples: ['DE89370400440532013000'],
        notes: [
          { label: 'Range', text: '15–34 characters, country-dependent.' },
          { tone: 'caution' as const, label: 'Rule', text: 'Checksum must pass ISO 7064 MOD-97-10.' },
        ],
      },
      {
        path: 'payload_transactionSettlementInstruction_settlementCurrency',
        name: 'settlementCurrency',
        type: 'enum',
        format: 'iso_4217',
        required: true,
        defaultValue: 'USD',
        description: 'Currency the settlement clears in.',
        enumValues: currencyEnum,
      },
      {
        path: 'payload_transactionSettlementInstruction_intermediaryInstitutions',
        name: 'intermediaryInstitutions',
        type: 'array<object>',
        required: false,
        description: 'Ordered correspondent banks in the settlement chain.',
        children: [
          {
            path: 'payload_transactionSettlementInstruction_intermediaryInstitutions_bankIdentifierCode',
            name: 'bankIdentifierCode',
            type: 'string',
            format: 'bic',
            required: true,
            description: 'SWIFT/BIC of the intermediary institution.',
            examples: ['DEUTDEFFXXX'],
          },
          {
            path: 'payload_transactionSettlementInstruction_intermediaryInstitutions_correspondentAccountReference',
            name: 'correspondentAccountReference',
            type: 'object',
            required: 'conditional' as const,
            condition: 'Required when the intermediary is not directly reachable.',
            description: 'Nostro/vostro account held at the intermediary.',
            children: [
              {
                path: 'payload_transactionSettlementInstruction_intermediaryInstitutions_correspondentAccountReference_accountServicingInstitution',
                name: 'accountServicingInstitution',
                type: 'string',
                required: true,
                description: 'Institution servicing the correspondent account — a fourth nesting level.',
              },
            ],
          },
        ],
      },
      {
        path: 'payload_transactionSettlementInstruction_legacyRoutingNumber',
        name: 'legacyRoutingNumber',
        type: 'string',
        required: false,
        lifecycle: { status: 'deprecated' as const, since: 'v3.0', description: 'Use `bankIdentifierCode` instead.' },
        description: 'Legacy ABA routing number.',
      },
    ],
  },
]

// Honor an incoming `#path` hash: navigate + expand + scroll to the field.
const anchor = useFieldAnchor()
onMounted(() => anchor.initFromHash())
</script>

<template>
  <UContainer class="py-16 sm:py-24">
    <section id="api-docs" class="scroll-mt-20 space-y-10">
      <div class="space-y-2">
        <h2 class="text-2xl font-semibold tracking-tight text-highlighted">API 文档场景</h2>
        <p class="text-muted max-w-2xl">
          API 文档场景的领域组件：代码块
          <code class="font-mono text-[0.8125rem]">ApiDocsCodeBlock</code>、
          请求 / 响应示例
          <code class="font-mono text-[0.8125rem]">ApiDocsRequestExample</code> /
          <code class="font-mono text-[0.8125rem]">ApiDocsResponseExample</code>，
          以及 method / lifecycle 徽章
          <code class="font-mono text-[0.8125rem]">ApiDocsMethodBadge</code> /
          <code class="font-mono text-[0.8125rem]">ApiDocsLifecycleBadge</code>、
          端点头
          <code class="font-mono text-[0.8125rem]">ApiDocsOperationHeader</code>
          与 enum 值表
          <code class="font-mono text-[0.8125rem]">ApiDocsEnumTable</code>，
          以及字段树
          <code class="font-mono text-[0.8125rem]">ApiDocsFieldGroup</code> /
          <code class="font-mono text-[0.8125rem]">ApiDocsFieldItem</code>（递归子字段 + 深链接）。
          全部基于 Nuxt UI 原语与 Geist token；徽章在 core 的
          <code class="font-mono text-[0.8125rem]">SemanticBadge</code> 之上包一层域词汇。
        </p>
      </div>

      <div class="space-y-8">
        <div>
          <h3 class="mb-3 text-sm font-semibold text-highlighted">请求示例</h3>
          <ApiDocsCodeBlock :variants="requestSamples" />
        </div>

        <div>
          <h3 class="mb-3 text-sm font-semibold text-highlighted">响应</h3>
          <ApiDocsResponseExample :scenarios="responseScenarios" />
        </div>

        <div>
          <h3 class="mb-3 text-sm font-semibold text-highlighted">Method 徽章</h3>
          <div class="flex flex-wrap items-center gap-2">
            <ApiDocsMethodBadge v-for="m in methods" :key="m" :method="m" />
          </div>
        </div>

        <div>
          <h3 class="mb-3 text-sm font-semibold text-highlighted">Lifecycle 徽章</h3>
          <div class="flex flex-wrap items-center gap-2">
            <ApiDocsLifecycleBadge v-for="s in lifecycles" :key="s" :status="s" />
          </div>
        </div>

        <div>
          <h3 class="mb-1 text-sm font-semibold text-highlighted">端点头</h3>
          <p class="mb-4 max-w-2xl text-sm text-muted">
            端点 identity 头：方法色标 + 等宽 path + summary 标题 + 可选描述。
            <code class="font-mono text-[0.8125rem]">heading-level</code> 按页面大纲定层级
            （独立参考页 h1 / 长滚动域页 h2）；<code class="font-mono text-[0.8125rem]">divider</code>
            附带与下方字段树分隔的底部细线；<code class="font-mono text-[0.8125rem]">size="sm"</code>
            是长滚动里锚点落点的紧凑 stub 形态；<code class="font-mono text-[0.8125rem]">#badges</code>
            slot 容纳 lifecycle 等共现徽章。
          </p>
          <div class="space-y-8">
            <ApiDocsOperationHeader v-bind="operationHeaderDemo" :heading-level="4" divider>
              <template #badges>
                <ApiDocsLifecycleBadge status="beta" />
              </template>
            </ApiDocsOperationHeader>
            <ApiDocsOperationHeader v-bind="operationHeaderStubDemo" :heading-level="4" size="sm" />
          </div>
        </div>

        <div>
          <h3 class="mb-3 text-sm font-semibold text-highlighted">Enum 值表</h3>
          <ApiDocsEnumTable :values="enumValues" />
        </div>

        <div>
          <h3 class="mb-1 text-sm font-semibold text-highlighted">字段树</h3>
          <p class="mb-4 max-w-2xl text-sm text-muted">
            递归 schema 视图：对象字段可折叠展开子字段，覆盖 required 三态、默认值、
            示例、条件、enum、约束注记与字段 lifecycle。每行悬停时行首出现链接图标，
            点击即复制该字段的深链接（<code class="font-mono text-[0.8125rem]">#body_gitSource_ref</code>
            这类锚点由 <code class="font-mono text-[0.8125rem]">useFieldAnchor</code> 驱动，
            带入页面时自动展开并滚动定位）。下面第一组是紧凑示例；第二组是刻意加压的
            高密度用例——超长字段名、单行多 facet（触发换行）、四层嵌套、超 30 项的长
            enum（触发内嵌 enum 表的筛选/滚动），用来验证真实规模下的排版。
          </p>
          <ApiDocsFieldGroup label="Request Body" :count="fields.length">
            <ApiDocsFieldItem v-for="f in fields" :key="f.path ?? f.name" v-bind="f" />
          </ApiDocsFieldGroup>

          <div class="mt-8">
            <ApiDocsFieldGroup label="Settlement Payload" :count="denseFields.length">
              <ApiDocsFieldItem v-for="f in denseFields" :key="f.path ?? f.name" v-bind="f" />
            </ApiDocsFieldGroup>
          </div>
        </div>
      </div>
    </section>
  </UContainer>
</template>
