<script setup lang="ts">
import TokenMatrix from './TokenMatrix.vue'
import ContainerVariants from './ContainerVariants.vue'
import FormVariants from './FormVariants.vue'
import OverlayDescriptions from './OverlayDescriptions.vue'
import DocumentationStates from './DocumentationStates.vue'

definePageMeta({ layout: false })

const colorMode = useColorMode()

function setTheme(theme: 'light' | 'dark') {
  colorMode.preference = theme
}
</script>

<template>
  <main data-testid="contrast-fixture" class="min-h-screen space-y-12 bg-default p-6 text-default">
    <header class="flex flex-wrap items-center gap-3">
      <h1 class="text-xl font-semibold text-highlighted">Rendered text contrast fixtures</h1>
      <UButton data-testid="theme-light" color="neutral" variant="outline" @click="setTheme('light')">Light</UButton>
      <UButton data-testid="theme-dark" color="neutral" variant="outline" @click="setTheme('dark')">Dark</UButton>
    </header>
    <TokenMatrix />
    <ContainerVariants />
    <FormVariants />
    <OverlayDescriptions />
    <DocumentationStates />
  </main>
</template>
