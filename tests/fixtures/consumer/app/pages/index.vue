<script setup lang="ts">
const variants = [{ language: 'json', code: '{ "ok": true }' }]
const groups = [{
  label: 'API reference',
  sections: [{
    label: 'Resources',
    kind: 'endpoints' as const,
    defaultOpen: true,
    items: [{ label: 'Create resource', method: 'POST', scenarios: ['Basic', 'Batch'] }],
  }],
}]
</script>

<template>
  <UContainer class="py-8">
    <ApiDocsSidebarNav :groups="groups" :resizable="false" />
    <ApiDocsCodeBlock class="mt-8" title="response.json" :variants="variants" />
    <CopyButton class="mt-4" value="consumer smoke" />
  </UContainer>
</template>
