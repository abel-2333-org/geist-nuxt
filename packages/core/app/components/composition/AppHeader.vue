<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

// Generic Geist top-nav header, built on UHeader (sticky bar, shared
// UContainer width, blur, and the mobile toggle + slideover come for free).
// Consumers inject their own navigation:
// - #nav  : desktop center navigation (defaults to a horizontal menu of `items`)
// - #body : mobile slideover navigation (defaults to a vertical menu of `items`)
// - #brand / #actions : left wordmark and right-hand controls
// Kept scenario-agnostic — grouping logic (e.g. kit dropdowns) lives with the
// consumer, not here.
defineProps<{ items?: NavigationMenuItem[] }>()
</script>

<template>
  <UHeader mode="slideover" :ui="{ center: 'gap-1' }">
    <template #left>
      <slot name="brand">
        <NuxtLink
          to="/"
          class="font-mono text-sm font-semibold tracking-tight text-highlighted"
        >
          geist-nuxt
        </NuxtLink>
      </slot>
    </template>

    <slot name="nav">
      <UNavigationMenu
        :items="items"
        variant="link"
        color="primary"
        highlight
        highlight-color="primary"
      />
    </slot>

    <template #right>
      <slot name="actions">
        <ThemeToggle />
      </slot>
    </template>

    <template #body>
      <slot name="body">
        <UNavigationMenu
          :items="items"
          orientation="vertical"
          color="primary"
          class="-mx-2.5"
        />
      </slot>
    </template>
  </UHeader>
</template>
