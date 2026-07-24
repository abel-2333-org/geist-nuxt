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

// 响应示例：覆盖 body 语义全形态——numeric / 'default' 状态、code（多 media
// type：JSON + text/plain + CSV）、empty（204 有意空正文）、unavailable（有正文缺示例）、
// file（二进制：metadata + 可选下载）。所有状态一律使用显式 `bodies`。
const responseScenarios = [
  {
    id: 'created',
    label: '创建部署',
    statuses: [
      {
        status: 200,
        statusText: '已创建',
        description: '部署已创建，返回存储后的完整记录。',
        bodies: [
          {
            id: 'json',
            kind: 'code' as const,
            mediaType: 'application/json',
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
          {
            id: 'text',
            kind: 'code' as const,
            mediaType: 'text/plain',
            variants: [
              {
                language: 'text',
                label: 'Plain text',
                code: 'dpl_8Kx2fQ READY https://my-app.example.app',
              },
            ],
          },
          {
            id: 'csv',
            kind: 'code' as const,
            mediaType: 'text/csv',
            variants: [
              {
                language: 'csv',
                label: 'CSV',
                code: 'id,name,target,state\ndpl_8Kx2fQ,my-app,production,READY',
              },
            ],
          },
        ],
      },
      {
        status: 204,
        statusText: '无内容',
        bodies: [{ id: 'empty', kind: 'empty' as const, note: '操作已受理，协议约定不返回正文。' }],
      },
      {
        status: 409,
        statusText: '冲突',
        description: '同名部署已存在。',
        bodies: [{ id: 'json', kind: 'unavailable' as const, mediaType: 'application/json' }],
      },
      {
        status: 'default' as const,
        statusText: '未预期错误',
        bodies: [
          {
            id: 'json',
            kind: 'code' as const,
            mediaType: 'application/json',
            variants: [
              {
                language: 'json',
                code: `{
  "error": { "code": "internal", "message": "Unexpected error." }
}`,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'export',
    label: '导出构建产物',
    statuses: [
      {
        status: 200,
        statusText: '成功',
        description: '返回构建产物压缩包。',
        bodies: [
          {
            id: 'zip',
            kind: 'file' as const,
            mediaType: 'application/zip',
            filename: 'my-app-build.zip',
            size: '2.4 MB',
            downloadUrl: 'https://example.com/artifacts/my-app-build.zip',
          },
        ],
      },
    ],
  },
  {
    id: 'list',
    label: '部署列表',
    statuses: [
      {
        status: 200,
        statusText: '成功',
        bodies: [
          {
            id: 'json',
            kind: 'code' as const,
            mediaType: 'application/json',
            variants: [
              {
                language: 'json',
                code: `[
  { "id": "dpl_8Kx2fQ", "name": "my-app", "state": "READY" }
]`,
              },
            ],
          },
        ],
      },
    ],
  },
]

// demo 页全中文，覆盖 ResponseExample 的英文默认文案（含窄容器 popover 的表单 label）。
const responseLabels = {
  title: '响应',
  scenario: '场景',
  status: '状态',
  mediaType: '媒体类型',
  responseOptions: '响应选项',
  codeBodyTitle: '代码示例',
  emptyBodyTitle: '无响应正文',
  emptyBodyHint: '该响应有意返回空正文。',
  unavailableTitle: '暂无示例',
  unavailableHint: '该响应有正文，但尚未提供示例。',
  fileTitle: '文件响应',
  download: '下载',
}

// Domain badges + enum table — preset wrappers over core's SemanticBadge, plus
// the allowed-values table. Data-agnostic, driven here by inline sample data.
const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const lifecycles = ['new', 'beta', 'active', 'maintenance', 'deprecated', 'sunset'] as const
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

// 场景受控选择 story 数据：请求 / 响应两侧共用稳定场景 id（single / batch /
// dry-run）；响应侧刻意缺 `batch`，现场演示缺侧 fallback——Request 切到 batch 时
// Response 确定性收敛到第一项，不回写、不发事件、不抖动。scenario ↔ scenario 的
// mapping 归 consumer（这里的页面级 ref）持有，kit 组件零 mapping。
const linkedRequestScenarios = [
  {
    id: 'single',
    label: '创建单个部署',
    variants: [
      {
        language: 'bash',
        label: 'cURL',
        code: `curl -X POST https://api.example.com/v1/deployments \\
  -d '{ "name": "my-app", "target": "production" }'`,
      },
    ],
  },
  {
    id: 'batch',
    label: '批量创建',
    variants: [
      {
        language: 'bash',
        label: 'cURL',
        code: `curl -X POST https://api.example.com/v1/deployments/batch \\
  -d '{ "items": [{ "name": "my-app" }, { "name": "my-docs" }] }'`,
      },
    ],
  },
  {
    id: 'dry-run',
    label: '仅校验',
    variants: [
      {
        language: 'bash',
        label: 'cURL',
        code: `curl -X POST "https://api.example.com/v1/deployments?dryRun=1" \\
  -d '{ "name": "my-app", "target": "production" }'`,
      },
    ],
  },
]

const linkedResponseScenarios = [
  {
    id: 'single',
    label: '创建单个部署',
    statuses: [
      {
        status: 200,
        statusText: 'OK',
        bodies: [
          {
            id: 'json',
            kind: 'code' as const,
            mediaType: 'application/json',
            variants: [
              {
                language: 'json',
                code: `{ "id": "dpl_8Kx2fQ", "name": "my-app", "state": "READY" }`,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'dry-run',
    label: '仅校验',
    statuses: [
      {
        status: 200,
        statusText: 'OK',
        bodies: [
          {
            id: 'json',
            kind: 'code' as const,
            mediaType: 'application/json',
            variants: [
              {
                language: 'json',
                code: `{ "valid": true, "warnings": [] }`,
              },
            ],
          },
        ],
      },
    ],
  },
]

// linked 形态：页面级一个 ref 同时绑两侧 v-model:scenario，两个选择器互为镜像。
const linkedScenario = ref('single')

// Operation 身份层陈列数据：header（endpoint / webhook 两形态）、target
// （双环境切换）、lifecycle notice（deprecated 一例）。
const demoHosts = [
  { id: 'production', label: '生产', baseUrl: 'https://api.example.com' },
  { id: 'sandbox', label: '沙箱', baseUrl: 'https://sandbox.example.com' },
]

// ApiDocsFieldAnnotation demo — inline field references inside narrative prose.
// The field source maps ids → { field, page? }; markdown-style narrative only
// ever cites ids. Same-page entries omit `page` and deep-link via useFieldAnchor
// (scroll + expand + flash on the field tree below); the nested repoId entry
// proves the collapsed ancestor auto-expands on arrival. The cross-page entry
// names the reference page, so the action becomes a `{page}#{path}` link whose
// target page runs its own initFromHash() on arrival. An unregistered id
// degrades to plain text.
provideFieldSource({
  'create-deployment.name': {
    field: { path: 'body_name', name: 'name', type: 'string', required: true, description: '唯一项目名，会成为默认域名的一部分。' },
  },
  'create-deployment.gitSource.repoId': {
    field: { path: 'body_gitSource_repoId', name: 'repoId', type: 'string', required: true, description: '已连接仓库的 id（位于可折叠的 gitSource 对象内，跳转时自动展开）。' },
  },
  'create-deployment.state': {
    page: '/kits/api-docs/reference',
    field: { path: 'res_state', name: 'state', type: 'enum', required: true, description: '部署状态，定义在 Reference 页的响应体（跨页字段）。' },
  },
})

const fieldLabels = {
  category: '字段',
  required: '必填',
  conditional: '条件必填',
  viewField: '查看字段详情',
}

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
          以及 method / event / lifecycle 徽章
          <code class="font-mono text-[0.8125rem]">ApiDocsMethodBadge</code> /
          <code class="font-mono text-[0.8125rem]">ApiDocsEventBadge</code> /
          <code class="font-mono text-[0.8125rem]">ApiDocsLifecycleBadge</code>
          与 enum 值表
          <code class="font-mono text-[0.8125rem]">ApiDocsEnumTable</code>，
          以及字段树
          <code class="font-mono text-[0.8125rem]">ApiDocsFieldGroup</code> /
          <code class="font-mono text-[0.8125rem]">ApiDocsFieldItem</code>（递归子字段 + 深链接）。
          Operation 身份层由
          <code class="font-mono text-[0.8125rem]">ApiDocsOperationHeader</code>（端点 / webhook 同构头部）、
          <code class="font-mono text-[0.8125rem]">ApiDocsOperationTarget</code>（环境 + 地址 + 复制）与
          <code class="font-mono text-[0.8125rem]">ApiDocsLifecycleNotice</code>（生命周期横幅）承担；
          双例码轨道 <code class="font-mono text-[0.8125rem]">ApiDocsCodeRail</code> 见「参考页组合」。
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
          <p class="mb-3 max-w-2xl text-sm text-muted">
            body 语义显式建模：<code class="font-mono text-[0.8125rem]">code</code>（JSON / text/plain / CSV 等多 media type 出选择器）/
            <code class="font-mono text-[0.8125rem]">empty</code>（有意空正文，如 204）/
            <code class="font-mono text-[0.8125rem]">unavailable</code>（有正文缺示例）/
            <code class="font-mono text-[0.8125rem]">file</code>（二进制 metadata + 可选下载）；
            状态支持数字码与 <code class="font-mono text-[0.8125rem]">'default'</code>，可带 status 级描述。
          </p>
          <ApiDocsResponseExample :scenarios="responseScenarios" :labels="responseLabels" />
        </div>

        <div>
          <h3 class="mb-1 text-sm font-semibold text-highlighted">场景受控选择</h3>
          <p class="mb-4 max-w-2xl text-sm text-muted">
            请求 / 响应示例的场景选择默认各自独立（uncontrolled，无需任何绑定）；绑定
            <code class="font-mono text-[0.8125rem]">v-model:scenario</code>
            即转为受控，两侧可用一个页面级 ref 联动（linked），选择器互为镜像。
            scenario 间的对应关系由 consumer 持有，kit 不做 mapping。下例响应侧刻意
            缺「批量创建」：请求切到该场景时，响应确定性收敛到第一项——fallback 只派生
            不回写、不发事件，因此无更新循环，也不会抖动。
          </p>
          <div class="space-y-4">
            <ApiDocsRequestExample
              v-model:scenario="linkedScenario"
              :scenarios="linkedRequestScenarios"
            />
            <ApiDocsResponseExample
              v-model:scenario="linkedScenario"
              :scenarios="linkedResponseScenarios"
            />
          </div>
        </div>

        <div>
          <h3 class="mb-3 text-sm font-semibold text-highlighted">Method 徽章</h3>
          <div class="flex flex-wrap items-center gap-2">
            <ApiDocsMethodBadge v-for="m in methods" :key="m" :method="m" />
          </div>
        </div>

        <div>
          <h3 class="mb-3 text-sm font-semibold text-highlighted">Event 徽章</h3>
          <p class="mb-3 max-w-2xl text-sm text-muted">
            Webhook 的身份标：统一词
            <code class="font-mono text-[0.8125rem]">EVENT</code>（中性灰，居五个 method 色之外）——
            方法色标说「你调平台」，EVENT 标说「平台回调你」。事件名走旁边的 mono 代码位。
          </p>
          <div class="flex flex-wrap items-center gap-2">
            <span class="flex items-center gap-2.5">
              <ApiDocsEventBadge />
              <code class="font-mono text-sm text-highlighted">payment.succeeded</code>
            </span>
            <span class="flex items-center gap-2.5">
              <ApiDocsEventBadge />
              <code class="font-mono text-sm text-highlighted">refund.completed</code>
            </span>
          </div>
        </div>

        <div>
          <h3 class="mb-3 text-sm font-semibold text-highlighted">Lifecycle 徽章</h3>
          <div class="flex flex-wrap items-center gap-2">
            <ApiDocsLifecycleBadge v-for="s in lifecycles" :key="s" :status="s" />
          </div>
        </div>

        <div>
          <h3 class="mb-3 text-sm font-semibold text-highlighted">Lifecycle 横幅</h3>
          <p class="mb-3 max-w-2xl text-sm text-muted">
            <code class="font-mono text-[0.8125rem]">ApiDocsLifecycleNotice</code>
            与 Lifecycle 徽章共用同一份 preset 词表与色调：徽章标记一行，横幅在正文里解释
            「发生了什么 + 怎么办」。置于 Operation Header 之后、字段区之前。
          </p>
          <ApiDocsLifecycleNotice
            status="deprecated"
            title="已弃用"
            description="该接口不再接受新接入，存量调用仍可用。请迁移到替代接口。"
            class="max-w-2xl"
          />
        </div>

        <div>
          <h3 class="mb-1 text-sm font-semibold text-highlighted">Operation Header / Target</h3>
          <p class="mb-4 max-w-2xl text-sm text-muted">
            操作身份头：一个组件承担端点与 webhook 两形态
            （<code class="font-mono text-[0.8125rem]">kind="endpoint" | "webhook"</code>），
            identity 行（徽章 + mono 标识 + 右对齐 #actions 槽）→ 标题（+ lifecycle）→ 描述。
            端点形态下接 <code class="font-mono text-[0.8125rem]">ApiDocsOperationTarget</code>：
            环境切换 + 完整地址 + 复制；webhook 的「目标」是你自己的回调地址，一句话说明即可，不用该组件。
          </p>
          <div class="space-y-8">
            <!-- story 标题是 h3，头部标题传 4 归入其下，保持 outline 不跳级 -->
            <ApiDocsOperationHeader
              kind="endpoint"
              method="POST"
              path="/v1/checkout/sessions"
              summary="创建结算会话"
              lifecycle="active"
              :heading-level="4"
              class="rounded-lg border border-default p-5"
            >
              <template #description>
                为一次支付或订阅创建托管结算会话，返回托管收银台 URL。
              </template>
              <ApiDocsOperationTarget
                :hosts="demoHosts"
                path="/v1/checkout/sessions"
                select-label="选择环境"
                copy-toast-label="接口地址"
              />
            </ApiDocsOperationHeader>

            <ApiDocsOperationHeader
              kind="webhook"
              event="payment.succeeded"
              summary="支付成功"
              :heading-level="4"
              class="rounded-lg border border-default p-5"
            >
              <template #description>
                一笔支付被成功捕获后投递。先校验签名再处理，并以事件 id 幂等去重。
              </template>
            </ApiDocsOperationHeader>
          </div>
        </div>

        <div>
          <h3 class="mb-3 text-sm font-semibold text-highlighted">Enum 值表</h3>
          <ApiDocsEnumTable :values="enumValues" />
        </div>

        <div>
          <h3 class="mb-1 text-sm font-semibold text-highlighted">Field 注释</h3>
          <p class="mb-4 max-w-2xl text-sm text-muted">
            <code class="font-mono text-[0.8125rem]">ApiDocsFieldAnnotation</code>
            把字段引用嵌进叙事文本：hover / 点击预览字段摘要，动作跳转到字段行。
            同页字段经 <code class="font-mono text-[0.8125rem]">useFieldAnchor</code>
            滚动 + 展开 + 高亮（下方字段树即跳转目标，嵌套字段会自动展开祖先）；
            跨页字段渲染为 <code class="font-mono text-[0.8125rem]">{page}#{path}</code>
            链接，由目标页的 <code class="font-mono text-[0.8125rem]">initFromHash</code> 接管。
          </p>
          <p class="mb-8 max-w-2xl leading-relaxed text-toned">
            创建部署时，
            <ApiDocsFieldAnnotation field-ref="create-deployment.name" :labels="fieldLabels" />
            为必填的唯一项目名；若从 Git 部署，
            <ApiDocsFieldAnnotation field-ref="create-deployment.gitSource.repoId" :labels="fieldLabels" />
            指向已连接的仓库（跳转会展开下方折叠的 gitSource 对象）。部署结果的
            <ApiDocsFieldAnnotation field-ref="create-deployment.state" :labels="fieldLabels" />
            定义在 Reference 页（跨页跳转）。历史字段如
            <ApiDocsFieldAnnotation field-ref="create-deployment.removed">legacyRegion</ApiDocsFieldAnnotation>
            未登记，降级为纯文本。
          </p>
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
