<script setup lang="ts">
// Public API Docs kit component promoted by #74 after real-consumer acceptance.
//
// Where a relation's value comes from, rendered as the FULL field hierarchy:
//
//   Request body › notification › callback_url
//   Request body › recipients[0] › callback_url
//   Response body › payment › id
//
// Why the full hierarchy and not a leaf name: #28's follow-up found that a leaf
// name (or a hand-written sentence) cannot disambiguate — `notification/
// callback_url` and `recipients/0/callback_url` share the leaf `callback_url` —
// cannot link to the field schema, and leaves a screen reader unable to state
// the source. The raw Runtime Expression is deliberately NOT rendered: the
// hierarchy already carries scope, location and every segment, so printing the
// expression again is the same fact in a notation nobody reads.
//
// Anatomy:  chain ── scope/location label · separator · segments…
//           the last segment is the target field and carries the emphasis
// States:   linked (same-page `field`, or cross-page `to`) / plain text
//
// Two public contracts:
//
// 1. ACCESSIBLE NAME IS BUILT FROM THE VISIBLE NODES. The `sr-only` prefix and
//    connectors are interleaved BETWEEN the visible segments rather than
//    duplicated into a separately composed sentence. A parallel spoken copy
//    would be a second source of truth and would drift from what is on screen;
//    interleaving makes drift structurally impossible. Chevrons stay
//    `aria-hidden` because arrow glyphs do not announce reliably.
//
// 2. THREE-STATE DEGRADATION, NEVER A DEAD LINK. `to` → <ULink> (cross-page,
//    router-aware); `field` → bare <a href="#…"> whose click is delegated to
//    `useFieldAnchor.goTo(field, { focus: true })` so the kit's reveal + focus
//    contract runs instead of a raw hash jump; neither → <span>, not focusable.
//    The fragment is `encodeURIComponent`-ed to match `useFieldAnchor.urlFor`;
//    DOM ids stay the decoded literal (see references/kits/api-docs/index.md,
//    "FieldItem 的通用交互约束").
//
// Ownership: the consumer resolves Runtime Expressions and JSON Pointers,
// validates the source field against its schema, decodes escapes (`~1` → `/`,
// `~0` → `~`), composes array indices (`recipients[0]`) and supplies a stable
// field id. This component only displays what it is handed — it never parses
// OpenAPI, JSON Pointer or a consumer DSL. The scope × location label map is
// chrome (a closed 8-entry vocabulary) so it ships a default and stays
// overridable, mirroring the ApiTargetLabels convention.
//
// Promotion boundary: this component owns only the resolved display and
// navigation contract. Runtime Expression/OpenAPI/JSON Pointer parsing, schema
// validation, decoded segments and stable field identities remain consumer
// responsibilities and must not move into this component.

import { ULink } from '#components'
import { useFieldAnchor } from '../composables/useFieldAnchor'

export interface RelationSource {
  scope: 'request' | 'response'
  location: 'body' | 'path' | 'query' | 'header'
  /**
   * Decoded, reader-facing hierarchy. The consumer has already composed array
   * indices and undone JSON Pointer escapes — this component does not parse.
   */
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
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
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
