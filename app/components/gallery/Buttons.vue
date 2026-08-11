<script setup lang="ts">
// Catalog group: buttons / actions. One GalleryEntry per heading in
// references/components/buttons.md (route Y). Usage links point back to that
// doc's anchors on GitHub — the authoritative source of truth.
const DOC = 'https://github.com/abel-2333-org/geist-nuxt/blob/main/references/components/buttons.md'
</script>

<template>
  <section id="buttons" class="scroll-mt-20 space-y-6">
    <h3 class="text-lg font-semibold tracking-tight text-highlighted">Buttons / actions</h3>

    <GalleryEntry
      name="UButton"
      description="Primary action trigger across variants, sizes, icons, and states."
      :usage-href="`${DOC}#ubutton`"
    >
      <GalleryExample label="Variants">
        <UButton>Primary</UButton>
        <UButton color="neutral" variant="outline">Outline</UButton>
        <UButton color="neutral" variant="soft">Soft</UButton>
        <UButton color="primary" variant="subtle">Subtle</UButton>
        <UButton color="neutral" variant="ghost">Ghost</UButton>
        <UButton variant="link">Link</UButton>
      </GalleryExample>

      <GalleryExample label="Sizes">
        <UButton size="xs">xs</UButton>
        <UButton size="sm">sm</UButton>
        <UButton size="md">md</UButton>
        <UButton size="lg">lg</UButton>
        <UButton size="xl">xl</UButton>
      </GalleryExample>

      <GalleryExample label="With icon">
        <UButton leading-icon="i-lucide-plus">New</UButton>
        <UButton trailing-icon="i-lucide-arrow-right">Continue</UButton>
        <UButton icon="i-lucide-settings" color="neutral" variant="ghost" aria-label="Settings" />
      </GalleryExample>

      <GalleryExample label="States">
        <UButton loading>Saving</UButton>
        <UButton disabled>Disabled</UButton>
      </GalleryExample>
    </GalleryEntry>

    <GalleryEntry
      name="UButtonGroup"
      description="Joins related buttons into one segmented control with shared borders."
      :usage-href="`${DOC}#ubuttongroup`"
    >
      <GalleryExample label="Segmented">
        <UButtonGroup>
          <UButton color="neutral" variant="outline">Left</UButton>
          <UButton color="neutral" variant="outline">Center</UButton>
          <UButton color="neutral" variant="outline">Right</UButton>
        </UButtonGroup>
      </GalleryExample>
    </GalleryEntry>

    <GalleryEntry
      name="CopyButton"
      description="Copy-to-clipboard action (foundation): copied pulse, toast, and a polite announcement via useCopy."
      :usage-href="`${DOC}#copybutton`"
    >
      <GalleryExample label="Default (ghost, icon-only)">
        <CopyButton value="pnpm add @nuxt/ui" label="Copy install command" copied-label="Install command copied to clipboard" />
      </GalleryExample>

      <GalleryExample label="With tooltip">
        <CopyButton
          value="https://api.example.com/v1/deployments"
          tooltip
          label="Copy endpoint"
          copied-label="Endpoint copied to clipboard"
        />
      </GalleryExample>

      <GalleryExample label="Localized, outline">
        <CopyButton
          value="NUXT_PUBLIC_SITE_URL=https://example.com"
          variant="outline"
          size="md"
          label="复制环境变量"
          copied-label="环境变量已复制"
        />
      </GalleryExample>
    </GalleryEntry>
  </section>
</template>
