<script setup lang="ts">
// issue #22 探索现场：Webhook protocol facts 的两种拼法并排验证。
// 候选 A：<PlaygroundWebhookProtocol>（单组件，props 驱动 + section 省略）
// 候选 B：纯原语 recipe（FieldGroup + dl + InlineCode + UBadge + CodeBlock 手拼）
// 数据全部为中性虚构 API（api.example.com / resource.updated），无产品专名。
definePageMeta({ nav: false })

/* ---------------- fixture：三段齐全（默认世界观） ---------------- */
const verification = {
  label: 'VERIFICATION',
  description: '每次投递都携带签名头。用密钥重新计算并比对签名，再处理事件。',
  facts: [
    { term: '签名头', value: 'X-Example-Signature', code: true },
    { term: '算法', value: 'HMAC-SHA256', code: true, note: '对原始请求体计算，编码为十六进制小写。' },
    { term: '密钥来源', value: '控制台 Webhook 设置页生成的 signing secret。' },
    { term: '时效', value: '签名含时间戳，偏差超过 5 分钟应拒绝，防止重放。' },
  ],
}

const ackLiteral = {
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
}

const ackEcho = {
  label: 'ACKNOWLEDGEMENT',
  description: '订阅校验阶段的握手确认。',
  facts: [
    { term: 'HTTP status', value: '200', code: true },
    { term: 'Media type', value: 'text/plain', code: true },
    { term: '响应体', value: 'challenge', code: true, note: '原样回显请求查询参数 challenge 的值，不加引号或包装。' },
  ],
}

const ackEmpty = {
  label: 'ACKNOWLEDGEMENT',
  facts: [
    { term: 'HTTP status', value: '204', code: true },
    { term: '响应体', value: '必须为空。', note: '任何响应体都会被忽略；仅以状态码判定确认成功。' },
  ],
}

const deliveryUniform = {
  label: 'DELIVERY',
  description: '未收到成功确认时按固定节奏重试。',
  facts: [
    { term: '总次数', value: '首次投递 + 最多 12 次重试。' },
    { term: '超时', value: '每次请求 10 秒未响应即视为失败。' },
    { term: '成功条件', value: '收到上述确认响应即停止重试。' },
  ],
  schedule: {
    term: '重试节奏',
    summary: '每 5 分钟重试一次，共 12 次。',
  },
}

const deliveryBackoff = {
  label: 'DELIVERY',
  description: '未收到成功确认时按退避序列重试。',
  facts: [
    { term: '总次数', value: '首次投递 + 最多 5 次重试。' },
    { term: '成功条件', value: '任意一次收到成功确认即停止。' },
  ],
  schedule: {
    term: '重试节奏',
    summary: '按 1 分钟、5 分钟、30 分钟、2 小时、6 小时逐步退避。',
    steps: ['1 分钟', '5 分钟', '30 分钟', '2 小时', '6 小时'],
  },
}

const deliveryLong = {
  label: 'DELIVERY',
  facts: [
    { term: '总次数', value: '首次投递 + 最多 10 次重试。' },
    { term: '超时', value: '每次请求 15 秒。' },
  ],
  schedule: {
    term: '重试节奏',
    summary: '从 30 秒起逐步退避到 24 小时，共 10 次。',
    steps: ['30 秒', '1 分钟', '5 分钟', '15 分钟', '30 分钟', '1 小时', '3 小时', '6 小时', '12 小时', '24 小时'],
    expandLabel: (n: number) => `展开其余 ${n} 档`,
    collapseLabel: '收起',
  },
}
</script>

<template>
  <PlaygroundStage
    title="Webhook protocol facts 探索"
    description="issue #22：候选 A（单组件）与候选 B（纯原语 recipe）并排验证。"
  >
    <!-- 1. 候选 A：三段齐全 -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold text-highlighted">候选 A · 三段齐全</h2>
      <PlaygroundWebhookProtocol
        :verification="verification"
        :acknowledgement="ackLiteral"
        :delivery="deliveryBackoff"
        :heading-level="3"
      />
    </section>

    <!-- 2. section 独立省略 -->
    <section class="space-y-6">
      <h2 class="text-lg font-semibold text-highlighted">候选 A · section 独立省略</h2>
      <div class="grid gap-6 lg:grid-cols-3">
        <div class="space-y-2">
          <p class="text-xs text-dimmed">只 Verification</p>
          <PlaygroundWebhookProtocol :verification="verification" :heading-level="3" />
        </div>
        <div class="space-y-2">
          <p class="text-xs text-dimmed">只 Acknowledgement（echo）</p>
          <PlaygroundWebhookProtocol :acknowledgement="ackEcho" :heading-level="3" />
        </div>
        <div class="space-y-2">
          <p class="text-xs text-dimmed">只 Delivery（固定节奏，无 steps）</p>
          <PlaygroundWebhookProtocol :delivery="deliveryUniform" :heading-level="3" />
        </div>
      </div>
    </section>

    <!-- 3. ACK 三语义 -->
    <section class="space-y-6">
      <h2 class="text-lg font-semibold text-highlighted">候选 A · ACK body 三语义</h2>
      <div class="grid gap-6 lg:grid-cols-3">
        <div class="space-y-2">
          <p class="text-xs text-dimmed">literal（有文本 body → CodeBlock）</p>
          <PlaygroundWebhookProtocol :acknowledgement="ackLiteral" :heading-level="3" />
        </div>
        <div class="space-y-2">
          <p class="text-xs text-dimmed">echo（回显参数 → InlineCode）</p>
          <PlaygroundWebhookProtocol :acknowledgement="ackEcho" :heading-level="3" />
        </div>
        <div class="space-y-2">
          <p class="text-xs text-dimmed">intentional empty（明确空 body）</p>
          <PlaygroundWebhookProtocol :acknowledgement="ackEmpty" :heading-level="3" />
        </div>
      </div>
    </section>

    <!-- 4. 长 schedule 折叠 -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold text-highlighted">候选 A · 长 schedule（10 档折叠）</h2>
      <PlaygroundWebhookProtocol :delivery="deliveryLong" :heading-level="3" />
    </section>

    <!-- 5. 候选 B：纯原语 recipe（同一数据手拼，对照复杂度与漂移面） -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold text-highlighted">候选 B · 纯原语 recipe（同一数据）</h2>
      <div class="space-y-8">
        <ApiDocsFieldGroup label="VERIFICATION" :heading-level="3">
          <div class="space-y-4 pt-2">
            <p class="text-sm leading-relaxed text-muted">
              每次投递都携带签名头。用密钥重新计算并比对签名，再处理事件。
            </p>
            <dl class="divide-y divide-default">
              <div class="flex flex-col gap-1 py-2.5 sm:flex-row sm:gap-4">
                <dt class="shrink-0 text-sm text-muted sm:w-36">签名头</dt>
                <dd class="min-w-0"><InlineCode>X-Example-Signature</InlineCode></dd>
              </div>
              <div class="flex flex-col gap-1 py-2.5 sm:flex-row sm:gap-4">
                <dt class="shrink-0 text-sm text-muted sm:w-36">算法</dt>
                <dd class="min-w-0 space-y-1">
                  <InlineCode>HMAC-SHA256</InlineCode>
                  <p class="text-sm leading-relaxed text-muted">对原始请求体计算，编码为十六进制小写。</p>
                </dd>
              </div>
            </dl>
          </div>
        </ApiDocsFieldGroup>

        <ApiDocsFieldGroup label="ACKNOWLEDGEMENT" :heading-level="3">
          <div class="space-y-4 pt-2">
            <p class="text-sm leading-relaxed text-muted">
              返回下列响应即视为确认成功；其它响应触发重试。
            </p>
            <dl class="divide-y divide-default">
              <div class="flex flex-col gap-1 py-2.5 sm:flex-row sm:gap-4">
                <dt class="shrink-0 text-sm text-muted sm:w-36">HTTP status</dt>
                <dd class="min-w-0"><InlineCode>200</InlineCode></dd>
              </div>
              <div class="flex flex-col gap-1 py-2.5 sm:flex-row sm:gap-4">
                <dt class="shrink-0 text-sm text-muted sm:w-36">Media type</dt>
                <dd class="min-w-0"><InlineCode>application/json</InlineCode></dd>
              </div>
            </dl>
            <ApiDocsCodeBlock
              title="确认响应体"
              :variants="[{ language: 'json', code: '{\n  &quot;received&quot;: true\n}' }]"
              max-height="16rem"
            />
          </div>
        </ApiDocsFieldGroup>

        <ApiDocsFieldGroup label="DELIVERY" :heading-level="3">
          <div class="space-y-4 pt-2">
            <p class="text-sm leading-relaxed text-muted">未收到成功确认时按退避序列重试。</p>
            <dl class="divide-y divide-default">
              <div class="flex flex-col gap-1 py-2.5 sm:flex-row sm:gap-4">
                <dt class="shrink-0 text-sm text-muted sm:w-36">总次数</dt>
                <dd class="min-w-0 text-sm text-highlighted">首次投递 + 最多 5 次重试。</dd>
              </div>
              <div class="flex flex-col gap-1 py-2.5 sm:flex-row sm:gap-4">
                <dt class="shrink-0 text-sm text-muted sm:w-36">重试节奏</dt>
                <dd class="min-w-0 space-y-2">
                  <p class="text-sm text-highlighted">按 1 分钟、5 分钟、30 分钟、2 小时、6 小时逐步退避。</p>
                  <div class="flex flex-wrap items-center gap-1.5">
                    <template v-for="(step, i) in ['1 分钟', '5 分钟', '30 分钟', '2 小时', '6 小时']" :key="i">
                      <UIcon v-if="i > 0" name="i-lucide-arrow-right" class="size-3 shrink-0 text-dimmed" aria-hidden="true" />
                      <UBadge color="neutral" variant="soft" class="font-mono tabular-nums" aria-hidden="true">{{ step }}</UBadge>
                    </template>
                  </div>
                </dd>
              </div>
            </dl>
          </div>
        </ApiDocsFieldGroup>
      </div>
    </section>
  </PlaygroundStage>
</template>
