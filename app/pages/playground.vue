<script setup lang="ts">
import FactList from '~~/kits/api-docs/internal/FactList.vue'
import FactRow from '~~/kits/api-docs/internal/FactRow.vue'
import type { FieldNode } from '~~/kits/api-docs/utils/field'
import RelationSourcePath, {
  type RelationSource,
  type RelationSourcePathLabels,
} from '~~/playground/components/RelationSourcePath.vue'

// Structured operation relations —— recipe 候选（未采纳）。
//
// 背景：#28 的真实 consumer adapter validation 判定「semantics verified,
// presentation not accepted」。随后的 follow-up 进一步裁定：把原始 Runtime
// Expression 降级为次要信息**仍然不够**——来源可能落在嵌套 object、array 或
// record 里，只给 leaf name 或一句人工描述就无法消歧、无法链接字段 schema，
// screen reader 也说不清完整来源。
//
// 本页用中性 fixtures 验证任务导向的 recipe，**刻意不建组件、不冻结 props**：
// 全部是页面 markup + 一个 v-for，采纳后整段搬进 gallery 的 endpoint /
// webhook baseline，届时再裁决是否晋升公共组件。
//
// 两条落地裁决：
//
// ① 区块级分区 —— 方向语义由区块标题 + 动作说明句承担，不引入类型徽章。
//   CALLBACK DELIVERY（平台之后发给你）/ NEXT OPERATION（你拿响应继续调）/
//   RELATED RESOURCES（纯参考，沿用既有 link + description recipe）。
//   三个区块各自 v-if，缺席时整段消失——空壳在结构上就不可能出现。
//   identity 槽位复用既有原子：callback 用 <WebhookBadge>（EVENT = 平台调你），
//   next operation 用 <HttpMethodBadge>（HTTP 动词 = 你调平台）。二者本就按
//   「同槽位、同尺寸、1:1 对齐」校准，方向因此有了第三重非颜色编码，而徽章并
//   未被征用去区分 relation 类型——它只是在标记 operation 身份。
//
// ② 来源用完整字段层级做主层级，但不伪造对称关系：callback 是一个
//   `Address source → Request body › …` 事实；next operation 才是
//   `parameter → Response body › …` 映射。两者只共享 FactList / FactRow 的
//   definition-list 骨架与 RelationSourcePath 的路径展示。层级、数组下标与
//   JSON Pointer 转义还原全部由 consumer 解析后传入——Geist 不解析 OpenAPI /
//   JSON Pointer / 消费项目 DSL。
//
// ③ 原始 Runtime Expression 不进入 Geist display model —— consumer / compiled
//   contract 继续负责逐字保真，页面只接收已解析的结构化来源。
//   曾经做过一版「复制原始表达式」的按钮，删掉了：本 kit 的每一处复制都指向
//   「粘过去立刻有下一步」的东西——CodeBlock 复制可运行代码、OperationTarget
//   复制可请求的地址、useFieldAnchor 复制可点的深链。而 Runtime Expression 在
//   任何语言里都不是合法表达式、不是地址、不是链接；真要写 spec 的人也不在这
//   一页上（何况本项目作者写的是 DSL，表达式是 compile 产物）。它是唯一一个
//   「复制了没有下一步」的候选，因此不该占一个 tab stop。
//   表达式的规范归宿是 contract 与已发布的 OpenAPI projection，文档页不是
//   spec 的镜像。
//
// 曾经探索过、已被 follow-up 否掉的方案（不要回头重做）：
//   - 把扁平表达式留在主层级、只做排版优化（层级信息丢失，无法消歧）；
//   - 只给 leaf name 加一句人工描述（同名 leaf 无法区分，读屏说不清来源）。
// 页面最下方保留的「演示一次接力」是**补充**形态，不是主层级候选：它展示具体
// 值很直观，但表达不了层级，读屏上也弱。

definePageMeta({ nav: false })

const fieldAnchor = useFieldAnchor()
onMounted(() => fieldAnchor.initFromHash())

/* ================================================================= *
 * Structured relation source（按 #28 follow-up 重搭）
 *
 * follow-up 的裁决：把原始 Runtime Expression 降级为次要信息**仍然不够**。
 * 来源可能落在嵌套 object、array 或 record 里；只给 leaf name 或一句人工描述，
 * 就无法消歧（`notification/callback_url` 与 `recipients/0/callback_url` 的
 * leaf 同名）、无法链接字段 schema，screen reader 也说不清完整来源。
 *
 * 因此 reader-facing 主层级必须表达**完整字段层级**：
 *   Request body → notification → callback_url
 *   Request body → recipients[0] → callback_url
 *   Response body → payment → id
 *
 * Ownership（follow-up 写死）：
 *   Consumer —— 解析 Runtime Expression 与 JSON Pointer、对照 schema 校验来源
 *               字段存在、生成 decoded hierarchy 与稳定 anchor，并在 compiled
 *               contract 中保留 exact raw expression。
 *   Geist    —— 只接收已解析的 display data，不解析 OpenAPI / JSON Pointer /
 *               消费项目 DSL；负责层级路径、字段链接、technical mapping 的通用
 *               IA、responsive layout 与 a11y contract。
 * ================================================================= */

const labels: {
  callback: string
  next: string
  related: string
  address: string
  mapping: string
  source: RelationSourcePathLabels
} = {
  callback: 'Callback Delivery',
  next: 'Next Operation',
  related: 'Related Resources',
  address: 'Address Source',
  mapping: 'Parameter / Value Source',
  source: {
    scope: {
      'request:body': 'Request body',
      'request:path': 'Request path',
      'request:query': 'Request query',
      'request:header': 'Request header',
      'response:body': 'Response body',
      'response:path': 'Response path',
      'response:query': 'Response query',
      'response:header': 'Response header',
    },
    prefix: 'Source:',
    connector: 'under',
  },
}

// The relation previews repeat at several container widths, so their targets
// live in one canonical field surface instead of duplicating DOM ids per card.
// These are real FieldItem paths: relation clicks therefore exercise the same
// reveal, focus and highlight contract as an API reference page.
const requestFields = [
  {
    path: 'req_callback_url',
    name: 'callback_url',
    type: 'string',
    format: 'uri',
    description: 'Address that receives the deployment result callback.',
  },
  {
    path: 'req_notification',
    name: 'notification',
    type: 'object',
    children: [
      {
        path: 'req_notification_callback_url',
        name: 'callback_url',
        type: 'string',
        format: 'uri',
      },
    ],
  },
  {
    path: 'req_recipients',
    name: 'recipients',
    type: 'array<object>',
    children: [
      {
        path: 'req_recipients_callback_url',
        name: 'callback_url',
        type: 'string',
        format: 'uri',
      },
    ],
  },
] satisfies FieldNode[]

const responseFields = [
  {
    path: 'res_id',
    name: 'id',
    type: 'string',
    description: 'Unique deployment id.',
  },
  {
    path: 'res_ownership',
    name: 'ownership',
    type: 'object',
    children: [
      {
        path: 'res_ownership_team',
        name: 'team',
        type: 'object',
        children: [
          {
            path: 'res_ownership_team_identifier',
            name: 'canonical_identifier',
            type: 'string',
          },
        ],
      },
      {
        path: 'res_ownership_organization',
        name: 'organization',
        type: 'object',
        children: [
          {
            path: 'res_ownership_organization_team',
            name: 'team',
            type: 'object',
            children: [
              {
                path: 'res_ownership_members',
                name: 'members',
                type: 'array<object>',
                children: [
                  {
                    path: 'res_ownership_member_identifier',
                    name: 'canonical_identifier',
                    type: 'string',
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    path: 'res_project',
    name: 'project',
    type: 'object',
    children: [
      {
        path: 'res_project_identifier',
        name: 'canonical_identifier',
        type: 'string',
      },
    ],
  },
  {
    path: 'res_metadata',
    name: 'metadata',
    type: 'record<string, string>',
    children: [
      {
        path: 'res_metadata_tenant_region',
        name: 'tenant/region',
        type: 'string',
      },
    ],
  },
  {
    path: 'res_flags',
    name: 'flags',
    type: 'record<string, boolean>',
    children: [
      {
        path: 'res_flags_beta_legacy',
        name: 'beta~legacy',
        type: 'boolean',
      },
    ],
  },
  {
    path: 'res_payment',
    name: 'payment',
    type: 'object',
    children: [
      { path: 'res_payment_id', name: 'id', type: 'string' },
    ],
  },
  {
    path: 'res_refund',
    name: 'refund',
    type: 'object',
    children: [
      { path: 'res_refund_id', name: 'id', type: 'string' },
    ],
  },
] satisfies FieldNode[]

/* ================================================================= *
 * 可选补充：演示一次接力，而不是描述一次映射
 *
 * A/E/B/C 共享同一个前提——把映射**描述**出来，区别只在排版。这一版换框架：
 * 开发者理解数据流动靠的是看一个例子，不是读一条规则。
 *
 * 关键装置：**同一个值逐字出现两次**。`dpl_5xK2Qw` 在响应里和在下一个请求里
 * 是同一串字符——这本身就是连接，不需要画线（CSS 连线在响应式下必崩）。颜色
 * 只加速识别、不承担意义，因此满足「不只靠颜色传意」。
 *
 * 于是 $ # / 全部从阅读路径上消失——不是藏起来，是不再需要。该补充只在
 * consumer 确有示例值时成立，不进入默认关系列表。
 *
 * 代价（需要 consumer 确认）：这要求 adapter 能提供**真实示例值**，而不只是
 * schema。拿不到就退回思路 2（把关系挂到字段上）。
 *
 * 注：playground 这版手写代码面。CodeBlock 刻意不带运行时高亮（只接 build-time
 * 的 highlightedHtml），生产版应走 `highlightedHtml` + `trustHighlightedHtml`。
 * ================================================================= */

/** 一个步骤的代码片段：高亮值被前后两段夹住，避免在展示层做字符串查找。 */
interface RelayStep {
  /** 步骤标题，已本地化。 */
  label: string
  /** 片段里高亮值**之前**的部分，原样。 */
  before: string
  /** 片段里高亮值**之后**的部分，原样。 */
  after: string
}

interface Relay {
  key: string
  /** identity：EVENT 或 HTTP 动词。 */
  kind: 'event' | 'http'
  method?: string
  title: string
  /** identity 副标题：事件标识或路径。 */
  identity: string
  /** 动作说明句，走 InlineMarkdown。 */
  action: string
  /** 被搬运的那个值——两个步骤里逐字相同，这是非颜色的连接信号。 */
  value: string
  steps: [RelayStep, RelayStep]
}

const relays: Relay[] = [
  {
    key: 'next-operation',
    kind: 'http',
    method: 'GET',
    title: 'Get deployment',
    identity: '/v1/deployments/{deployment_id}',
    action: '本次请求返回 201 后，用响应里的 `id` 作为下一次请求的 `deployment_id`。',
    value: 'dpl_5xK2Qw',
    steps: [
      {
        label: '① 你刚拿到的响应',
        before: '{\n  "id": "',
        after: '",\n  "state": "BUILDING",\n  "url": "geist-nuxt.vercel.app"\n}',
      },
      {
        label: '② 下一个请求',
        before: 'GET /v1/deployments/',
        after: '',
      },
    ],
  },
  {
    key: 'callback-delivery',
    kind: 'event',
    title: 'Deployment result',
    identity: 'deployment.result',
    action: '部署进入终态后，服务会把结果发送到你在本次请求的 `callback_url` 中提供的地址。',
    value: 'https://you.example.com/hooks/deploy',
    steps: [
      {
        label: '① 你在本次请求里提供',
        before: '{\n  "callback_url": "',
        after: '"\n}',
      },
      {
        label: '② 部署完成后，我们向它发送',
        before: 'POST ',
        after: '',
      },
    ],
  },
]

/**
 * 代码面：与 CodeBlock 同族的近单色surface。`tabindex=0` 让键盘用户能滚动它，
 * 沿用 CodeBlock 对可滚动区域的处理，而不是把每个片段变成页面 landmark。
 */
// `min-w-0` 不是装饰：grid / flex 项的 min-width 默认是 `auto`，`whitespace-pre`
// 的 min-content 宽度会一路往上顶，把整张卡撑得比视口还宽——`overflow-x-auto` 在
// 元素能收缩之前根本不生效。卡片本身也要 `min-w-0` 才能在 grid 里收缩。
const codeSurface = 'min-w-0 overflow-x-auto rounded-md border border-default bg-muted p-3 font-mono text-xs leading-relaxed whitespace-pre text-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary'

/** 被搬运的值：两处同样标记。文本自身逐字相同，颜色只是加速识别。 */
const relayValue = 'rounded-sm bg-primary/10 px-1 py-0.5 font-medium text-primary'

/** 平台之后主动投递给读者的回调。 */
interface CallbackDelivery {
  key: string
  /** 读者可读的事件名（consumer 已本地化）。 */
  label: string
  /** 事件标识，mono。 */
  event: string
  /** Optional operation target; omit until the consumer resolves a real route. */
  to?: string
  /**
   * 一句动作说明：什么时候发、发到哪。走 <InlineMarkdown> 的 inline 子集，
   * 反引号内的**参数名**渲染成 InlineCode——读者要照抄的标识符按
   * `voice-content.md` 用 mono；状态码只是触发条件，保持纯文本不加色块。
  */
  action: string
  /** 回调地址所在的唯一结构化来源。 */
  source: RelationSource
}

interface RelationParam {
  /** 下一次请求中接收值的参数。 */
  name: string
  /** 当前响应中提供值的来源。 */
  source: RelationSource
}

/** 读者拿当前响应继续调用的下一个 operation。 */
interface NextOperation {
  key: string
  /** 目标 operation 的可读名称（consumer 已本地化）。 */
  label: string
  method: string
  path: string
  /** Optional operation target; omit until the consumer resolves a real route. */
  to?: string
  /** 一句动作说明：什么条件下、拿哪个值、去调什么。同上，参数名走反引号。 */
  action: string
  params?: RelationParam[]
}

/** 普通参考链接——不被强行建模成 callback / next operation。 */
interface RelatedResource {
  label: string
  description: string
  to: string
}

interface Relations {
  callbacks: CallbackDelivery[]
  next: NextOperation[]
  related: RelatedResource[]
}

// --- 中性 fixtures：沿用 gallery 既有的 deployment 领域，不带任何 consumer
// 业务词汇。已解析来源指向下方真实 FieldItem；只有刻意覆盖 unresolved 状态的
// Location 省略 `to` / `field`，按纯文本降级。 ---

const full: Relations = {
  callbacks: [
    {
      key: 'deployment_result',
      label: 'Deployment result',
      event: 'deployment.result',
      action: '部署进入终态后，服务会把结果发送到你在本次请求的 `callback_url` 中提供的地址。',
      source: { scope: 'request', location: 'body', segments: ['callback_url'], field: 'req_callback_url' },
    },
  ],
  next: [
    {
      key: 'get_deployment',
      label: 'Get deployment',
      method: 'GET',
      path: '/v1/deployments/{deployment_id}',
      action: '本次请求返回 201 后，用响应里的 `id` 作为下一次请求的 `deployment_id`。',
      params: [
        {
          name: 'deployment_id',
          source: { scope: 'response', location: 'body', segments: ['id'], field: 'res_id' },
        },
      ],
    },
  ],
  related: [
    {
      label: 'Deployment object',
      description: '查看返回的部署对象完整字段。',
      to: '/kits/api-docs/endpoint-reference',
    },
    {
      label: 'Build state',
      description: '了解部署状态机各枚举值的含义。',
      to: '/kits/api-docs/schema-composition',
    },
  ],
}

// 压力档：长事件名、长 operation 名、长 path、3 条 parameter mapping。
// 验收标准要求这些长内容同时成立时不重叠、无页面级横向溢出。
const stress: Relations = {
  callbacks: [
    {
      key: 'protection_bypass_configuration_result',
      label: 'Deployment protection bypass configuration result',
      event: 'deployment.protection.bypass.configuration.result',
      action: '配置生效或被拒绝后，服务会把结果发送到你在本次请求的 `notification.callback_url` 中提供的地址。',
      source: { scope: 'request', location: 'body', segments: ['notification', 'callback_url'], field: 'req_notification_callback_url' },
    },
  ],
  next: [
    {
      key: 'update_protection_bypass_configuration',
      label: 'Update deployment protection bypass configuration for a team project',
      method: 'PATCH',
      path: '/v1/teams/{team_id}/projects/{project_id}/deployments/{deployment_id}/protection-bypass/configuration',
      action: '本次请求返回 201 后，用响应里的三个标识继续调用下面的 operation。',
      params: [
        {
          name: 'team_id',
          source: { scope: 'response', location: 'body', segments: ['ownership', 'team', 'canonical_identifier'], field: 'res_ownership_team_identifier' },
        },
        {
          name: 'project_id',
          source: { scope: 'response', location: 'body', segments: ['project', 'canonical_identifier'], field: 'res_project_identifier' },
        },
        {
          name: 'deployment_id',
          source: { scope: 'response', location: 'body', segments: ['id'], field: 'res_id' },
        },
      ],
    },
  ],
  related: [],
}

// 缺席档：三类 relation 全部为空。区块必须整段消失，不留标题、不留空壳。
const minimal: Relations = {
  callbacks: [],
  next: [],
  related: [],
}

/**
 * 覆盖档：#28 follow-up 那份 acceptance coverage 的逐条 fixture。
 *
 * 请求侧两条各自作为 callback address source，响应侧六条走 next operation 的
 * parameter/value mapping；另有一条无参数 operation，锁住 mapping 缺席语义。
 * 两类来源共用路径展示，但不再共用业务模型。
 */
const coverage: Relations = {
  callbacks: [
    {
      key: 'coverage_callback_object',
      label: 'Notification result',
      event: 'notification.result',
      action: '回调地址来自请求体中 `notification` 对象下的 `callback_url`。',
      source: { scope: 'request', location: 'body', segments: ['notification', 'callback_url'], field: 'req_notification_callback_url' },
    },
    {
      key: 'coverage_callback_array',
      label: 'Recipient notification result',
      event: 'recipient.notification.result',
      action: '回调地址来自请求体中 `recipients` 数组元素下的 `callback_url`。',
      source: { scope: 'request', location: 'body', segments: ['recipients[0]', 'callback_url'], field: 'req_recipients_callback_url' },
    },
  ],
  next: [
    {
      key: 'coverage_next',
      label: 'Reconcile payment',
      method: 'POST',
      path: '/v1/payments/{payment_id}/reconcile',
      action: '六条来源分别覆盖 record 动态 key、JSON Pointer 转义、同名 leaf 消歧、长层级与无锚点降级。',
      params: [
        // JSON Pointer `~1` 还原为 `/`：字面名为 `tenant/region` 的动态 key。
        {
          name: 'tenant_region',
          source: { scope: 'response', location: 'body', segments: ['metadata', 'tenant/region'], field: 'res_metadata_tenant_region' },
        },
        // JSON Pointer `~0` 还原为 `~`。
        {
          name: 'legacy_flag',
          source: { scope: 'response', location: 'body', segments: ['flags', 'beta~legacy'], field: 'res_flags_beta_legacy' },
        },
        // 下面两条 leaf 同为 `id`，只有完整层级能把它们分开。
        {
          name: 'payment_id',
          source: { scope: 'response', location: 'body', segments: ['payment', 'id'], field: 'res_payment_id' },
        },
        {
          name: 'refund_id',
          source: { scope: 'response', location: 'body', segments: ['refund', 'id'], field: 'res_refund_id' },
        },
        // 长层级 + 数组下标。
        {
          name: 'member_identifier',
          source: { scope: 'response', location: 'body', segments: ['ownership', 'organization', 'team', 'members[0]', 'canonical_identifier'], field: 'res_ownership_member_identifier' },
        },
        // 无 anchor：必须退回纯文本，不渲染死链。同时是 header location 样本。
        {
          name: 'location',
          source: { scope: 'response', location: 'header', segments: ['Location'] },
        },
      ],
    },
    {
      key: 'coverage_next_without_params',
      label: 'List deployment events',
      method: 'GET',
      path: '/v1/deployments/events',
      action: '这个 operation 不需要从当前响应中搬运参数，因此只保留 identity 与动作说明。',
    },
  ],
  related: [],
}

/**
 * 一次 v-for 覆盖全部证据：三种形态 × 两种宽度语境，markup 只存在一份。
 * `max-w-96`（384px）代表 390 视口与窄侧栏——组件真正在乎的是自身宽度，不是
 * 视口，所以窄档用容器宽度而非 viewport 前缀来验证。
 */
const previews: Array<{ id: string, label: string, data: Relations, width: string }> = [
  { id: 'full', label: 'Full —— 三类 relation 齐全', data: full, width: '' },
  { id: 'stress', label: 'Stress —— 长事件名 / 长 operation 名 / 长 path / 3 条 parameter mapping', data: stress, width: '' },
  { id: 'minimal', label: 'Minimal —— 三类全部缺席，验证整段省略', data: minimal, width: '' },
  { id: 'coverage', label: 'Coverage —— 嵌套 / 数组下标 / record 动态 key / JSON Pointer 转义 / 同名 leaf 消歧 / 长层级 / 无锚点降级 / 无参数 operation', data: coverage, width: '' },
  { id: 'full-narrow', label: 'Full @ 384px —— 窄栏回流', data: full, width: 'max-w-96' },
  { id: 'coverage-narrow', label: 'Coverage @ 384px —— 长层级窄栏回流', data: coverage, width: 'max-w-96' },
  { id: 'stress-narrow', label: 'Stress @ 384px —— 窄栏回流', data: stress, width: 'max-w-96' },
  { id: 'stress-medium', label: 'Stress @ 576px —— SplitPane 中宽度回流', data: stress, width: 'max-w-144' },
]

/** Technical mapping 的次级标签。 */
const mappingLabel = 'font-mono text-xs uppercase tracking-widest text-dimmed'
</script>

<template>
  <div>
    <PlaygroundStage
      title="Structured operation relations"
      description="#28 recipe 候选：把 callback 与 next operation 从单一 Relationships 区块中拆出；callback 用 Address Source 事实，next operation 用 Parameter / Value Source 映射。来源以完整字段层级为主，原始 Runtime Expression 留在 compiled contract，不进入 Geist display model。关系 recipe 仍未冻结为公共 API。"
    >
      <section
        v-for="preview in previews"
        :key="preview.id"
        class="space-y-3"
      >
        <h2 class="text-sm font-medium text-highlighted">
          {{ preview.label }}
        </h2>

        <!-- harness 说明，不属于 recipe 本身 -->
        <p v-if="preview.id === 'minimal'" class="text-sm text-dimmed">
          下方边框内应当完全空白：三个区块各自 v-if，没有数据时连标题都不渲染。
        </p>

        <div
          class="rounded-md border border-dashed border-default p-4"
          :class="preview.width"
        >
          <div class="space-y-8">
            <!-- ── CALLBACK DELIVERY：平台之后主动发给你 ───────────────── -->
            <FieldGroup
              v-if="preview.data.callbacks.length"
              :label="labels.callback"
              :count="preview.data.callbacks.length"
              :heading-level="3"
            >
              <ul class="divide-y divide-default">
                <li
                  v-for="callback in preview.data.callbacks"
                  :key="callback.key"
                  class="space-y-3 py-4"
                >
                  <!-- identity：EVENT 徽章本就意味「平台调你」，方向在这里是
                       身份标记的副产品，不是需要读者解码的类型词汇。 -->
                  <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <WebhookBadge class="self-center" />
                    <ULink
                      v-if="callback.to"
                      :to="callback.to"
                      class="wrap-anywhere min-w-0 text-sm font-medium text-highlighted hover:underline"
                    >
                      {{ callback.label }}
                    </ULink>
                    <span v-else class="wrap-anywhere min-w-0 text-sm font-medium text-highlighted">
                      {{ callback.label }}
                    </span>
                    <InlineCode class="wrap-anywhere min-w-0" translate="no">{{ callback.event }}</InlineCode>
                  </div>

                  <!-- 动作说明：读者不需要理解 Runtime Expression 也能回答
                       「回调会发到哪里」。参数名走 mono，状态码保持纯文本——
                       前者是要照抄的标识符，后者只是触发条件。
                       `wrap-anywhere` 挂在段落上而非 token 上：InlineMarkdown
                       自己生成 InlineCode，调用方拿不到每个 token 的 class，而
                       overflow-wrap 会继承进 inline-block 的 <code>。少了它，
                       `notification.callback_url` 这类长 token 在极窄容器
                       （实测 240px）会把段落撑出横向溢出。 -->
                  <p class="wrap-anywhere text-sm leading-relaxed text-muted">
                    <InlineMarkdown :text="callback.action" />
                  </p>

                  <FactList>
                    <FactRow :fact="{ term: labels.address }">
                      <template #value>
                        <RelationSourcePath
                          :source="callback.source"
                          :labels="labels.source"
                        />
                      </template>
                    </FactRow>
                  </FactList>
                </li>
              </ul>
            </FieldGroup>

            <!-- ── NEXT OPERATION：你拿当前响应继续调 ─────────────────── -->
            <FieldGroup
              v-if="preview.data.next.length"
              :label="labels.next"
              :count="preview.data.next.length"
              :heading-level="3"
            >
              <ul class="divide-y divide-default">
                <li
                  v-for="operation in preview.data.next"
                  :key="operation.key"
                  class="space-y-3 py-4"
                >
                  <!-- identity：HTTP 动词徽章意味「你调平台」，与上方 EVENT
                       同槽位同尺寸，两个区块并读时方向对比自然成立。 -->
                  <div class="space-y-1.5">
                    <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <HttpMethodBadge :method="operation.method" class="self-center" />
                      <ULink
                        v-if="operation.to"
                        :to="operation.to"
                        class="wrap-anywhere min-w-0 text-sm font-medium text-highlighted hover:underline"
                      >
                        {{ operation.label }}
                      </ULink>
                      <span v-else class="wrap-anywhere min-w-0 text-sm font-medium text-highlighted">
                        {{ operation.label }}
                      </span>
                    </div>
                    <p class="wrap-anywhere min-w-0 font-mono text-xs leading-relaxed text-dimmed" translate="no">
                      {{ operation.path }}
                    </p>
                  </div>

                  <p class="wrap-anywhere text-sm leading-relaxed text-muted">
                    <InlineMarkdown :text="operation.action" />
                  </p>

                  <div v-if="operation.params?.length" class="space-y-1.5">
                    <p :class="mappingLabel">
                      {{ labels.mapping }}
                    </p>
                    <FactList>
                      <FactRow
                        v-for="param in operation.params"
                        :key="param.name"
                        :fact="{ term: param.name }"
                      >
                        <template #term>
                          <InlineCode class="wrap-anywhere min-w-0" translate="no">
                            {{ param.name }}
                          </InlineCode>
                        </template>
                        <template #value>
                          <RelationSourcePath
                            :source="param.source"
                            :labels="labels.source"
                          />
                        </template>
                      </FactRow>
                    </FactList>
                  </div>
                </li>
              </ul>
            </FieldGroup>

            <!-- ── RELATED RESOURCES：纯参考，沿用既有 recipe 不动 ─────── -->
            <FieldGroup
              v-if="preview.data.related.length"
              :label="labels.related"
              :count="preview.data.related.length"
              :heading-level="3"
            >
              <ul class="divide-y divide-default">
                <li v-for="relation in preview.data.related" :key="relation.to">
                  <ULink
                    :to="relation.to"
                    class="group flex items-start justify-between gap-4 py-3 text-highlighted"
                  >
                    <span class="min-w-0">
                      <span class="block text-sm font-medium group-hover:underline">{{ relation.label }}</span>
                      <span class="mt-1 block text-sm leading-relaxed text-muted">{{ relation.description }}</span>
                    </span>
                    <UIcon
                      name="i-lucide-arrow-right"
                      class="mt-0.5 size-4 shrink-0 text-dimmed transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </ULink>
                </li>
              </ul>
            </FieldGroup>
          </div>
        </div>
      </section>

      <!-- Canonical targets for all repeated relation previews. Keeping this
           harness visible makes the link destination reviewable and exercises
           the real FieldItem reveal/focus contract instead of fake hashes. -->
      <section data-anchor-targets class="space-y-4 border-t border-default pt-8">
        <div class="space-y-1.5">
          <h2 class="text-sm font-medium text-highlighted">
            Field anchor targets
          </h2>
          <p class="max-w-2xl text-sm leading-relaxed text-muted">
            这些字段属于 playground 验收 harness。点击上方 Address Source 或 Parameter / Value Source
            会展开相应层级、聚焦字段并保留可分享的 hash；Location 刻意保持无目标降级。
          </p>
        </div>

        <div class="grid gap-8 xl:grid-cols-2">
          <FieldGroup label="Request Body" :count="requestFields.length" :heading-level="3">
            <FieldItem
              v-for="field in requestFields"
              :key="field.path"
              v-bind="field"
            />
          </FieldGroup>
          <FieldGroup label="Response Body" :count="responseFields.length" :heading-level="3">
            <FieldItem
              v-for="field in responseFields"
              :key="field.path"
              v-bind="field"
            />
          </FieldGroup>
        </div>
      </section>

      <!-- ══ 可选补充：只有 consumer 提供真实示例值时才出现 ═══════════ -->
      <section class="space-y-3 border-t border-default pt-8">
        <h2 class="text-sm font-medium text-highlighted">
          Optional relay example
        </h2>
        <p class="max-w-2xl text-sm leading-relaxed text-muted">
          这一形态不属于默认关系列表；只有 consumer 确实提供示例值时，才用它补充说明数据如何接力。
          连接装置是<strong class="font-medium text-highlighted">同一个值逐字出现两次</strong>，不画线：
          文本自身相同就是连接，颜色只加速识别、不承担意义。
          <code class="font-mono text-code" translate="no">$</code>、<code class="font-mono text-code" translate="no">#</code>、<code class="font-mono text-code" translate="no">/</code>
          因此不需要把 Runtime Expression 带回展示模型。
        </p>

        <div class="grid gap-4 lg:grid-cols-2">
          <div
            v-for="relay in relays"
            :key="relay.key"
            class="min-w-0 space-y-4 rounded-md border border-dashed border-default p-4"
          >
            <!-- identity：沿用 B1 的槽位——EVENT = 平台调你，HTTP 动词 = 你调平台。 -->
            <div class="space-y-1.5">
              <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <WebhookBadge v-if="relay.kind === 'event'" class="self-center" />
                <HttpMethodBadge v-else :method="relay.method || 'GET'" class="self-center" />
                <span class="wrap-anywhere min-w-0 text-sm font-medium text-highlighted">{{ relay.title }}</span>
              </div>
              <p class="wrap-anywhere min-w-0 font-mono text-xs leading-relaxed text-dimmed" translate="no">
                {{ relay.identity }}
              </p>
            </div>

            <p class="wrap-anywhere text-sm leading-relaxed text-muted">
              <InlineMarkdown :text="relay.action" />
            </p>

            <!-- 两个步骤。值在两处逐字相同——这是连接本身；同色标记只是加速。 -->
            <div v-for="step in relay.steps" :key="step.label" class="space-y-1.5">
              <p class="text-xs font-medium text-dimmed">
                {{ step.label }}
              </p>
              <!-- whitespace-pre：三段之间不能有任何模板空白，否则片段就不是
                   逐字的原样了。tabindex=0 让键盘用户能滚动这个可滚动区域。 -->
              <div
                :class="codeSurface"
                tabindex="0"
                role="group"
                :aria-label="step.label"
                translate="no"
              >{{ step.before }}<span :class="relayValue">{{ relay.value }}</span>{{ step.after }}</div>
            </div>
          </div>
        </div>
      </section>
    </PlaygroundStage>
  </div>
</template>
