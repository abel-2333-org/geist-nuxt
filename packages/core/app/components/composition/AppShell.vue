<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

// Geist sidebar shell: a persistent left sidebar (brand → scrollable grouped
// nav → pinned footer actions) beside a scrollable main column. Not the Nuxt
// docs UPage/UPageAside pattern — plain flex + a vertical UNavigationMenu, so
// the chrome reads like a Vercel/Linear dashboard rather than a docs template.
//
// On < lg the sidebar hides and navigation collapses into a slim top bar with
// a slideover (UHeader mode="slideover"), so the same `items` serve both.
//
// Slots (all scenario-agnostic — grouping/labels live with the consumer):
// - #brand   : wordmark block (top of sidebar + mobile bar)
// - #actions : footer controls (theme toggle, links) — pinned bottom on desktop
// - default  : page content
// - #footer  : optional content-column footer below the page
defineProps<{ items?: NavigationMenuItem[] }>()
</script>

<template>
  <div class="min-h-screen bg-default text-default antialiased">
    <!-- Desktop: persistent sidebar -->
    <aside
      class="max-lg:hidden fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-default bg-elevated/40"
    >
      <div class="flex h-16 items-center gap-2.5 border-b border-default px-5">
        <slot name="brand" />
      </div>

      <nav class="flex-1 overflow-y-auto px-3 py-4" aria-label="主导航">
        <UNavigationMenu
          :items="items"
          orientation="vertical"
          color="primary"
          highlight
          highlight-color="primary"
        />
      </nav>

      <div class="flex items-center gap-1 border-t border-default px-3 py-3">
        <slot name="actions" />
      </div>
    </aside>

    <!-- Mobile: slim top bar + slideover carrying the same nav -->
    <UHeader mode="slideover" class="lg:hidden">
      <template #left>
        <slot name="brand" />
      </template>
      <template #right>
        <slot name="actions" />
      </template>
      <template #body>
        <UNavigationMenu
          :items="items"
          orientation="vertical"
          color="primary"
          highlight
          highlight-color="primary"
          class="-mx-2.5"
        />
      </template>
    </UHeader>

    <!-- Content column, offset by the sidebar width on desktop -->
    <div class="flex min-h-screen flex-col lg:pl-64">
      <main class="flex-1">
        <slot />
      </main>
      <slot name="footer" />
    </div>
  </div>
</template>
