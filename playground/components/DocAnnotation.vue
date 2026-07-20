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

export interface DocAnnotationLabels extends AnnotationPopoverLabels {
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
    labels?: DocAnnotationLabels
  }>(),
  { labels: () => ({}) },
)

const t = computed<Required<Pick<DocAnnotationLabels, 'category' | 'open' | 'error'>>>(() => ({
  category: 'Preview',
  open: 'Open page',
  error: 'Preview failed to load. Retry or open the page.',
  ...props.labels,
}))

type State = 'idle' | 'loading' | 'ready' | 'error'
const state = ref<State>('idle')
const preview = ref<DocPreview | null>(null)

// Guards a reused instance (e.g. this component recycled for a different
// `to`): a bumped token orphans any in-flight load so a late response can
// never overwrite the newer document's preview.
let requestToken = 0

async function fetchPreview() {
  const token = ++requestToken
  state.value = 'loading'
  try {
    const result = await props.load()
    if (token !== requestToken) return
    preview.value = result
    state.value = 'ready'
  }
  catch {
    if (token !== requestToken) return
    state.value = 'error'
  }
}

// The cache is only valid for the document it was loaded for. When the target
// changes, drop it; if a load already happened (the popover has been opened,
// possibly is open right now), refetch immediately so an open panel never
// shows the previous document.
watch(() => [props.to, props.load] as const, () => {
  requestToken++
  const hadLoaded = state.value !== 'idle'
  preview.value = null
  state.value = 'idle'
  if (hadLoaded) void fetchPreview()
})

function onOpen() {
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
    @open="onOpen"
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
