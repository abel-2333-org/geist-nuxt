<script setup lang="ts">
import type { PreviewField } from './UnifiedFieldRow.vue'
import type { FieldNode } from '../../kits/api-docs/utils/field'
import ModelFieldPreview from './ModelFieldPreview.vue'

// Synthetic edge cases, separate from the payment endpoint excerpt below.
const cases: FieldNode[] = [
  { name: 'refunds', type: 'array', description: '退款记录。', presence: { optional: true, nullable: true, condition: '未发生退款时不返回；记录暂不可用时整个字段为 null。' }, value: { relation: 'item', type: 'object', presence: { nullable: true, condition: '退款处理中，对应位置保留为 null。' }, fields: [{ name: 'id', type: 'string', description: '退款标识。' }] } },
  { name: 'metadata', type: 'object', description: '自定义元数据，键名由调用方提供。', value: { relation: 'member', type: 'string', presence: { nullable: true, condition: '成员值尚未确定时为 null。' }, notes: [{ label: '长度', text: '每个字符串不超过 100 个字符。' }] } },
  { name: 'batches', type: 'array', description: '分批返回的记录，每个批次包含一个记录数组，每条记录是一个对象。', value: { relation: 'item', type: 'array', presence: { nullable: true, condition: '批次未就绪时为 null。' }, value: { relation: 'item', type: 'object', presence: { nullable: true, condition: '单条记录未就绪时为 null。' }, fields: [{ name: 'id', type: 'string', description: '记录标识。' }] } } },
  { name: 'payload', type: 'string', description: '编码后的数据。直接返回 null 与返回字符串 "null" 含义不同。', presence: { nullable: true, condition: '未生成数据时，直接返回 null。' }, value: { relation: 'decoded', codec: 'json', type: 'object', presence: { nullable: true, condition: '内容被清除时，返回字符串 "null"。' }, fields: [{ name: 'id', type: 'string', description: '数据标识。' }] } },
  { name: 'encodedPayload', type: 'string', description: '先执行 Base64 解码，再解析 JSON。', value: { relation: 'decoded', codec: 'base64', type: 'string', value: { relation: 'decoded', codec: 'json', type: 'object', fields: [{ name: 'id', type: 'string', description: '解码后的数据标识。' }] } } },
  { name: 'mode', type: 'string', required: true, description: '处理方式。', defaultValue: 'standard', examples: ['standard'], enumValues: [{ value: 'standard', description: '标准处理。' }, { value: 'priority', description: '优先处理。' }], notes: [{ kind: 'constraint', label: '限制', text: '仅接受列出的取值。' }, { kind: 'caveat', text: '优先处理不保证立即完成。' }] },
]

// A selected excerpt for layout review, not the complete endpoint contract.
const fields: PreviewField[] = [
  { name: 'billingInformation', type: 'object', encoded: true, requirement: '必填', description: '交易账单信息，包括客户账单地址与联系方式。', children: [
    { name: 'firstName', type: 'string', requirement: '可选', description: '客户名字。' },
    { name: 'lastName', type: 'string', requirement: '可选', description: '客户姓氏。' },
    { name: 'phone', type: 'string', requirement: '可选', description: '客户电话号码，仅填本地号码（不含国家码）；与 phoneCountryCode 组合为完整号码。' },
    { name: 'phoneCountryCode', type: 'string', requirement: '条件必填', description: '客户电话号码的国家拨号代码，纯数字，不含 +。', condition: '当 `lpmsType` 为 `MB_WAY` 时必填。' },
    { name: 'email', type: 'string', requirement: '必填', description: '客户邮箱地址，用于交易确认和争议处理。' },
  ] },
  { name: 'txnOrderMsg', type: 'object', encoded: true, requirement: '必填', description: '交易业务信息，包含付款后的返回地址和商品信息。', children: [
    { name: 'returnUrl', type: 'string', requirement: '必填', description: '客户付款完成后的同步返回地址。返回时应主动查询交易结果。' },
    { name: 'products', type: 'array<object>', encoded: true, requirement: '必填', description: '顾客购买的商品信息列表；商品金额、折扣和运费合计需要等于 orderAmount。', children: [
      { name: 'name', type: 'string', requirement: '必填', description: '商品名称。' },
      { name: 'price', type: 'string', requirement: '必填', description: '商品单价。' },
      { name: 'num', type: 'string', requirement: '必填', description: '商品数量。' },
      { name: 'currency', type: 'string', requirement: '必填', description: 'ISO 4217 三位字母货币代码。' },
      { name: 'productAvatarUrl', type: 'string', requirement: '条件必填', description: '商品图片链接。', condition: '当 `lpmsType` 为 `stcpay`、`tamara`、`tabby` 或 `cardpay` 时必填。' },
    ] },
  ] },
]
</script>

<template>
  <div class="max-w-3xl">
    <PlaygroundUnifiedFieldRow v-for="field in fields" :key="field.name" :field="field" />
  </div>
  <section class="mt-12 max-w-3xl border-t border-default pt-8" aria-labelledby="edge-cases-title">
    <h2 id="edge-cases-title" class="text-lg font-semibold text-highlighted">复杂情况</h2>
    <p class="mt-2 text-sm text-muted">以下为合成样例：类型合并到字段头，条件保留在折叠外，其余样式复用现有组件。</p>
    <div class="mt-4"><ModelFieldPreview v-for="field in cases" :key="field.name" :field="field" :type-summary="field.name === 'batches' ? 'array' : undefined" /></div>
  </section>
</template>
