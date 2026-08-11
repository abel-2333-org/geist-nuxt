<script setup lang="ts">
// API Docs internal row primitive. Slots keep protocol facts, requirements and
// relation sources semantically independent while sharing one reflow contract.
//
// Rich-value rendering (e.g. WebhookProtocol's `format: 'inline-markdown'`)
// deliberately lives in the owning component via the #value slot, not here:
// FactRow ships with multiple registry slices, and baking InlineMarkdown in
// would drag foundation-inline-markdown (+ marked) into every slice whether
// used or not. Sink a shared `format` switch here only when a SECOND adopted
// component needs rich facts, and re-evaluate the closure cost then (#76).
export interface Fact {
  term: string
  value?: string
  code?: boolean
  note?: string
}

defineProps<{
  fact: Fact
}>()

defineSlots<{
  term?(props: { fact: Fact }): unknown
  value?(props: { fact: Fact }): unknown
}>()
</script>

<template>
  <div
    data-fact-row
    class="flex flex-col gap-1 py-2.5 @sm/facts:flex-row @sm/facts:items-baseline @sm/facts:gap-4"
  >
    <dt class="shrink-0 text-sm text-muted @sm/facts:w-36">
      <slot name="term" :fact="fact">
        {{ fact.term }}
      </slot>
    </dt>
    <dd class="min-w-0 space-y-1">
      <slot name="value" :fact="fact">
        <InlineCode
          v-if="fact.code && fact.value !== undefined"
          class="wrap-anywhere min-w-0"
          translate="no"
        >
          {{ fact.value }}
        </InlineCode>
        <span v-else-if="fact.value !== undefined" class="wrap-anywhere text-sm text-highlighted">
          {{ fact.value }}
        </span>
        <p v-if="fact.note" class="wrap-anywhere text-sm leading-relaxed text-muted">
          {{ fact.note }}
        </p>
      </slot>
    </dd>
  </div>
</template>
