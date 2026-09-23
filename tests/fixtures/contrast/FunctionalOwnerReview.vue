<script setup lang="ts">
import type { SiteSearchGroup } from '../../../kits/api-docs/components/SiteSearch.vue'

// Complement the existing POST/Active and webhook gallery instances with the
// remaining default presets, without inventing a props Cartesian product.
const operations = [
  { method: 'GET', lifecycle: 'beta' },
  { method: 'PUT', lifecycle: 'deprecated' },
  { method: 'PATCH', lifecycle: 'sunset' },
  { method: 'DELETE', lifecycle: 'maintenance' },
] as const
const groups: SiteSearchGroup[] = [{
  id: 'put-operations',
  label: 'PUT operations',
  items: [
    { label: 'Current operation', method: 'PUT', to: '/__functional-contrast?case=owner-review' },
    { label: 'Other operation', method: 'PUT', to: '/__contrast' },
  ],
}]
</script>

<template>
  <div class="space-y-8" data-testid="owner-review-fixture">
    <SiteSearch :groups="groups" />
    <OperationHeader
      v-for="operation in operations"
      :key="operation.method"
      kind="endpoint"
      :method="operation.method"
      :path="`/v1/operations/${operation.method.toLowerCase()}`"
      :summary="`${operation.method} operation`"
      :lifecycle="operation.lifecycle"
      :data-operation="operation.method"
    >
      <template #description>Default {{ operation.lifecycle }} operation description.</template>
    </OperationHeader>
  </div>
</template>
