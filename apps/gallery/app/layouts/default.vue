<script setup lang="ts">
const nav = useGalleryNav()
</script>

<template>
  <div class="min-h-screen flex flex-col bg-default text-default antialiased">
    <CompositionAppHeader :items="nav.tree">
      <template #brand>
        <NuxtLink to="/" class="flex items-center gap-2.5 text-highlighted" aria-label="geist-nuxt 首页">
          <img src="/favicon.svg" alt="" class="size-6" width="24" height="24" />
          <span class="font-mono text-sm font-semibold tracking-tight">geist-nuxt</span>
        </NuxtLink>
        <UBadge color="neutral" variant="subtle" size="sm" class="font-mono max-sm:hidden">
          Nuxt · Nuxt UI
        </UBadge>
      </template>

      <template #nav>
        <GalleryHeaderNav :primary="nav.primary" :kits="nav.kits" />
      </template>

      <template #actions>
        <UButton
          label="文档"
          color="neutral"
          variant="ghost"
          trailing-icon="i-lucide-arrow-up-right"
          to="https://ui.nuxt.com"
          target="_blank"
          class="max-sm:hidden"
        />
        <UButton
          icon="i-simple-icons-github"
          color="neutral"
          variant="ghost"
          aria-label="GitHub 仓库"
          to="https://github.com/abel-2333-org/geist-nuxt"
          target="_blank"
        />
        <ThemeToggle />
      </template>
    </CompositionAppHeader>

    <!-- Each page owns its own UContainer, so main just hosts the slot;
         header and page content share the --ui-container width and align. -->
    <main class="flex-1">
      <slot />
    </main>

    <footer class="border-t border-default">
      <UContainer class="py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p class="text-sm text-muted">geist-nuxt · 基于 Nuxt UI 的 Geist 设计语言</p>
        <p class="text-sm text-muted font-mono">@geist-nuxt/core</p>
      </UContainer>
    </footer>
  </div>
</template>
