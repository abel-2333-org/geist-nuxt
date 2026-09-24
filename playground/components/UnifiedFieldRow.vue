<script lang="ts">
export interface PreviewField {
  name: string
  type: string
  requirement: string
  description: string
  encoded?: boolean
  condition?: string
  children?: PreviewField[]
}
</script>

<script setup lang="ts">
import FieldItem from '../../kits/api-docs/components/FieldItem.vue'
import type { FieldNode } from '../../kits/api-docs/utils/field'
const props = defineProps<{ field: PreviewField }>()
// Display-only projection of the selected excerpt; not a consumer adapter.
function project(field: PreviewField): FieldNode {
  return {
    name: field.name,
    type: field.encoded ? 'string' : field.type,
    required: field.requirement === '必填' ? true : field.requirement === '条件必填' ? 'conditional' : false,
    condition: field.condition,
    description: field.encoded
      ? `${field.description} JSON 字符串，解析后为 \`${field.type}\`。`
      : field.description,
    children: field.children?.map(project),
  }
}
const projected = computed(() => project(props.field))
</script>

<template>
  <div class="field-preview">
    <FieldItem v-bind="projected" :labels="{ required: '必填', conditional: '条件必填', showChildren: '展开子参数', hideChildren: '收起子参数' }" />
  </div>
</template>
