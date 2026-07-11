<script setup lang="ts">
// Gallery home: the core showcase (GeistShowcase, from @geist-nuxt/core) with
// the gallery's own header slotted in and kit demos appended via the default
// slot. Kit sections update instantly through workspace:* — no release needed.
</script>

<template>
  <GeistShowcase>
    <template #header>
      <AppHeader />
    </template>

    <GalleryCatalog />
    <ApiDocsSection />
  </GeistShowcase>
</template>
