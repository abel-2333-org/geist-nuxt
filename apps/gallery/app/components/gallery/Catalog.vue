<template>
  <section id="catalog" class="scroll-mt-20 space-y-10">
    <div class="space-y-2">
      <h2 class="text-2xl font-semibold tracking-tight text-highlighted">Catalog</h2>
      <p class="text-muted max-w-2xl">
        Per-component entries: real rendered instances across key facets. Usage and
        props live in the skill references — follow the Usage link on each entry.
      </p>
    </div>

    <GalleryEntry
      name="UButton"
      description="Primary action trigger across variants, sizes, and states."
      usage-href="https://ui.nuxt.com/components/button"
    >
      <GalleryExample label="Variants">
        <UButton>Primary</UButton>
        <UButton color="neutral" variant="outline">Outline</UButton>
        <UButton color="neutral" variant="ghost">Ghost</UButton>
        <UButton color="primary" variant="subtle">Subtle</UButton>
      </GalleryExample>

      <GalleryExample label="Sizes">
        <UButton size="xs">xs</UButton>
        <UButton size="sm">sm</UButton>
        <UButton size="md">md</UButton>
        <UButton size="lg">lg</UButton>
      </GalleryExample>

      <GalleryExample label="With icon">
        <UButton trailing-icon="i-lucide-arrow-right">Continue</UButton>
        <UButton leading-icon="i-lucide-download" color="neutral" variant="outline">
          Download
        </UButton>
      </GalleryExample>

      <GalleryExample label="States">
        <UButton loading>Loading</UButton>
        <UButton disabled>Disabled</UButton>
      </GalleryExample>
    </GalleryEntry>

    <GalleryEntry
      name="UAlert"
      description="Inline feedback pairing icon, semantic color, title, and message."
      usage-href="https://ui.nuxt.com/components/alert"
    >
      <GalleryExample label="Semantic colors" layout="stack">
        <UAlert
          color="success"
          variant="subtle"
          icon="i-lucide-check-circle"
          title="Payment received"
          description="Your subscription is now active."
        />
        <UAlert
          color="warning"
          variant="subtle"
          icon="i-lucide-alert-triangle"
          title="Usage nearing limit"
          description="You have used 90% of your quota."
        />
        <UAlert
          color="error"
          variant="subtle"
          icon="i-lucide-x-circle"
          title="Deployment failed"
          description="Check the build logs for details."
        />
      </GalleryExample>
    </GalleryEntry>
  </section>
</template>
