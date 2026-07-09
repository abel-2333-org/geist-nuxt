<template>
  <header
    class="sticky top-0 z-40 border-b border-default bg-default/80 backdrop-blur supports-[backdrop-filter]:bg-default/60"
  >
    <div class="mx-auto flex h-16 w-full max-w-(--ui-container) items-center gap-3 px-4 sm:px-6 lg:px-8">
      <a href="/" class="flex items-center gap-2.5 text-highlighted" aria-label="geist-nuxt 首页">
        <img src="/favicon.svg" alt="" class="size-6" width="24" height="24" />
        <span class="font-mono text-sm font-semibold tracking-tight">geist-nuxt</span>
      </a>

      <UBadge color="neutral" variant="subtle" size="sm" class="font-mono max-sm:hidden">
        Nuxt · Nuxt UI
      </UBadge>

      <nav class="ms-auto flex items-center gap-1">
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
          to="https://github.com/nuxt/ui"
          target="_blank"
        />
        <ThemeToggle />
      </nav>
    </div>
  </header>
</template>
