<script setup lang="ts">
import { ULink } from '#components'
import { useFieldAnchor } from '../../kits/api-docs/composables/useFieldAnchor'

export interface RelationSource {
  scope: 'request' | 'response'
  location: 'body' | 'path' | 'query' | 'header'
  segments: string[]
  /** Same-page field identity. Navigation uses the kit's reveal/focus contract. */
  field?: string
  /** Optional cross-page field URL. Takes precedence over field. */
  to?: string
}

export type RelationSourceKey = `${RelationSource['scope']}:${RelationSource['location']}`

export interface RelationSourcePathLabels {
  scope?: Partial<Record<RelationSourceKey, string>>
  prefix?: string
  connector?: string
}

const props = defineProps<{
  source: RelationSource
  labels?: RelationSourcePathLabels
}>()

const anchor = useFieldAnchor()

const scopes = computed<Record<RelationSourceKey, string>>(() => ({
  'request:body': 'Request body',
  'request:path': 'Request path',
  'request:query': 'Request query',
  'request:header': 'Request header',
  'response:body': 'Response body',
  'response:path': 'Response path',
  'response:query': 'Response query',
  'response:header': 'Response header',
  ...props.labels?.scope,
}))

const segments = computed(() => [
  scopes.value[`${props.source.scope}:${props.source.location}`],
  ...props.source.segments,
])

const prefix = computed(() => props.labels?.prefix ?? 'Source:')
const connector = computed(() => props.labels?.connector ?? 'under')
const linked = computed(() => Boolean(props.source.to || props.source.field))
const href = computed(() =>
  props.source.field && !props.source.to
    ? `#${encodeURIComponent(props.source.field)}`
    : undefined,
)
const events = computed(() => href.value ? { click: jump } : {})

function jump(event: MouseEvent) {
  if (!props.source.field || props.source.to) return
  event.preventDefault()
  void anchor.goTo(props.source.field, { focus: true })
}
</script>

<template>
  <component
    :is="source.to ? ULink : source.field ? 'a' : 'span'"
    :to="source.to"
    :href="href"
    class="group flex min-w-0 flex-wrap items-center gap-y-0.5 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    v-on="events"
  >
    <span class="sr-only">{{ `${prefix} ` }}</span>
    <template
      v-for="(segment, i) in segments"
      :key="i"
    >
      <span v-if="i > 0" class="sr-only">{{ ` ${connector} ` }}</span>
      <span
        class="wrap-anywhere inline-flex min-w-0 items-center text-xs"
        :class="i === 0
          ? 'text-dimmed'
          : i === segments.length - 1
            ? linked
              ? 'font-mono font-medium text-highlighted underline decoration-dotted decoration-(--ui-text-dimmed) underline-offset-4 group-hover:decoration-(--ui-text-toned)'
              : 'font-mono font-medium text-highlighted'
            : 'font-mono text-muted'"
        :translate="i === 0 ? undefined : 'no'"
      >{{ segment }}</span>
      <UIcon
        v-if="i < segments.length - 1"
        name="i-lucide-chevron-right"
        class="mx-0.5 size-3 shrink-0 text-dimmed"
        aria-hidden="true"
      />
    </template>
  </component>
</template>
