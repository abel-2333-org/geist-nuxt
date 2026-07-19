<template>
  <!-- Container only: organises the six component groups, one per
       references/components/*.md file. Each <Gallery*> section owns its entries
       (route Y: one GalleryEntry per doc heading, Usage links back to the doc). -->
  <section id="catalog" class="scroll-mt-20 space-y-12">
    <div class="space-y-2">
      <h2 class="text-2xl font-semibold tracking-tight text-highlighted">Catalog</h2>
      <p class="text-muted max-w-2xl">
        Per-component entries grouped by task, mirroring the skill's component
        references. Real rendered instances live here; props and full usage live
        in the references — follow the Usage link on each entry.
      </p>
    </div>

    <GalleryButtons />
    <GalleryForms />
    <GalleryFeedback />
    <GalleryNavigation />
    <GalleryOverlays />
    <GalleryDataDisplay />
  </section>
</template>
