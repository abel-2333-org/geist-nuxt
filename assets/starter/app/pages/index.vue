<script setup lang="ts">
// Components are auto-imported by Nuxt from app/components/**.
</script>

<template>
  <div class="min-h-screen bg-default text-default antialiased">
    <AppHeader />
    <main>
      <HeroSection />
      <UContainer class="py-16 sm:py-24 space-y-24">
        <FoundationsSection />
        <ComponentsSection />
      </UContainer>
    </main>
    <footer class="border-t border-default">
      <UContainer class="py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p class="text-sm text-muted">
          geist-nuxt · Geist visual language on Nuxt UI
        </p>
        <p class="text-sm text-muted font-mono">v0 design system</p>
      </UContainer>
    </footer>
  </div>
</template>
