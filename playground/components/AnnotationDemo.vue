<script setup lang="ts">
// Playground-only demo data for the Annotation family candidates.
// Simulates the MDC narrative scenario with real fixture shapes: a glossary
// map, FieldNodes shared with the reference rows below (single source of
// truth), and async doc-preview loaders (one succeeding, one failing).

import type { FieldNode } from '../../kits/api-docs/components/FieldItem.vue'
import type { DocPreview } from './LinkAnnotation.vue'

provideGlossary({
  'idempotency-key': {
    term: '幂等键',
    definition:
      '客户端为每次创建请求生成的唯一标识。网络重试携带**相同的键**时,服务端返回首次请求的结果而不重复扣款。有效期 `24h`。',
    to: '/kits/api-docs/reference',
  },
  'webhook': {
    term: 'Webhook',
    definition: '支付状态变更时,平台向你配置的回调地址推送的异步通知,需在 *5 秒*内返回 2xx。',
  },
})

const amountField: FieldNode = {
  path: 'request-body_amount',
  name: 'amount',
  type: 'integer',
  required: true,
  description: '支付金额,单位为**最小货币单位**(如人民币为分)。必须大于 `0`,上限见商户额度配置。',
  examples: ['1000'],
}

const currencyField: FieldNode = {
  path: 'request-body_currency',
  name: 'currency',
  type: 'string',
  required: 'conditional',
  condition: '商户开通多币种结算时必填。',
  description: 'ISO 4217 三位货币代码,如 `CNY`、`USD`。默认取商户主体注册地币种。',
}

// 叙事 markdown 场景:字段一律用 field-ref 引用这里注册的源。
// 同页字段省略 page(锚点跳转);跨页字段声明 page,注释自动变为
// `{page}#{path}` 链接,目标页 initFromHash 负责展开+滚动+高亮。
provideFieldSource({
  'create-payment.amount': { field: amountField },
  'create-payment.currency': { field: currencyField },
  'create-deployment.gitSource.repoId': {
    page: '/kits/api-docs/reference',
    field: {
      path: 'body_gitSource_repoId',
      name: 'repoId',
      type: 'string',
      required: true,
      description: 'Git 仓库在源码托管商侧的唯一标识,来自 *Create Deployment* 接口(另一页面)。',
    },
  },
})

const zhLabels = {
  loading: '正在加载预览…',
  retry: '重试',
}

const termLabels = { ...zhLabels, category: '术语', learnMore: '查看详情' }
const fieldLabels = { ...zhLabels, category: '字段', required: '必填', conditional: '条件必填', viewField: '查看字段详情' }
const docLabels = { ...zhLabels, category: '文档预览', open: '打开页面', error: '预览加载失败。可重试,或直接打开页面。' }

function loadRefundGuide(): Promise<DocPreview> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        title: '退款指南',
        description: '覆盖全额退款、部分退款与退款失败重试;退款按**原路返回**,到账时间 `1-7` 个工作日。',
      })
    }, 600)
  })
}

function loadBrokenDoc(): Promise<DocPreview> {
  return new Promise((_resolve, reject) => {
    setTimeout(() => reject(new Error('not found')), 600)
  })
}
</script>

<template>
  <div class="flex flex-col gap-10">
    <!-- 场景:三种形态混排在叙事段落里(模拟 MDC 渲染结果) -->
    <section class="flex flex-col gap-3">
      <h2 class="text-sm font-semibold text-highlighted">叙事段落(三种形态混排)</h2>
      <p class="max-w-prose leading-relaxed text-toned">
        创建支付前,请求会先经过
        <PlaygroundTermAnnotation id="idempotency-key" :labels="termLabels" />
        校验;其中
        <PlaygroundFieldAnnotation field-ref="create-payment.amount" :labels="fieldLabels" />
        必须为最小货币单位的整数,而
        <PlaygroundFieldAnnotation field-ref="create-payment.currency" :labels="fieldLabels" />
        仅在多币种场景必填。部署类接口还要求
        <PlaygroundFieldAnnotation field-ref="create-deployment.gitSource.repoId" :labels="fieldLabels" />
        (跨页字段:跳转到 Reference 页并自动展开高亮)。支付结果通过
        <PlaygroundTermAnnotation id="webhook" :labels="termLabels" />
        异步通知。退款的完整流程参见
        <PlaygroundLinkAnnotation to="/kits/api-docs/reference" :load="loadRefundGuide" :labels="docLabels">
          退款指南
        </PlaygroundLinkAnnotation>
        ;历史文档链接可能失效,例如
        <PlaygroundLinkAnnotation to="/kits/api-docs" :load="loadBrokenDoc" :labels="docLabels">
          旧版对账说明
        </PlaygroundLinkAnnotation>
        (演示 error + 重试 + 兜底跳转)。另有一个
        <PlaygroundTermAnnotation id="missing-id" :labels="termLabels">
          未登记术语
        </PlaygroundTermAnnotation>
        演示未命中 glossary 时优雅降级为纯文本。
      </p>
    </section>

    <!-- 状态:disabled 触发器 -->
    <section class="flex flex-col gap-3">
      <h2 class="text-sm font-semibold text-highlighted">壳状态:disabled</h2>
      <p class="max-w-prose leading-relaxed text-toned">
        草稿态文档里的注释可以整体禁用:
        <PlaygroundAnnotationPopover disabled label="术语" :labels="zhLabels">
          被禁用的注释
        </PlaygroundAnnotationPopover>
        (不可聚焦、不可打开)。
      </p>
    </section>

    <!-- 同页字段行:字段注释的跳转目标(useFieldAnchor 滚动 + 高亮) -->
    <section class="flex flex-col gap-3">
      <h2 class="text-sm font-semibold text-highlighted">同页字段参照(跳转目标)</h2>
      <div class="divide-y divide-default rounded-lg border border-default px-4">
        <ApiDocsFieldItem v-bind="amountField" />
        <ApiDocsFieldItem v-bind="currencyField" />
      </div>
    </section>
  </div>
</template>
