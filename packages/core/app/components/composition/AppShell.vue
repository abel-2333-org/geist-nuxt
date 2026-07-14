<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

defineProps<{ items?: NavigationMenuItem[] }>()

// Collapse state is cookie-persisted (SSR-safe) and shared across the app.
const { collapsed, toggle } = useSidebar()

// Sidebar destinations are primary content, not the "弱化/禁用" tier that
// NavigationMenu defaults inactive links to (text-muted, tuned for dense
// top-nav). Lift inactive links to text-toned so the persistent sidebar reads
// crisply; scope it to inactive only (via aria-current) so the active item
// keeps its primary color, and re-assert hover→highlighted so it still wins.
const navUi = {
  link: '[&:not([aria-current=page])]:text-toned [&:not([aria-current=page])]:hover:text-highlighted',
  // Section headings ("Kits") = the Label 12 tier: uppercase + tracking, dimmed.
  label: 'font-medium text-dimmed uppercase tracking-wide',
} as const

// Mobile slideover open state.
const mobileOpen = ref(false)
const route = useRoute()
// Close the mobile nav after navigating.
watch(() => route.fullPath, () => {
  mobileOpen.value = false
})
</script>

<template>
  <div class="min-h-screen bg-default text-default antialiased flex">
    <!-- Desktop sidebar: same surface as content, separated by a hairline.
         Sticky full-height; width animates between expanded and collapsed. -->
    <aside
      :class="[
        'hidden lg:flex flex-col shrink-0 sticky top-0 h-screen border-r border-default',
        'transition-[width] duration-200 ease-out',
        collapsed ? 'w-16' : 'w-64',
      ]"
    >
      <!-- Brand row, aligned to the 64px header rhythm. -->
      <div class="flex h-16 items-center border-b border-default px-3 shrink-0">
        <slot name="brand" :collapsed="collapsed" />
      </div>

      <!-- Scrollable navigation. -->
      <nav class="flex-1 overflow-y-auto px-3 py-4">
        <UNavigationMenu
          :items="items"
          orientation="vertical"
          color="primary"
          :collapsed="collapsed"
          tooltip
          popover
          :ui="navUi"
        />
      </nav>

      <!-- Footer: icon actions + collapse toggle. Row when expanded (toggle
           pushed to the right), centered column when collapsed. -->
      <div class="border-t border-default p-3">
        <div :class="collapsed ? 'flex flex-col items-center gap-1' : 'flex items-center gap-1'">
          <slot name="actions" />
          <UButton
            :icon="collapsed ? 'i-lucide-panel-left-open' : 'i-lucide-panel-left-close'"
            color="neutral"
            variant="ghost"
            :class="collapsed ? '' : 'ml-auto'"
            :aria-label="collapsed ? '展开侧栏' : '收起侧栏'"
            @click="toggle"
          />
        </div>
      </div>
    </aside>

    <!-- Main column -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- Mobile top bar + slideover carrying the full nav. -->
      <header
        class="lg:hidden sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b border-default bg-default/80 px-4 backdrop-blur"
      >
        <slot name="brand" :collapsed="false" />

        <div class="flex items-center gap-1">
          <slot name="actions" />
          <USlideover v-model:open="mobileOpen" side="left" title="导航">
            <UButton
              icon="i-lucide-menu"
              color="neutral"
              variant="ghost"
              aria-label="打开导航"
            />
            <template #body>
              <UNavigationMenu
                :items="items"
                orientation="vertical"
                color="primary"
                :ui="navUi"
              />
            </template>
          </USlideover>
        </div>
      </header>

      <main class="flex-1">
        <slot />
      </main>

      <slot name="footer" />
    </div>
  </div>
</template>
