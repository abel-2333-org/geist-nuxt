<script setup lang="ts">
definePageMeta({ nav: { label: 'Webhook 参考页', icon: 'i-lucide-radio-tower', order: 2 } })

// API 文档场景的「整页级 webhook 组合」demo（不是可分发切片，也不是通用组件）——
// 与端点参考页 /kits/api-docs/endpoint-reference 镜像对称：端点问「你怎么调平台」，
// webhook 问「平台怎么回调你」。此前 webhook 的证据是散的：
//   - /kits/api-docs/webhook-protocol 只单独陈列 <ApiDocsWebhookProtocol>；
//   - 文档站外壳的 webhook 段只有 identity + payload 字段树 + payload 示例，
//     整个协议三段（验证/确认/投递）缺席。
// 没有任何一处把「identity + requirements/guide 扩展区 + 协议 + payload +
// 示例 + relations 扩展区」收在一页里。本页补上这个 baseline：验证现有 kit
// primitives 已足以支撑整页 recipe；FieldItem 的锚点可访问名则在本轮补强。
//
// 阅读顺序（= DOM 顺序）——左栏是纯文档流，按 webhook「处理生命周期」排序
// （= 开发者写 handler 的代码顺序：verify → read → respond → retry），而非把
// 协议三段捆成一块压在 payload 之上或之下：
//   identity 头（EVENT 徽章 + 事件名 + h1 摘要 + 描述）
//   → REQUIREMENTS / GUIDE：可选前置事实与指南扩展区；
//   → VERIFICATION：收到请求先验签（安全关口，须在信任 payload 前置顶）；
//   → PAYLOAD 字段树（<ApiDocsFieldGroup> + <ApiDocsFieldItem>）：验签后解析的
//     数据，整页主角，紧跟验证；
//   → ACKNOWLEDGEMENT → DELIVERY：处理后怎么回应、失败怎么重试；
//   → RELATED RESOURCES：可选 relations 扩展区（背景参考殿后）。
// <ApiDocsWebhookProtocol> 三段各自独立省略，故渲染两次把 payload 夹在中间。
// 右栏「线缆样本」= webhook 的两个方向，与端点 baseline 的 Request/Response
// 镜像对称，用 <ApiDocsCodeRail> 纵向双栏：
//   Payload（平台 → 你，上）/ Acknowledgement（你 → 平台，下）。
// 关键 IA 裁决：ACK 的字面响应体是「线缆样本」而非文档散文，故与 payload 一同
// 进右栏，不内联在左侧协议段里——左栏只留 ACK 的 facts 并指向右栏示例。
//
// identity 头此处手写（与 endpoint-reference.vue 端点 baseline 一致）：standalone 单
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

// --- 通用扩展区：由页面/consumer 持有，kit 不定义认证或 relation 业务 shape ---
// full 同时提供 requirements/guide + relations；partial 只保留 requirements；
// minimal 两者都省略，验证可选区独立出现/省略时不会留下空壳。
const requirements = [
  { term: 'Endpoint', value: '公开可访问的 HTTPS URL。' },
  { term: '订阅', value: '在控制台显式订阅本事件。' },
]
const partialRequirements = [
  { term: 'Endpoint', value: '公开可访问的 HTTPS URL。' },
]
const relations = [
  {
    label: 'Event data object',
    description: '查看本事件携带的订阅数据。',
    to: '#payload_data',
  },
  {
    label: 'Previous attributes',
    description: '查看本次续费前发生变化的字段。',
    to: '#payload_data_previousAttributes',
  },
]

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

// ACK 段只保留「facts」——它的字面响应体示例是「线缆样本」，与 payload 示例一样
// 归右栏 CodeRail（见下方 ackExample + 模板 #bottom），不内联在左侧文档流里。
// facts 里的「响应体」行明确把读者指向右栏。
const acknowledgement = {
  label: 'ACKNOWLEDGEMENT',
  description: '返回下列响应即视为确认成功；其它任何响应都会触发重试。',
  facts: [
    { term: 'HTTP status', value: '200', code: true },
    { term: 'Media type', value: 'application/json', code: true },
    { term: '响应体', value: '固定 JSON 字面量，见本页 Acknowledgement 示例。' },
  ],
}

const delivery = {
  label: 'DELIVERY',
  description: '未收到成功确认时按退避序列重试，最长约 28 小时。',
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

// 右栏「线缆样本」= webhook 的两个方向，与端点 baseline 的 Request/Response
// 双栏镜像对称：
//   - Payload（平台 → 你，inbound）：本次投递的 JSON 载荷；
//   - Acknowledgement（你 → 平台，outbound）：你回给平台的固定确认体。
// 二者用 <ApiDocsCodeRail> 纵向双栏承载（Payload 在上 / ACK 在下），与
// endpoint-reference.vue 的 Request/Response rail 用同一装配。各自单一 scenario，
// 故用一个 variant 承载。
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

// ACK 固定响应体（literal）——作为右栏底部卡，直接喂给 <ApiDocsCodeBlock>。
const ackExample = {
  code: '{\n  "received": true\n}',
  language: 'json',
  title: 'Acknowledgement',
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
}

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
          <!-- identity 头：手写以取得页面唯一 h1（与 endpoint-reference.vue 端点 baseline
               对称）。EVENT 徽章取代 METHOD 徽章——方向相反：平台回调你。 -->
          <header class="space-y-4 border-b border-default pb-8">
            <div class="flex flex-wrap items-center gap-2.5">
              <ApiDocsEventBadge />
              <code class="min-w-0 truncate font-mono text-sm text-highlighted">{{ webhook.event }}</code>
            </div>
            <h1 class="text-2xl font-semibold tracking-tight text-highlighted text-balance sm:text-3xl sm:leading-tight">
              {{ webhook.summary }}
            </h1>
            <p class="max-w-2xl leading-relaxed text-muted text-pretty">
              {{ webhook.description }}
            </p>
          </header>

          <div class="mt-8 space-y-12">
            <!-- 可选 requirements / guide 扩展区：页面只定义位置与语义层级，
                 consumer 自己提供已解析、已本地化的内容。 -->
            <ApiDocsFieldGroup label="Requirements">
              <div class="space-y-4 pt-2">
                <dl class="divide-y divide-default">
                  <div
                    v-for="item in requirements"
                    :key="item.term"
                    class="flex flex-col gap-1 py-2.5 sm:flex-row sm:gap-4"
                  >
                    <dt class="shrink-0 text-sm text-muted sm:w-36">{{ item.term }}</dt>
                    <dd class="text-sm text-highlighted">{{ item.value }}</dd>
                  </div>
                </dl>
                <ULink
                  to="/kits/api-docs/webhook-protocol"
                  class="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  查看 Webhook protocol 指南
                  <UIcon name="i-lucide-arrow-right" class="size-3.5" aria-hidden="true" />
                </ULink>
              </div>
            </ApiDocsFieldGroup>

            <!-- 按 webhook 处理生命周期穿插排布（= handler 代码顺序），而非把协议
                 三段捆成一整块压在 payload 之上或之下。<ApiDocsWebhookProtocol>
                 三段各自独立省略，故此处渲染两次、把 payload 夹在中间：

                 1) VERIFICATION —— 收到请求「第一件事」：验签。安全关口，须在信任
                    payload 之前置顶；内容紧凑，不会挤压 payload。 -->
            <ApiDocsWebhookProtocol :verification="verification" />

            <!-- 2) PAYLOAD —— 验签通过后解析的数据，整页主角（与端点 Request/
                 Response Body 同构）。 -->
            <ApiDocsFieldGroup label="Event Payload" :count="payloadFields.length">
              <ApiDocsFieldItem v-for="f in payloadFields" :key="f.path ?? f.name" v-bind="f" />
            </ApiDocsFieldGroup>

            <!-- 3) ACKNOWLEDGEMENT → 4) DELIVERY —— 处理完「怎么回应」与「失败怎么
                 重试/时序」。后者偏背景参考，殿后。ACK 的字面响应体示例已移至右栏
                 （见 #end），此处只保留 facts。 -->
            <ApiDocsWebhookProtocol
              :acknowledgement="acknowledgement"
              :delivery="delivery"
            />

            <!-- 可选 relations 扩展区：仅承载通用链接/描述，不把 callback、
                 response-link 或消费项目路由 shape 固化进 kit。 -->
            <ApiDocsFieldGroup label="Related Resources">
              <ul class="divide-y divide-default">
                <li v-for="relation in relations" :key="relation.to">
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
            </ApiDocsFieldGroup>
          </div>
        </div>
      </template>

      <!-- 右：线缆样本双栏。lg+ 钉成视口高 sticky 长条，Payload/ACK 纵向分栏 +
           内容优先重分配；<lg 回退为堆叠各卡自滚动。与 endpoint-reference.vue 同装配。 -->
      <template #end>
        <div class="lg:sticky lg:top-20 lg:h-[calc(100dvh-7rem)]">
          <ApiDocsCodeRail
            storage-key="api-docs-webhook-rail-split"
            resize-label="Resize payload and acknowledgement panels"
            class="h-full max-lg:space-y-4"
          >
            <template #top="{ maxHeight }">
              <ApiDocsRequestExample title="Payload" :scenarios="payloadExample" :max-height="maxHeight" />
            </template>
            <template #bottom="{ maxHeight }">
              <ApiDocsCodeBlock
                :title="ackExample.title"
                :labels="ackExample.labels"
                :variants="[{ language: ackExample.language, code: ackExample.code }]"
                :max-height="maxHeight"
              />
            </template>
          </ApiDocsCodeRail>
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
        <!-- partial：保留 requirements，省略 relations /「确认」段 / payload 示例 -->
        <figure class="space-y-4 rounded-lg border border-default p-6">
          <figcaption class="text-sm font-medium text-toned">
            Partial —— 保留 requirements 与协议，省略 relations、确认段和 payload 示例
          </figcaption>
          <header class="space-y-3 border-b border-default pb-5">
            <div class="flex flex-wrap items-center gap-2.5">
              <ApiDocsEventBadge />
              <code class="min-w-0 truncate font-mono text-sm text-highlighted">invoice.finalized</code>
            </div>
            <h3 class="text-lg font-semibold tracking-tight text-highlighted">Invoice finalized</h3>
          </header>
          <ApiDocsFieldGroup label="Requirements" :heading-level="4">
            <dl class="divide-y divide-default pt-2">
              <div
                v-for="item in partialRequirements"
                :key="item.term"
                class="flex flex-col gap-1 py-2.5"
              >
                <dt class="text-sm text-muted">{{ item.term }}</dt>
                <dd class="text-sm text-highlighted">{{ item.value }}</dd>
              </div>
            </dl>
          </ApiDocsFieldGroup>
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
