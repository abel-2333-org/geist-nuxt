<script setup lang="ts">
// Playground candidate → foundation. Concept form of the Annotation family:
// resolves a term id against the page-provided glossary (useGlossary) and
// shows the definition in the shared AnnotationPopover shell.
//
// MDC usage in narrative markdown:  :term[幂等键]{id="idempotency-key"}
// The default slot is the visible phrase; `id` looks up the glossary entry.
// Unknown ids degrade gracefully to plain text so stale markdown never breaks
// a page — the annotation simply disappears.

import type { AnnotationPopoverLabels } from './AnnotationPopover.vue'
import type { GlossaryEntry } from '../composables/useGlossary'

export interface TermAnnotationLabels extends AnnotationPopoverLabels {
  /** Eyebrow caption of the popover. */
  category?: string
  /** Caption of the deep-link action shown when the entry has `to`. */
  learnMore?: string
}

const props = withDefaults(
  defineProps<{
    /** Glossary id to resolve. Ignored when `entry` is passed directly. */
    id?: string
    /** Direct entry, bypassing the glossary (e.g. one-off inline concepts). */
    entry?: GlossaryEntry
    labels?: TermAnnotationLabels
  }>(),
  { labels: () => ({}) },
)

const t = computed<Required<Pick<TermAnnotationLabels, 'category' | 'learnMore'>>>(() => ({
  category: 'Term',
  learnMore: 'Learn more',
  ...props.labels,
}))

const glossary = useGlossary()
const resolved = computed<GlossaryEntry | undefined>(
  () => props.entry ?? (props.id ? glossary[props.id] : undefined),
)

if (import.meta.dev) {
  watchEffect(() => {
    if (!resolved.value) {
      console.warn(`[TermAnnotation] no glossary entry for id "${props.id ?? ''}" — rendering plain text`)
    }
  })
}
</script>

<template>
  <PlaygroundAnnotationPopover
    v-if="resolved"
    :label="t.category"
    icon="i-lucide-book-open"
    trigger-class="decoration-(--ui-text-dimmed) hover:decoration-(--ui-text-toned)"
    :labels="labels"
  >
    <slot>{{ resolved.term }}</slot>

    <template #content>
      <p class="font-medium text-highlighted">{{ resolved.term }}</p>
      <p class="leading-relaxed text-muted">
        <InlineMarkdown :text="resolved.definition" />
      </p>
    </template>

    <template v-if="resolved.to" #actions>
      <UButton
        :to="resolved.to"
        color="neutral"
        variant="ghost"
        size="xs"
        trailing-icon="i-lucide-arrow-right"
      >
        {{ t.learnMore }}
      </UButton>
    </template>
  </PlaygroundAnnotationPopover>

  <slot v-else>{{ id }}</slot>
</template>
