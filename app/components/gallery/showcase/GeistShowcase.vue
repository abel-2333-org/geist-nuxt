<script setup lang="ts">
// GeistShowcase — a gallery-only, self-describing overview. It mirrors promoted
// foundation assets but is not copied into consumer projects. Layers:
// Hero + Foundations (tokens) + Compositions (signature real-world groupings).
// A new signature composition → add a <Composition*> and drop it into
// ShowcaseCompositions; single-component展示 belongs in gallery's Catalog.
//
// Slots:
// - #header : replace the built-in minimal header (e.g. gallery's AppHeader)
// - default : extra sections appended after ShowcaseCompositions (e.g. kit demos)
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
        <ShowcaseCompositions />
        <slot />
      </UContainer>
    </main>

    <footer class="border-t border-default">
      <UContainer class="py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p class="text-sm text-muted">geist-nuxt · Geist visual language on Nuxt UI</p>
        <p class="text-sm text-muted font-mono">geist-nuxt · Source-first</p>
      </UContainer>
    </footer>
  </div>
</template>
