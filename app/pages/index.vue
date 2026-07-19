<script setup lang="ts">
definePageMeta({ nav: { label: 'Overview', icon: 'i-lucide-home', order: 0 } })
</script>

<template>
  <div>
    <ShowcaseHero />
    <UContainer class="py-16 sm:py-24">
      <ShowcaseFoundations />
    </UContainer>
  </div>
</template>
