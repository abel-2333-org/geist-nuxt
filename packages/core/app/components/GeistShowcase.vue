<script setup lang="ts">
// GeistShowcase — the design system's self-describing showcase page.
// Ships inside @geist-nuxt/core, so every consumer gets it via `extends`.
// The starter's home page renders exactly `<GeistShowcase />`; when a new
// component lands in core, add a demo entry in ShowcaseComponents and it
// automatically appears in every consumer preview after the next release.
//
// Slots:
// - #header : replace the built-in minimal header (e.g. gallery's AppHeader)
// - default : extra sections appended after ShowcaseComponents (e.g. kit demos)
withDefaults(
  defineProps<{
    /** Small mono badge next to the wordmark in the built-in header. */
    badge?: string
  }>(),
  { badge: 'design system' },
)
</script>

<template>
  <div class="min-h-screen bg-default text-default antialiased">
    <slot name="header">
      <header
        class="sticky top-0 z-40 border-b border-default bg-default/80 backdrop-blur supports-[backdrop-filter]:bg-default/60"
      >
        <div class="mx-auto flex h-16 w-full max-w-(--ui-container) items-center gap-3 px-4 sm:px-6 lg:px-8">
          <span class="font-mono text-sm font-semibold tracking-tight text-highlighted">geist-nuxt</span>
          <UBadge color="neutral" variant="subtle" size="sm" class="font-mono max-sm:hidden">
            {{ badge }}
          </UBadge>
          <div class="ms-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>
    </slot>

    <main>
      <ShowcaseHero />
      <UContainer class="py-16 sm:py-24 space-y-24">
        <ShowcaseFoundations />
        <ShowcaseComponents />
        <slot />
      </UContainer>
    </main>

    <footer class="border-t border-default">
      <UContainer class="py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p class="text-sm text-muted">geist-nuxt · Geist visual language on Nuxt UI</p>
        <p class="text-sm text-muted font-mono">@geist-nuxt/core</p>
      </UContainer>
    </footer>
  </div>
</template>
