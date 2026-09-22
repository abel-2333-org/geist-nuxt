<script setup lang="ts">
import type { FieldNode } from '../../../kits/api-docs/utils/field'
import type { ResponseScenario } from '../../../kits/api-docs/components/ResponseExample.vue'

const props = defineProps<{ surface: string }>()
const selectedFields = computed(() => {
  const surface = { name: props.surface }
  return {
  surface: surface.name,
  required: {
    path: `functional-${surface.name}-required`,
    name: 'amount',
    type: 'integer',
    required: true,
    description: 'Amount in the smallest currency unit.',
  } satisfies FieldNode,
  conditional: {
    path: `functional-${surface.name}-conditional`,
    name: 'reference',
    type: 'string',
    required: 'conditional',
    condition: 'Required when the operation uses an external reference.',
    description: 'Reference used to correlate the operation.',
    notes: [{ kind: 'caveat', label: 'Caveat', text: 'This reference is visible in exported reports.' }],
  } satisfies FieldNode,
  value: {
    path: `functional-${surface.name}-value`,
    name: 'metadata',
    type: 'string',
    format: 'json_string',
    description: 'Additional information encoded as JSON.',
    value: {
      path: `functional-${surface.name}-decoded`,
      relation: 'decoded',
      codec: 'json',
      type: 'object',
      notes: [{ kind: 'caveat', label: 'Caveat', text: 'Decoded values are stored as supplied.' }],
    },
  } satisfies FieldNode,
}
})
const responseExamples = [
  { status: 200, statusText: 'OK' },
  { status: 302, statusText: 'Found' },
  { status: 400, statusText: 'Bad Request' },
  { status: 500, statusText: 'Internal Server Error' },
].map(({ status, statusText }) => ({
  status,
  scenarios: [{
    id: `response-${status}`,
    label: statusText,
    statuses: [{
      status,
      statusText,
      description: `${status} response example.`,
      bodies: [{ id: 'json', kind: 'code', mediaType: 'application/json', variants: [{ language: 'json', code: '{ "example": true }' }] }],
    }],
  }] satisfies ResponseScenario[],
}))
const lifecycleExamples = [
  { status: 'beta', title: 'Beta', description: 'This operation is available for evaluation.' },
  { status: 'active', title: 'Active', description: 'This operation is available for integration.' },
  { status: 'maintenance', title: 'Maintenance', description: 'This operation is undergoing maintenance.' },
  { status: 'deprecated', title: 'Deprecated', description: 'Use the replacement operation for new integrations.' },
  { status: 'sunset', title: 'Sunsetting', description: 'Migrate before this operation is retired.' },
] as const
</script>

<template>
  <div class="space-y-4" data-testid="api-fixture">
    <h3 class="text-lg font-semibold text-highlighted">API field colors</h3>
    <p class="flex flex-wrap gap-4 text-sm">
      <span data-annotation="required"><FieldAnnotation :field="selectedFields.required" /></span>
      <span data-annotation="conditional"><FieldAnnotation :field="selectedFields.conditional" /></span>
    </p>
    <div data-field-example="required"><FieldItem v-bind="selectedFields.required" /></div>
    <div data-field-example="conditional"><FieldItem v-bind="selectedFields.conditional" /></div>
    <div data-field-example="value-caveat"><FieldItem v-bind="selectedFields.value" /></div>
    <div class="grid gap-4 sm:grid-cols-2">
      <div v-for="response in responseExamples" :key="response.status" :data-response-status="response.status" class="min-w-0">
        <ResponseExample :scenarios="response.scenarios" />
      </div>
    </div>
    <!-- New is a field lifecycle, so its real consumer is LifecycleBadge. -->
    <div data-lifecycle="new"><LifecycleBadge status="new" /></div>
    <LifecycleNotice
      v-for="lifecycle in lifecycleExamples"
      :key="lifecycle.status"
      :status="lifecycle.status"
      :title="lifecycle.title"
      :description="lifecycle.description"
      :data-lifecycle="lifecycle.status"
    />
  </div>
</template>
