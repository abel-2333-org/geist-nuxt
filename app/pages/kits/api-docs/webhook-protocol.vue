<script setup lang="ts">
definePageMeta({ nav: { label: 'Webhook 协议', icon: 'i-lucide-webhook', order: 3 } })

// Demo/story for <ApiDocsWebhookProtocol> — 按 geist-nuxt 分层，demo 数据
// 与讲解归 gallery，kit 只分发数据无关组件。主 fixture 复用 docs-shell 演示
// 数据源（paymentsWebhookProtocol），下方变体区用内联 fixture 演示省略规则
// 与 ACK 三种 body 语义（literal / echo / intentional empty）。
import { paymentsWebhookProtocol } from '~/utils/demo/api-docs/docs-shell-data'

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

      <!-- 主 fixture：三段齐全（复用 docs-shell 演示数据源） -->
      <div class="rounded-lg border border-default p-6 sm:p-8">
        <ApiDocsWebhookProtocol
          :verification="paymentsWebhookProtocol.verification"
          :acknowledgement="paymentsWebhookProtocol.acknowledgement"
          :delivery="paymentsWebhookProtocol.delivery"
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
            <ApiDocsWebhookProtocol :acknowledgement="echoAck" :heading-level="4" />
          </figure>
          <figure class="space-y-3 rounded-lg border border-default p-6">
            <figcaption class="text-sm font-medium text-toned">
              ACK 刻意为空（intentional empty）—— 明说「空」，而不是留白
            </figcaption>
            <ApiDocsWebhookProtocol :acknowledgement="emptyAck" :heading-level="4" />
          </figure>
          <figure class="space-y-3 rounded-lg border border-default p-6 lg:col-span-2">
            <figcaption class="text-sm font-medium text-toned">
              只提供 Delivery、schedule 无 steps —— 其余两段整段省略，节奏只显示总结句
            </figcaption>
            <ApiDocsWebhookProtocol :delivery="uniformDelivery" :heading-level="4" />
          </figure>
        </div>
      </div>

      <p class="text-sm text-dimmed">
        主 fixture 来自 docs-shell 演示数据源；变体数据由本页内联，不写进 kit。
      </p>
    </section>
  </UContainer>
</template>
