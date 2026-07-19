<script setup lang="ts">
// Domain component (API docs): the "where do I call this" line of an endpoint
// reference — environment host picker + full request address + copy. Sits
// directly under <ApiDocsOperationHeader> (typically in its trailing slot area
// or right after it in the flow).
//
// Scope note: this component is calibrated for ENDPOINTS (you call the
// platform). For webhooks the "target" is the consumer's own subscription URL
// — a sentence of copy, not an address bar — so webhook headers should NOT
// force this component in.
//
// Anatomy:  [ USelect (env, only when hosts > 1) | mono full address | CopyButton ]
//           one bordered `bg-elevated` row, mono address truncates, copy pinned.
// States:   selected host (v-model, defaults to the first host); copy
//           idle/copied is owned by <CopyButton>/useCopy.
// A11y:     the select carries an aria-label (labelled control, not color/
//           position); address is real text (selectable, screen-reader
//           readable); CopyButton owns its focus ring + live region.

export interface OperationHost {
  id: string
  /** Human name of the environment, e.g. "生产" / "沙箱". */
  label: string
  /** Scheme + host (no trailing slash), e.g. "https://api.example.cn". */
  baseUrl: string
}

const props = defineProps<{
  /** At least one host. One host → no select, just address + copy. */
  hosts: OperationHost[]
  /** Operation path, appended verbatim to the selected host's baseUrl. */
  path: string
  /** Accessible name for the environment select. */
  selectLabel?: string
  /** Toast object name for the copy action, e.g. "Endpoint". */
  copyToastLabel?: string
}>()

const selected = defineModel<string>({ default: undefined })

const activeHost = computed(
  () => props.hosts.find(h => h.id === selected.value) ?? props.hosts[0],
)

const selectItems = computed(() =>
  props.hosts.map(h => ({ label: h.label, value: h.id })),
)

const fullAddress = computed(() =>
  activeHost.value ? `${activeHost.value.baseUrl}${props.path}` : props.path,
)
</script>

<template>
  <div
    class="flex min-w-0 items-center gap-2 rounded-md border border-default bg-elevated py-1 pl-1 pr-1"
  >
    <USelect
      v-if="props.hosts.length > 1"
      v-model="selected"
      :items="selectItems"
      :default-value="props.hosts[0]?.id"
      :aria-label="props.selectLabel ?? 'Environment'"
      size="sm"
      variant="soft"
      class="shrink-0"
    />

    <code class="min-w-0 flex-1 truncate px-1 font-mono text-sm text-highlighted">
      {{ fullAddress }}
    </code>

    <CopyButton
      :value="fullAddress"
      :toast-label="props.copyToastLabel ?? 'Endpoint'"
      size="sm"
    />
  </div>
</template>
