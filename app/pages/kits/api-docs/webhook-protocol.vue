<script setup lang="ts">
definePageMeta({ nav: { label: 'Webhook 协议', icon: 'i-lucide-webhook', order: 3 } })

// Demo/story for <ApiDocsWebhookProtocol> — 按 geist-nuxt 分层，组件 story
// 使用本页内联的中性假 ViewModel；kit 只分发数据无关组件。
const webhookProtocol = {
  verification: {
    label: 'VERIFICATION',
    description: '每次投递都携带签名头。用密钥重新计算并比对签名，再处理事件。',
    facts: [
      { term: '签名头', value: 'X-Example-Signature', code: true },
      { term: '算法', value: 'HMAC-SHA256', code: true, note: '对原始请求体计算，编码为十六进制小写。' },
      { term: '密钥来源', value: 'Webhook 设置页生成的 signing secret。' },
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

// 变体 1：echo 语义 —— ACK body 是回显请求参数，不是字面值，用 facts 行表达。
const echoAck = {
  label: 'ACKNOWLEDGEMENT',
  description: '响应体须原样回显请求中的挑战参数。',
  facts: [
    { term: 'HTTP status', value: '200', code: true },
    { term: '响应体', value: '原样返回请求 query 中的 challenge 参数值。' },
    { term: '回显参数', value: 'challenge', code: true },
  ],
}

// label 本身不是正文；即使调用方保留了空壳对象，也应整段省略。
const omittedVerification = { label: '不应出现', facts: [] }

// 变体 2：intentional empty —— 约定就是空 body，明说而不是留白。
const emptyAck = {
  label: 'ACKNOWLEDGEMENT',
  facts: [
    { term: 'HTTP status', value: '204', code: true },
    { term: '响应体', value: '空。返回任何内容都会被忽略。' },
  ],
}

// 变体 3：只有 delivery + 无 steps schedule —— 只显示总结句。
const uniformDelivery = {
  label: 'DELIVERY',
  facts: [
    { term: '总次数', value: '最多 5 次。' },
  ],
  schedule: {
    term: '重试节奏',
    summary: '每 15 分钟一次，间隔固定。',
  },
}
</script>

<template>
  <UContainer class="py-16 sm:py-24">
    <section id="webhook-protocol" class="scroll-mt-20 space-y-10">
      <div class="space-y-2">
        <h2 class="text-2xl font-semibold tracking-tight text-highlighted">Webhook 协议</h2>
        <p class="max-w-2xl text-muted">
          <code class="font-mono text-[0.8125rem]">ApiDocsWebhookProtocol</code>：连贯呈现一个 webhook 的
          <b class="font-medium text-toned">Verification / Acknowledgement / Delivery</b> 三段协议事实，
          是 <code class="font-mono text-[0.8125rem]">OperationHeader</code>（kind="webhook"）的正文伙伴。
          三段各自独立省略——没写进契约的段<b class="font-medium text-toned">整段不出现</b>，绝不渲染空卡片；
          ACK body 语义由数据形状表达（字面值给 example、回显与刻意为空用 facts 行说明）；
          重试节奏以<b class="font-medium text-toned">总结句为可访问真源</b>，chips 只是视觉序列，长序列折叠可展开。
          组件数据无关、locale-ready，所有文案由调用方注入。
        </p>
      </div>

      <!-- 主 fixture：三段齐全（本页内联中性假 ViewModel） -->
      <div class="rounded-lg border border-default p-6 sm:p-8">
        <ApiDocsWebhookProtocol
          :verification="webhookProtocol.verification"
          :acknowledgement="webhookProtocol.acknowledgement"
          :delivery="webhookProtocol.delivery"
          :heading-level="3"
        />
      </div>

      <!-- 变体：省略规则 + ACK 三语义 + 无 steps schedule -->
      <div class="space-y-4">
        <h3 class="text-lg font-semibold text-highlighted">变体</h3>
        <div class="grid gap-4 lg:grid-cols-2">
          <figure class="space-y-3 rounded-lg border border-default p-6">
            <figcaption class="text-sm font-medium text-toned">
              ACK 为回显语义（echo）—— 没有 example，用 facts 行说明回显哪个参数
            </figcaption>
            <ApiDocsWebhookProtocol
              :verification="omittedVerification"
              :acknowledgement="echoAck"
              :heading-level="4"
            />
          </figure>
          <figure class="space-y-3 rounded-lg border border-default p-6">
            <figcaption class="text-sm font-medium text-toned">
              ACK 刻意为空（intentional empty）—— 明说「空」，而不是留白
            </figcaption>
            <ApiDocsWebhookProtocol :acknowledgement="emptyAck" :heading-level="4" />
          </figure>
          <figure class="space-y-3 rounded-lg border border-default p-6">
            <figcaption class="text-sm font-medium text-toned">
              只提供 Delivery、schedule 无 steps —— 其余两段整段省略，节奏只显示总结句
            </figcaption>
            <ApiDocsWebhookProtocol :delivery="uniformDelivery" :heading-level="4" />
          </figure>
          <figure class="space-y-3 rounded-lg border border-default p-6">
            <figcaption class="text-sm font-medium text-toned">
              折叠阈值为 1 —— 初始不铺 chip，但展开按钮仍然可用
            </figcaption>
            <ApiDocsWebhookProtocol
              :delivery="webhookProtocol.delivery"
              :heading-level="4"
              :max-schedule-steps="1"
            />
          </figure>
        </div>
      </div>

      <p class="text-sm text-dimmed">
        所有 fixture 均由本页内联，不写进 kit；正式组件仍保持数据无关。
      </p>
    </section>
  </UContainer>
</template>
