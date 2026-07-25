<script setup lang="ts">
const variants = [{
  language: 'json',
  code: '{ "ok": true }',
  highlightedHtml: '{ <span data-highlight-token="key">&quot;ok&quot;</span>: <span data-highlight-token="boolean">true</span> }',
}]
const codeLabels = {
  copySuccess: 'Code copied',
  copyFailure: 'Copy unavailable',
}

// Compile-only API probe. It is not invoked.
function copyApiContract() {
  const { copy } = useCopy(1500)
  const copyPromise = copy('legacy consumer smoke', 'Value', {
    successMessage: 'Value copied',
    failureMessage: 'Copy unavailable',
  })
  const { copyLink } = useFieldAnchor()
  // @ts-expect-error breaking change: copyLink no longer accepts a positional message
  void copyLink('amount', 'Amount link copied')
  const linkPromise = copyLink('amount', { successMessage: 'Amount link copied' })
  return Promise.all([copyPromise, linkPromise])
}
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
    <ApiDocsCodeBlock
      class="mt-8"
      title="response.json"
      :variants="variants"
      :labels="codeLabels"
      trust-highlighted-html
    />
    <CopyButton
      class="mt-4"
      value="consumer smoke"
      success-message="Value copied"
      failure-message="Copy unavailable"
    />
  </UContainer>
</template>
