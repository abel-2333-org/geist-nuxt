<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

/**
 * AppShell — documentation-style shell: a thin top header (brand + global
 * actions only, no primary nav) over a persistent left sidebar that carries the
 * full navigation hierarchy, plus a right-hand content column.
 *
 * Use this instead of AppHeader when navigation has real depth (grouped
 * sections, multi-page kits, nested items). Nuxt UI's horizontal header menu is
 * capped at two flat levels; the vertical UNavigationMenu here renders children
 * as a native Accordion, so arbitrary nesting works.
 *
 * On desktop the sidebar (UPageAside) is always visible; below `lg` it hides and
 * navigation moves into the header's slideover drawer. Content-agnostic: brand,
 * actions and footer are passed via slots.
 */
defineProps<{ items?: NavigationMenuItem[] }>()
</script>

<template>
  <div class="min-h-screen bg-default text-default antialiased flex flex-col">
    <UHeader mode="slideover">
      <template #left>
        <slot name="brand" />
      </template>

      <template #right>
        <slot name="actions">
          <ThemeToggle />
        </slot>
      </template>

      <!-- Mobile (< lg): the sidebar collapses; navigation lives in the drawer. -->
      <template #body>
        <UNavigationMenu :items="items" orientation="vertical" class="-mx-2.5" />
      </template>
    </UHeader>

    <UMain class="flex-1">
      <UPage>
        <template #left>
          <UPageAside>
            <UNavigationMenu :items="items" orientation="vertical" />
          </UPageAside>
        </template>

        <slot />
      </UPage>
    </UMain>

    <slot name="footer" />
  </div>
</template>
