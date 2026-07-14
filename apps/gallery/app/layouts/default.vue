<script setup lang="ts">
const items = useGalleryNav()
</script>

<template>
  <CompositionAppShell :items="items">
    <template #brand="{ collapsed }">
      <NuxtLink
        to="/"
        class="flex items-center gap-2.5 text-highlighted min-w-0"
        aria-label="geist-nuxt 首页"
      >
        <img src="/favicon.svg" alt="" class="size-6 shrink-0" width="24" height="24" />
        <span v-if="!collapsed" class="font-mono text-sm font-semibold tracking-tight whitespace-nowrap">
          geist-nuxt
        </span>
      </NuxtLink>
    </template>

    <template #actions>
      <ThemeToggle />
      <UButton
        icon="i-simple-icons-github"
        color="neutral"
        variant="ghost"
        aria-label="GitHub 仓库"
        to="https://github.com/abel-2333-org/geist-nuxt"
        target="_blank"
      />
    </template>

    <template #footer>
      <footer class="border-t border-default">
        <UContainer class="py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p class="text-sm text-muted">geist-nuxt · 基于 Nuxt UI 的 Geist 设计语言</p>
          <p class="text-sm text-muted font-mono">@geist-nuxt/core</p>
        </UContainer>
      </footer>
    </template>

    <!-- Page content flows into AppShell's default slot (its <main>). -->
    <slot />
  </CompositionAppShell>
</template>
