<script setup lang="ts">
// Seed catalog section demonstrating the GalleryItem convention with two real
// components (UButton, UAlert). Add more GalleryItem entries here as the catalog
// grows. Keep entries lean: labelled real instances only — link usage/props out
// to the skill references instead of duplicating them here.
</script>

<template>
  <section id="catalog" class="scroll-mt-20 space-y-10">
    <div class="space-y-2">
      <h2 class="text-2xl font-semibold tracking-tight text-highlighted">Catalog</h2>
      <p class="text-muted max-w-2xl">
        Per-component entries: real rendered instances across key variants. Usage and
        props live in the skill references — follow the Usage link on each entry.
      </p>
    </div>

    <GalleryItem
      name="UButton"
      description="Primary action trigger across variants, sizes, and states."
      usage-href="https://ui.nuxt.com/components/button"
    >
      <GalleryVariant label="Variants">
        <UButton>Primary</UButton>
        <UButton color="neutral" variant="outline">Outline</UButton>
        <UButton color="neutral" variant="ghost">Ghost</UButton>
        <UButton color="primary" variant="subtle">Subtle</UButton>
      </GalleryVariant>

      <GalleryVariant label="Sizes">
        <UButton size="xs">xs</UButton>
        <UButton size="sm">sm</UButton>
        <UButton size="md">md</UButton>
        <UButton size="lg">lg</UButton>
      </GalleryVariant>

      <GalleryVariant label="With icon">
        <UButton icon="i-lucide-arrow-right" trailing>Continue</UButton>
        <UButton icon="i-lucide-download" color="neutral" variant="outline">Download</UButton>
      </GalleryVariant>

      <GalleryVariant label="States">
        <UButton loading>Loading</UButton>
        <UButton disabled>Disabled</UButton>
      </GalleryVariant>
    </GalleryItem>

    <GalleryItem
      name="UAlert"
      description="Inline feedback pairing icon, semantic color, title, and message."
      usage-href="https://ui.nuxt.com/components/alert"
    >
      <GalleryVariant label="Semantic colors">
        <UAlert
          color="success"
          variant="subtle"
          icon="i-lucide-check-circle"
          title="Payment received"
          description="Your subscription is now active."
          class="max-w-sm"
        />
        <UAlert
          color="warning"
          variant="subtle"
          icon="i-lucide-alert-triangle"
          title="Usage nearing limit"
          description="You have used 90% of your quota."
          class="max-w-sm"
        />
        <UAlert
          color="error"
          variant="subtle"
          icon="i-lucide-x-circle"
          title="Deployment failed"
          description="Check the build logs for details."
          class="max-w-sm"
        />
      </GalleryVariant>
    </GalleryItem>
  </section>
</template>
