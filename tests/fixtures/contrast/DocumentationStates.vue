<script setup lang="ts">
import FieldValueStructure from '../../../kits/api-docs/internal/FieldValueStructure.vue'
import { fieldValueLabelDefaults } from '../../../kits/api-docs/utils/field'
import type { FieldNode, FieldValueChrome, FieldValueNode } from '../../../kits/api-docs/utils/field'

const anchor = useFieldAnchor()
const countedField: FieldNode = {
  path: 'contrast-counted-field', name: 'counted', type: 'string',
  notes: [{ text: 'First requirement.' }, { text: 'Second requirement.' }],
}
const expandableField: FieldNode = {
  path: 'contrast-expandable-field', name: 'expanded', type: 'object',
  children: [{ path: 'contrast-child', name: 'child', type: 'string', description: 'Child description.' }],
}
const value: FieldValueNode = {
  path: 'contrast-value', relation: 'item', type: 'object',
  fields: [{ path: 'contrast-value-child', name: 'valueChild', type: 'string', description: 'Value child description.' }],
}
const chrome: FieldValueChrome = {
  ...fieldValueLabelDefaults,
  caveat: 'Caveat', note: 'Note', default: 'Default', example: 'Example',
  showChildren: 'Show Child Parameters', hideChildren: 'Hide Child Parameters',
}
const enumValues = [
  { value: 'first', description: 'First allowed value' },
  { value: 'second', description: 'Second allowed value' },
]

onMounted(() => anchor.initFromHash())
</script>

<template>
  <section data-testid="documentation-states" class="space-y-8">
    <div data-testid="field-count"><FieldItem v-bind="countedField" /></div>
    <div data-testid="enum-count"><EnumTable :values="enumValues" /></div>
    <div data-testid="field-expand"><FieldItem v-bind="expandableField" /></div>
    <div data-testid="value-expand"><FieldValueStructure :value="value" :chrome="chrome" /></div>
    <UButton data-testid="field-arrival-trigger" color="neutral" variant="outline" @click="anchor.goTo('contrast-arrival-field')">Go to field</UButton>
    <div data-testid="field-arrival">
      <FieldItem path="contrast-arrival-field" name="arrival" type="string" description="Arrival description with normal text." />
    </div>
  </section>
</template>
