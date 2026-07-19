<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

defineProps<{ items?: NavigationMenuItem[] }>()
</script>

<template>
  <UHeader mode="slideover">
    <template #left>
      <slot name="brand">
        <NuxtLink to="/" class="flex items-center gap-2 font-semibold tracking-tight text-highlighted">
          geist-nuxt
        </NuxtLink>
      </slot>
    </template>

    <UNavigationMenu :items="items" />

    <template #right>
      <slot name="actions">
        <ThemeToggle />
      </slot>
    </template>

    <template #body>
      <UNavigationMenu :items="items" orientation="vertical" class="-mx-2.5" />
    </template>
  </UHeader>
</template>
