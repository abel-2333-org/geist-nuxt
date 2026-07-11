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
            <UButton color="neutral" variant="outline" @click="modalOpen = false">Cancel</UButton>
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
