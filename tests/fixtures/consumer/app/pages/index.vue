<script setup lang="ts">
import CopyButtonContract from '../components/CopyButton.vue'
import CodeBlockContract from '../components/CodeBlock.vue'
import OperationTargetContract from '../components/OperationTarget.vue'

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
  // @ts-expect-error clean-cut contract: timeout must be named
  void useCopy(1500)
  const { copy } = useCopy({ timeout: 1500 })
  // @ts-expect-error clean-cut contract: partial labels cannot form toast sentences
  void copy('legacy consumer smoke', 'Value')
  // @ts-expect-error clean-cut contract: object labels were removed too
  void copy('legacy consumer smoke', { label: 'Value' })
  const copyPromise = copy('consumer smoke', {
    successMessage: 'Value copied',
    failureMessage: 'Copy unavailable',
  })
  const { copyLink } = useFieldAnchor()
  // @ts-expect-error breaking change: copyLink no longer accepts a positional message
  void copyLink('amount', 'Amount link copied')
  const linkPromise = copyLink('amount', { successMessage: 'Amount link copied' })
  return Promise.all([copyPromise, linkPromise])
}

type CopyButtonProps = InstanceType<typeof CopyButtonContract>['$props']
type CodeBlockProps = InstanceType<typeof CodeBlockContract>['$props']
type OperationTargetProps = InstanceType<typeof OperationTargetContract>['$props']

// Compile-only component API probes. They are not invoked.
function componentApiContract() {
  const copyButton: CopyButtonProps = {
    value: 'legacy',
    // @ts-expect-error clean-cut contract: toastLabel was removed
    toastLabel: 'Value',
  }
  const codeBlock: CodeBlockProps = {
    labels: {
      // @ts-expect-error clean-cut contract: copyToast was removed
      copyToast: 'Code',
    },
  }
  const copyToast: OperationTargetProps = {
    hosts: legacyHosts,
    path: '/v1/test',
    // @ts-expect-error clean-cut contract: copyToastLabel was removed
    copyToastLabel: 'Endpoint',
  }
  const hostToast: OperationTargetProps = {
    hosts: legacyHosts,
    path: '/v1/test',
    // @ts-expect-error clean-cut contract: hostToastLabel was removed
    hostToastLabel: 'Host',
  }
  const pathToast: OperationTargetProps = {
    hosts: legacyHosts,
    path: '/v1/test',
    // @ts-expect-error clean-cut contract: pathToastLabel was removed
    pathToastLabel: 'Path',
  }
  return [copyButton, codeBlock, copyToast, hostToast, pathToast]
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
const legacyHosts = [{ id: 'prod', label: 'Production', baseUrl: 'https://api.example.com' }]
</script>

<template>
  <UContainer class="py-8">
    <SidebarNav :groups="groups" :resizable="false" />
    <CodeBlock
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
