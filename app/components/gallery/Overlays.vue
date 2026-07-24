<script setup lang="ts">
// Catalog group: overlays. One GalleryEntry per heading in
// references/components/overlays.md (route Y). Usage links point to that doc.
const DOC = 'https://github.com/abel-2333-org/geist-nuxt/blob/main/references/components/overlays.md'

const modalOpen = ref(false)
const slideoverOpen = ref(false)
const menuItems = [
  [
    { label: 'Edit', icon: 'i-lucide-pen' },
    { label: 'Duplicate', icon: 'i-lucide-copy' },
  ],
  [{ label: 'Delete', icon: 'i-lucide-trash', color: 'error' as const }],
]

// TermAnnotation reads a page-provided glossary; provide one for this section.
provideGlossary({
  'sliding-window': {
    term: 'Sliding window',
    definition: 'A rolling time span for counting requests, re-evaluated on **every** call instead of at fixed interval boundaries.',
  },
})

// DocAnnotation is pipeline-agnostic: the gallery hands it a plain async loader
// (a real @nuxt/content consumer would wrap queryCollection instead). One
// resolves, one rejects to show the error → retry → open-page fallback. Return
// types are inferred against the `load` prop, so no DocPreview import is needed.
function loadGuide() {
  return new Promise<{ title: string, description?: string }>((resolve) => {
    setTimeout(() => resolve({
      title: 'Rate limiting guide',
      description: 'Covers the sliding window and token bucket strategies, plus recommended retry backoff.',
    }), 500)
  })
}
function loadBroken() {
  return new Promise<{ title: string, description?: string }>((_resolve, reject) => {
    setTimeout(() => reject(new Error('not found')), 500)
  })
}
</script>

<template>
  <section id="overlays" class="scroll-mt-20 space-y-6">
    <h3 class="text-lg font-semibold tracking-tight text-highlighted">Overlays</h3>

    <GalleryEntry
      name="UModal"
      description="Modal dialog with focus trap, overlay, and Esc-to-close."
      :usage-href="`${DOC}#umodal`"
    >
      <GalleryExample label="Dialog">
        <UModal v-model:open="modalOpen" title="Delete project" description="This action cannot be undone.">
          <UButton color="error" variant="soft">Delete project</UButton>
          <template #footer>
            <UButton color="error">Confirm</UButton>
            <UButton color="neutral" variant="outline" @click="() => { modalOpen = false }">Cancel</UButton>
          </template>
        </UModal>
      </GalleryExample>
    </GalleryEntry>

    <GalleryEntry
      name="USlideover"
      description="Edge-anchored panel with the same modal semantics as UModal."
      :usage-href="`${DOC}#uslideover`"
    >
      <GalleryExample label="Right panel">
        <USlideover v-model:open="slideoverOpen" title="Filters" side="right">
          <UButton color="neutral" variant="outline" icon="i-lucide-sliders-horizontal">
            Open filters
          </UButton>
          <template #body>
            <p class="text-sm text-muted">Filter controls go here.</p>
          </template>
        </USlideover>
      </GalleryExample>
    </GalleryEntry>

    <GalleryEntry
      name="UPopover"
      description="Non-modal floating panel that can hold interactive content."
      :usage-href="`${DOC}#upopover`"
    >
      <GalleryExample label="Click trigger">
        <UPopover>
          <UButton color="neutral" variant="outline">Filter</UButton>
          <template #content>
            <div class="p-4 text-sm text-muted">Interactive filter form.</div>
          </template>
        </UPopover>
      </GalleryExample>
    </GalleryEntry>

    <GalleryEntry
      name="AnnotationPopover"
      description="Inline annotation trigger anchored to a non-modal popover, with hover enhancement and async chrome."
      :usage-href="`${DOC}#annotationpopover`"
    >
      <GalleryExample label="Inline term">
        <p class="max-w-md text-sm leading-relaxed text-default">
          Rate limits use a
          <AnnotationPopover label="Term" icon="i-lucide-book-open">
            sliding window
            <template #content>
              <p class="text-sm leading-relaxed text-default">
                A rolling time span for counting requests, re-evaluated on every call instead of at fixed interval boundaries.
              </p>
            </template>
          </AnnotationPopover>
          algorithm to smooth out bursts.
        </p>
      </GalleryExample>
      <GalleryExample label="Loading">
        <p class="max-w-md text-sm leading-relaxed text-default">
          The
          <AnnotationPopover label="Term" icon="i-lucide-book-open" loading>
            token bucket
            <template #content>
              <p class="text-sm text-default">Never shown while loading.</p>
            </template>
          </AnnotationPopover>
          variant refills at a constant rate.
        </p>
      </GalleryExample>
      <GalleryExample label="Error">
        <p class="max-w-md text-sm leading-relaxed text-default">
          A
          <AnnotationPopover label="Term" icon="i-lucide-book-open" error="Could not load the definition.">
            leaky bucket
            <template #content>
              <p class="text-sm text-default">Never shown while in error.</p>
            </template>
          </AnnotationPopover>
          drains requests at a fixed pace.
        </p>
      </GalleryExample>
    </GalleryEntry>

    <GalleryEntry
      name="TermAnnotation"
      description="Concept form of the Annotation family: resolves a glossary term id to an inline definition popover, degrading to plain text when the id is unknown."
      :usage-href="`${DOC}#termannotation`"
    >
      <GalleryExample label="Glossary term">
        <p class="max-w-md text-sm leading-relaxed text-default">
          Rate limits use a
          <TermAnnotation id="sliding-window" />
          algorithm to smooth out bursts.
        </p>
      </GalleryExample>
      <GalleryExample label="Unknown id (degrades to text)">
        <p class="max-w-md text-sm leading-relaxed text-default">
          The
          <TermAnnotation id="does-not-exist">token bucket</TermAnnotation>
          entry is not in the glossary, so it renders as plain text.
        </p>
      </GalleryExample>
    </GalleryEntry>

    <GalleryEntry
      name="DocAnnotation"
      description="Doc-preview form of the Annotation family: an internal link that lazily loads a title + summary on open; the error state still offers to open the page."
      :usage-href="`${DOC}#docannotation`"
    >
      <GalleryExample label="Lazy preview">
        <p class="max-w-md text-sm leading-relaxed text-default">
          See the
          <DocAnnotation to="/components" :load="loadGuide">rate limiting guide</DocAnnotation>
          for recommended settings.
        </p>
      </GalleryExample>
      <GalleryExample label="Load error (retry + open fallback)">
        <p class="max-w-md text-sm leading-relaxed text-default">
          A stale link like the
          <DocAnnotation to="/components" :load="loadBroken">legacy reconciliation doc</DocAnnotation>
          fails to preview but still navigates.
        </p>
      </GalleryExample>
    </GalleryEntry>

    <GalleryEntry
      name="UTooltip"
      description="Assistive hint only — never place buttons or links inside."
      :usage-href="`${DOC}#utooltip`"
    >
      <GalleryExample label="Icon hint">
        <UTooltip text="Copy to clipboard">
          <UButton icon="i-lucide-copy" color="neutral" variant="ghost" aria-label="Copy" />
        </UTooltip>
      </GalleryExample>
    </GalleryEntry>

    <GalleryEntry
      name="UDropdownMenu"
      description="Keyboard-accessible action menu grouped into sections."
      :usage-href="`${DOC}#udropdownmenu`"
    >
      <GalleryExample label="Actions">
        <UDropdownMenu :items="menuItems">
          <UButton icon="i-lucide-ellipsis" color="neutral" variant="ghost" aria-label="More actions" />
        </UDropdownMenu>
      </GalleryExample>
    </GalleryEntry>
  </section>
</template>
