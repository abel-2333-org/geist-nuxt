<script setup lang="ts">
// Playground candidate → foundation. Doc-preview form of the Annotation
// family: an internal link whose popover lazily loads the target document's
// title + summary the first time it opens.
//
// Pipeline-agnostic on purpose: this component only receives an async `load`
// function. A @nuxt/content consumer wraps it in a thin local adapter whose
// `load` runs `queryCollection(...)` for `to` (function props cannot travel
// through MDC attributes — see ../annotation.spec.md). Results are cached per
// component instance, so re-hovering the same link reopens instantly.
//
// The error state never dead-ends: the "open page" action stays available, so
// a failed preview still navigates.

import type { AnnotationPopoverLabels } from './AnnotationPopover.vue'

export interface DocPreview {
  title: string
  /** Inline-markdown summary (front-matter description or first paragraph). */
  description?: string
}

export interface LinkAnnotationLabels extends AnnotationPopoverLabels {
  /** Eyebrow caption of the popover. */
  category?: string
  /** Caption of the navigate action. */
  open?: string
  /** Message shown when `load` rejects. */
  error?: string
}

const props = withDefaults(
  defineProps<{
    /** Route of the target document — also the fallback navigation. */
    to: string
    /** Async preview loader (adapter-owned; e.g. queryCollection by path). */
    load: () => Promise<DocPreview>
    labels?: LinkAnnotationLabels
  }>(),
  { labels: () => ({}) },
)

const t = computed<Required<Pick<LinkAnnotationLabels, 'category' | 'open' | 'error'>>>(() => ({
  category: 'Preview',
  open: 'Open page',
  error: 'Preview failed to load. Retry or open the page.',
  ...props.labels,
}))

type State = 'idle' | 'loading' | 'ready' | 'error'
const state = ref<State>('idle')
const preview = ref<DocPreview | null>(null)

async function fetchPreview() {
  state.value = 'loading'
  try {
    preview.value = await props.load()
    state.value = 'ready'
  }
  catch {
    state.value = 'error'
  }
}

function onFirstOpen() {
  if (state.value === 'idle') void fetchPreview()
}
</script>

<template>
  <PlaygroundAnnotationPopover
    :label="t.category"
    icon="i-lucide-file-text"
    trigger-class="text-primary decoration-(--ui-primary)/50 hover:decoration-(--ui-primary)"
    :loading="state === 'idle' || state === 'loading'"
    :error="state === 'error' ? t.error : false"
    :labels="labels"
    @open="onFirstOpen"
    @retry="fetchPreview"
  >
    <slot />

    <template #content>
      <template v-if="preview">
        <p class="font-medium text-highlighted">{{ preview.title }}</p>
        <p v-if="preview.description" class="line-clamp-4 leading-relaxed text-muted">
          <InlineMarkdown :text="preview.description" />
        </p>
      </template>
    </template>

    <template #actions>
      <UButton
        :to="to"
        color="neutral"
        variant="ghost"
        size="xs"
        trailing-icon="i-lucide-arrow-right"
      >
        {{ t.open }}
      </UButton>
    </template>
  </PlaygroundAnnotationPopover>
</template>
