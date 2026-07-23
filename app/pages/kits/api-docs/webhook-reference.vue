<script setup lang="ts">
definePageMeta({ nav: { label: 'Webhook 参考页', icon: 'i-lucide-radio-tower', order: 2 } })

// API 文档场景的「整页级 webhook 组合」demo（不是可分发切片，也不是通用组件）——
// 与端点参考页 /kits/api-docs/reference 镜像对称：端点问「你怎么调平台」，
// webhook 问「平台怎么回调你」。此前 webhook 的证据是散的：
//   - /kits/api-docs/webhook-protocol 只单独陈列 <ApiDocsWebhookProtocol>；
//   - 文档站外壳的 webhook 段只有 identity + payload 字段树 + payload 示例，
//     整个协议三段（验证/确认/投递）缺席。
// 没有任何一处把「identity + 协议 + payload + 示例」收在一页里。本页补上这个
// baseline：验证现有 kit 组件已足以组合出完整 webhook 参考页，无需新增组件。
//
// 阅读顺序（= DOM 顺序）：
//   identity 头（EVENT 徽章 + 事件名 + h1 摘要 + 描述）
//   → <ApiDocsWebhookProtocol>（验证 → 确认 → 投递，identity 的正文伙伴）
//   → payload 字段树（<ApiDocsFieldGroup> + <ApiDocsFieldItem>）
// 右栏：payload 示例（单卡，无双例需求，故不用 <ApiDocsCodeRail>）。
//
// identity 头此处手写（与 reference.vue 端点 baseline 一致）：standalone 单
// operation 页里事件摘要即页面唯一 <h1>，而 <ApiDocsOperationHeader> 的
// headingLevel 上限是 2（供「域 h1 下多 operation」的外壳场景，见
// DocsShellReference）。两条路径都成立，取决于页面是单 operation 还是多
// operation——这是刻意的分层，不是缺口。
//
// 所有数据由本页内联中性假 ViewModel 注入；kit 组件保持数据无关、locale-ready。

// --- Webhook 身份（本页唯一 <h1>）---
const webhook = {
  event: 'subscription.renewed',
  summary: 'Subscription renewed',
  description:
    'Sent after a subscription successfully renews for the next billing cycle. Use it to extend access, issue a receipt, or reconcile your own records. Delivered to every registered endpoint that subscribes to this event.',
}

// --- 协议三段：验证 / 确认 / 投递 ---
// 主 fixture 三段齐全，覆盖 ACK 的 literal body 语义（给 example）。
const verification = {
  label: 'VERIFICATION',
  description: '每次投递都带签名头。用你的 signing secret 对原始请求体重算并比对，通过后再处理事件。',
  facts: [
    { term: '签名头', value: 'Webhook-Signature', code: true },
    { term: '算法', value: 'HMAC-SHA256', code: true, note: '对原始请求体计算，输出十六进制小写。' },
    { term: '密钥来源', value: '控制台 Webhook 设置页生成的 signing secret。' },
    { term: '时效', value: '签名含时间戳，偏差超过 5 分钟应拒绝，防止重放。' },
  ],
}

const acknowledgement = {
  label: 'ACKNOWLEDGEMENT',
  description: '返回下列响应即视为确认成功；其它任何响应都会触发重试。',
  facts: [
    { term: 'HTTP status', value: '200', code: true },
    { term: 'Media type', value: 'application/json', code: true },
    { term: '响应体', value: '固定 JSON 字面量，与右侧示例完全一致。' },
  ],
  example: {
    code: '{\n  "received": true\n}',
    language: 'json',
    title: '确认响应体',
    labels: {
      language: '语言',
      copy: '复制代码',
      copied: '已复制到剪贴板',
      copyToast: '确认响应体',
      copySuccess: '确认响应体已复制。',
      copyFailure: '复制失败，请重试。',
      wrapOn: '启用自动换行',
      wrapOff: '关闭自动换行',
      emptyTitle: '暂无示例',
      emptyHint: '当前没有确认响应体示例。',
    },
  },
}

const delivery = {
  label: 'DELIVERY',
  description: '未收到成功确认时按退避序列重试，最长约 24 小时。',
  facts: [
    { term: '总次数', value: '首次投递 + 最多 8 次重试。' },
    { term: '超时', value: '每次请求 10 秒未响应即视为失败。' },
    { term: '幂等', value: '同一事件的重试携带相同的事件 id，请据此去重。' },
  ],
  schedule: {
    term: '重试节奏',
    summary: '从 1 分钟起逐步退避到 12 小时，共 8 次。',
    steps: ['1 分钟', '5 分钟', '30 分钟', '1 小时', '2 小时', '4 小时', '8 小时', '12 小时'],
    expandLabel: (hidden: number) => `展开其余 ${hidden} 档`,
    collapseLabel: '收起',
  },
}

// --- payload 字段树：递归 schema，驱动左侧文档流 ---
const payloadFields = [
  {
    path: 'payload_id',
    name: 'id',
    type: 'string',
    required: true,
    description: '本次事件的唯一 id，用于幂等去重。',
    examples: ['evt_3Nk8ta'],
  },
  {
    path: 'payload_type',
    name: 'type',
    type: 'string',
    required: true,
    description: '事件类型，恒等于本页事件名。',
    examples: ['subscription.renewed'],
  },
  {
    path: 'payload_createdAt',
    name: 'createdAt',
    type: 'integer',
    format: 'unix_ms',
    required: true,
    description: '事件产生时间，毫秒时间戳。',
  },
  {
    path: 'payload_data',
    name: 'data',
    type: 'object',
    required: true,
    description: '事件主体，形状随事件类型而定。',
    children: [
      {
        path: 'payload_data_subscriptionId',
        name: 'subscriptionId',
        type: 'string',
        required: true,
        description: '续费的订阅 id。',
        examples: ['sub_9f2aK'],
      },
      {
        path: 'payload_data_currentPeriodEnd',
        name: 'currentPeriodEnd',
        type: 'integer',
        format: 'unix_ms',
        required: true,
        description: '新计费周期的结束时间。',
      },
      {
        path: 'payload_data_status',
        name: 'status',
        type: 'enum',
        required: true,
        description: '续费后的订阅状态。',
        enumValues: [
          { value: 'active', description: '续费成功，服务继续。' },
          { value: 'past_due', description: '续费扣款失败，进入宽限期。' },
        ],
      },
      {
        path: 'payload_data_previousAttributes',
        name: 'previousAttributes',
        type: 'object',
        required: false,
        lifecycle: { status: 'beta' as const, since: 'v2.6' },
        description: '本次变更前的字段快照，仅变化字段。',
        children: [
          { path: 'payload_data_previousAttributes_currentPeriodEnd', name: 'currentPeriodEnd', type: 'integer', format: 'unix_ms', required: false, description: '上一周期的结束时间。' },
        ],
      },
    ],
  },
]

// payload 示例：单卡（webhook 只投递一种载荷，无场景/状态双维度），
// 故用 <ApiDocsRequestExample> 一个 scenario 承载，不需要 CodeRail 双例分栏。
const payloadExample = [
  {
    id: 'payload',
    label: 'JSON',
    variants: [
      {
        label: 'JSON',
        language: 'json',
        code: `{
  "id": "evt_3Nk8ta",
  "type": "subscription.renewed",
  "createdAt": 1720000000000,
  "data": {
    "subscriptionId": "sub_9f2aK",
    "currentPeriodEnd": 1722678400000,
    "status": "active"
  }
}`,
      },
    ],
  },
]

// --- 组合级形态变体（区别于组件级变体，后者见 /kits/api-docs/webhook-protocol）---
// partial：协议缺「确认」段（echo/空/字面之外，有些事件干脆不要求特定确认体）；
//          且不提供 payload 示例——文档只描述字段，不给样本。
const partialVerification = {
  label: 'VERIFICATION',
  facts: [
    { term: '签名头', value: 'Webhook-Signature', code: true },
    { term: '算法', value: 'HMAC-SHA256', code: true },
  ],
}
const partialDelivery = {
  label: 'DELIVERY',
  facts: [{ term: '总次数', value: '最多 5 次。' }],
  schedule: { term: '重试节奏', summary: '每 15 分钟一次，间隔固定，无退避。' },
}
const partialPayloadFields = [
  { path: 'p_id', name: 'id', type: 'string', required: true, description: '事件 id。' },
  { path: 'p_type', name: 'type', type: 'string', required: true, description: '事件类型。' },
]

// minimal：一个「只报事实」的轻量事件——没有协议段（验证/确认/投递沿用平台默认，
//          在指南里统一说明），正文只有 identity + 极简 payload。整页依然成立。
const minimalPayloadFields = [
  { path: 'm_id', name: 'id', type: 'string', required: true, description: '事件 id。' },
  { path: 'm_type', name: 'type', type: 'string', required: true, description: '事件类型。' },
  { path: 'm_data', name: 'data', type: 'object', required: true, description: '空对象——该事件仅表示「发生了」，不携带额外字段。' },
]

// 深链接：带 `#path` 进入时自动展开 + 滚动定位到对应字段。
const anchor = useFieldAnchor()
onMounted(() => anchor.initFromHash())
</script>

<template>
  <UContainer class="py-10 sm:py-14">
    <!-- 主 baseline：完整 webhook 参考页（identity + 协议 + payload + 示例）。
         招牌两栏：左文档流 / 右 payload 示例（单卡，sticky）。 -->
    <SplitPane
      direction="row"
      mode="fixed"
      fixed-pane="end"
      sticky
      sticky-top="5rem"
      storage-key="geist-api-webhook-rail"
      :default-size="440"
      :min-size="360"
      :max-size="640"
      :min-opposite="380"
      label="Resize documentation and payload panels"
    >
      <template #start>
        <div class="lg:pe-8">
          <!-- identity 头：手写以取得页面唯一 h1（与 reference.vue 端点 baseline
               对称）。EVENT 徽章取代 METHOD 徽章——方向相反：平台回调你。 -->
          <header class="space-y-4 border-b border-default pb-8">
            <div class="flex flex-wrap items-center gap-2.5">
              <ApiDocsEventBadge />
              <code class="min-w-0 truncate font-mono text-sm text-highlighted">{{ webhook.event }}</code>
            </div>
            <h1 class="text-2xl font-semibold tracking-tight text-highlighted text-balance sm:text-[2rem] sm:leading-tight">
              {{ webhook.summary }}
            </h1>
            <p class="max-w-2xl leading-relaxed text-muted text-pretty">
              {{ webhook.description }}
            </p>
          </header>

          <div class="mt-8 space-y-12">
            <!-- identity 的正文伙伴：协议三段。sections 各自独立省略，此处齐全。 -->
            <ApiDocsWebhookProtocol
              :verification="verification"
              :acknowledgement="acknowledgement"
              :delivery="delivery"
            />

            <!-- payload 字段树：与端点 Request/Response Body 同构。 -->
            <ApiDocsFieldGroup label="Event Payload" :count="payloadFields.length">
              <ApiDocsFieldItem v-for="f in payloadFields" :key="f.path ?? f.name" v-bind="f" />
            </ApiDocsFieldGroup>
          </div>
        </div>
      </template>

      <template #end>
        <div class="lg:sticky lg:top-20">
          <ApiDocsRequestExample title="Payload" :scenarios="payloadExample" max-height="calc(100dvh - 9rem)" />
        </div>
      </template>
    </SplitPane>

    <USeparator class="my-14" />

    <!-- 组合级形态变体：整页在「协议/示例部分缺席」时依然连贯——不渲染空壳、
         不留占位。区别于组件级变体（ACK 三语义、schedule 边界），后者见
         /kits/api-docs/webhook-protocol。 -->
    <section class="space-y-6">
      <div class="space-y-2">
        <h2 class="text-xl font-semibold tracking-tight text-highlighted">组合级形态变体</h2>
        <p class="max-w-2xl leading-relaxed text-muted text-pretty">
          同一套组件在「协议不全 / 无示例 / 无协议」时如何收敛。组件级的省略规则
          （ACK 三语义、schedule 折叠）见
          <code class="font-mono text-[0.8125rem]">/kits/api-docs/webhook-protocol</code>。
        </p>
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <!-- partial：协议缺「确认」段 + 无 payload 示例 -->
        <figure class="space-y-4 rounded-lg border border-default p-6">
          <figcaption class="text-sm font-medium text-toned">
            Partial —— 只声明验证与投递（无确认段），且不提供 payload 示例
          </figcaption>
          <header class="space-y-3 border-b border-default pb-5">
            <div class="flex flex-wrap items-center gap-2.5">
              <ApiDocsEventBadge />
              <code class="min-w-0 truncate font-mono text-sm text-highlighted">invoice.finalized</code>
            </div>
            <h3 class="text-lg font-semibold tracking-tight text-highlighted">Invoice finalized</h3>
          </header>
          <ApiDocsWebhookProtocol
            :verification="partialVerification"
            :delivery="partialDelivery"
            :heading-level="4"
          />
          <ApiDocsFieldGroup label="Event Payload" :count="partialPayloadFields.length" :heading-level="4">
            <ApiDocsFieldItem v-for="f in partialPayloadFields" :key="f.path" v-bind="f" />
          </ApiDocsFieldGroup>
        </figure>

        <!-- minimal：无协议段，仅 identity + 极简 payload -->
        <figure class="space-y-4 rounded-lg border border-default p-6">
          <figcaption class="text-sm font-medium text-toned">
            Minimal —— 轻量事件：无协议段，正文只有 identity + 极简 payload
          </figcaption>
          <header class="space-y-3 border-b border-default pb-5">
            <div class="flex flex-wrap items-center gap-2.5">
              <ApiDocsEventBadge />
              <code class="min-w-0 truncate font-mono text-sm text-highlighted">ping.sent</code>
            </div>
            <h3 class="text-lg font-semibold tracking-tight text-highlighted">Ping sent</h3>
          </header>
          <ApiDocsFieldGroup label="Event Payload" :count="minimalPayloadFields.length" :heading-level="4">
            <ApiDocsFieldItem v-for="f in minimalPayloadFields" :key="f.path" v-bind="f" />
          </ApiDocsFieldGroup>
        </figure>
      </div>

      <p class="text-sm text-dimmed">
        所有 fixture 均由本页内联，不写进 kit；组件保持数据无关，整页组合是 gallery 私有 recipe。
      </p>
    </section>
  </UContainer>
</template>
