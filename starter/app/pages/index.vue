<script setup lang="ts">
// Empty placeholder home. Replace this with your app. It only demonstrates
// that the core layer is wired: Geist tokens, Geist Sans/Mono fonts, and the
// color-mode toggle (ThemeToggle is auto-imported from @geist-nuxt/core).
</script>

<template>
  <div class="min-h-screen bg-default text-default antialiased">
    <header class="border-b border-default">
      <div class="mx-auto flex h-16 w-full max-w-(--ui-container) items-center gap-3 px-4 sm:px-6 lg:px-8">
        <span class="font-mono text-sm font-semibold tracking-tight text-highlighted">geist-nuxt</span>
        <UBadge color="neutral" variant="subtle" size="sm" class="font-mono max-sm:hidden">
          starter
        </UBadge>
        <div class="ms-auto">
          <ThemeToggle />
        </div>
      </div>
    </header>

    <main>
      <UContainer class="flex min-h-[70vh] flex-col items-center justify-center gap-6 py-16 text-center">
        <UIcon name="i-lucide-sparkles" class="size-10 text-primary" aria-hidden="true" />
        <div class="space-y-3">
          <h1 class="text-3xl font-semibold tracking-tight text-highlighted sm:text-4xl text-balance">
            Your app starts here
          </h1>
          <p class="mx-auto max-w-md text-muted leading-relaxed text-pretty">
            A clean scaffold on the geist-nuxt design system. Edit
            <code class="font-mono text-sm text-highlighted">app/pages/index.vue</code>
            to build your first page.
          </p>
        </div>
        <UButton size="lg" trailing-icon="i-lucide-arrow-right">
          Get Started
        </UButton>
      </UContainer>
    </main>
  </div>
</template>
