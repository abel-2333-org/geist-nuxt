<script setup lang="ts">
// Composition: navigation patterns — tabs for section switching, kbd for
// shortcut hints. Mirrors references/compositions.md (navigation).
</script>

<template>
  <UCard>
    <template #header>
      <h3 class="font-medium text-highlighted">Navigation</h3>
      <p class="mt-1 text-sm text-muted">Tabs for section switching, kbd for shortcut hints.</p>
    </template>
    <div class="space-y-4">
      <UTabs
        :items="[
          { label: 'Overview', icon: 'i-lucide-layout-dashboard' },
          { label: 'Usage', icon: 'i-lucide-activity' },
          { label: 'Settings', icon: 'i-lucide-settings' },
        ]"
      />
      <div class="flex items-center gap-2">
        <UKbd>⌘</UKbd>
        <UKbd>K</UKbd>
        <span class="text-sm text-muted">to open the command menu</span>
      </div>
    </div>
  </UCard>
</template>
