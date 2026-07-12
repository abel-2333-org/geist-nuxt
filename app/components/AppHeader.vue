<script setup lang="ts">
const nav = [
  { label: 'Guides', to: '#' },
  { label: 'API Reference', to: '#', active: true },
  { label: 'Changelog', to: '#' },
]
</script>

<template>
  <header
    class="sticky top-0 z-40 border-b border-default bg-default/80 backdrop-blur supports-[backdrop-filter]:bg-default/60"
  >
    <UContainer class="flex h-16 items-center gap-4">
      <NuxtLink to="/" class="flex items-center gap-2 text-highlighted" aria-label="Onerway Developers home">
        <img src="/favicon.svg" alt="" width="24" height="24" class="size-6" />
        <span class="font-mono text-sm font-semibold tracking-tight">Onerway</span>
      </NuxtLink>

      <UBadge color="neutral" variant="subtle" size="sm" class="font-mono max-sm:hidden">
        Developers
      </UBadge>

      <nav class="ms-auto flex items-center gap-1">
        <UButton
          v-for="item in nav"
          :key="item.label"
          :label="item.label"
          :to="item.to"
          color="neutral"
          :variant="item.active ? 'soft' : 'ghost'"
          size="sm"
          class="max-md:hidden"
        />
        <UButton
          icon="i-simple-icons-github"
          color="neutral"
          variant="ghost"
          aria-label="GitHub repository"
          to="https://github.com/nuxt/ui"
          target="_blank"
        />
        <ThemeToggle />
      </nav>
    </UContainer>
  </header>
</template>
