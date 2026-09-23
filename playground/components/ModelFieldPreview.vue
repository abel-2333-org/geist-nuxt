<script setup lang="ts">
import FieldItem from '../../kits/api-docs/components/FieldItem.vue'
import type { FieldNode, FieldValueNode } from '../../kits/api-docs/utils/field'
import { conditionEntries, describeFieldPresence, presenceTypeExpression } from '../../kits/api-docs/utils/field'
// Explicit prototype summary; the fixture prose must retain the full shape.
const props = defineProps<{ field: FieldNode, typeSummary?: string }>()

function shape(node: FieldNode | FieldValueNode): string {
  const value = node.value
  let result = node.type ?? 'unknown'
  if (value?.relation === 'item' && node.type === 'array') result = `array<${expression(value)}>`
  else if (value?.relation === 'member' && node.type === 'object') result = `map<string, ${expression(value)}>`
  return result
}
function expression(node: FieldValueNode): string {
  return presenceTypeExpression(shape(node), describeFieldPresence(node.presence).unionTail)
}

// Fixture-only projection: conditions explicitly name their subjects.
// This is not a consumer adapter or a replacement for the kit navigation graph.
function project(field: FieldNode): FieldNode {
  const nodes: FieldValueNode[] = []
  for (let node = field.value; node; node = node.value) nodes.push(node)
  if (nodes.some(n => n.path || n.composition || n.enumValues || n.enumVariants
    || n.examples || n.defaultValue !== undefined || n.description
    || (n.fields?.length && n.value))) return field
  const conditions = [
    ...conditionEntries(field.presence?.condition),
    ...nodes.flatMap(n => conditionEntries(n.presence?.condition)),
  ]
  const decoding = nodes.filter(n => n.relation === 'decoded').map(n => {
    const action = n.codec === 'json' ? 'JSON 解析' : n.codec === 'base64' ? 'Base64 解码' : `${n.codec ?? ''}解码`
    return `${action}后为 \`${expression(n)}\``
  }).join('；随后')
  return {
    ...field,
    type: shape(field),
    format: field.format,
    description: [field.description, decoding ? `${decoding}。` : undefined].filter(Boolean).join(' '),
    presence: field.presence || conditions.length ? { ...field.presence, condition: conditions } : undefined,
    notes: [...(field.notes ?? []), ...nodes.flatMap(n => n.notes ?? [])],
    children: (field.children ?? nodes.flatMap(n => n.fields ?? [])).map(project),
    value: undefined,
  }
}
const projected = computed(() => {
  const field = project(props.field)
  return props.typeSummary ? { ...field, type: props.typeSummary } : field
})
</script>

<template>
  <div class="field-preview">
    <FieldItem v-bind="projected" :labels="{ required: '必填', conditional: '条件必填', showChildren: '展开子参数', hideChildren: '收起子参数', mayBeOmitted: '可能不返回此字段', eachItem: '每个元素', eachMember: '每个成员', decodedRequirements: '解码内容', decodedArrayRequirements: '解码后数组', example: '示例', default: '默认值', constraints: '约束', note: '规则', caveat: '注意', enumLabel: '可选值' }" />
  </div>
</template>
