<script setup lang="ts">
const nav = useGalleryNav()
</script>

<template>
  <CompositionAppShell :items="nav">
    <template #brand>
      <NuxtLink to="/" class="flex items-center gap-2.5 text-highlighted" aria-label="geist-nuxt 首页">
        <img src="/favicon.svg" alt="" class="size-6 shrink-0" width="24" height="24" />
        <span class="font-mono text-sm font-semibold tracking-tight whitespace-nowrap">geist-nuxt</span>
      </NuxtLink>
    </template>

    <template #actions>
      <UButton
        icon="i-lucide-book-open"
        label="文档"
        color="neutral"
        variant="ghost"
        size="sm"
        trailing-icon="i-lucide-arrow-up-right"
        to="https://ui.nuxt.com"
        target="_blank"
        class="flex-1 justify-start"
      />
      <UButton
        icon="i-simple-icons-github"
        color="neutral"
        variant="ghost"
        size="sm"
        aria-label="GitHub 仓库"
        to="https://github.com/abel-2333-org/geist-nuxt"
        target="_blank"
      />
      <ThemeToggle />
    </template>

    <slot />

    <template #footer>
      <footer class="border-t border-default">
        <UContainer class="py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p class="text-sm text-muted">geist-nuxt · 基于 Nuxt UI 的 Geist 设计语言</p>
          <p class="text-sm text-muted font-mono">@geist-nuxt/core</p>
        </UContainer>
      </footer>
    </template>
  </CompositionAppShell>
</template>
