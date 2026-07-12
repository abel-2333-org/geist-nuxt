<script setup lang="ts">
// A contract note attached to a field, rendered with Nuxt UI's UAlert.
// Two tones, conveyed by color + icon together (never color alone):
//   - "caution": something the caller must watch out for (e.g. conditionally
//     required, never expose) → warning color + alert-triangle icon.
//   - "info": a neutral contract detail (e.g. returns null in some case) →
//     neutral color + info icon.
// The note body is passed via the default slot and forwarded to UAlert's
// `description` slot so wording stays project-supplied (i18n-ready).
withDefaults(
  defineProps<{
    tone?: 'caution' | 'info'
  }>(),
  // Default to the common case (a must-watch caution). `info` stays available
  // for neutral contract details but is opt-in.
  { tone: 'caution' },
)
</script>

<template>
  <UAlert
    variant="soft"
    :color="tone === 'caution' ? 'warning' : 'neutral'"
    :icon="tone === 'caution' ? 'i-lucide-triangle-alert' : 'i-lucide-info'"
    :ui="{
      root: 'rounded-sm p-2.5 gap-2 items-start',
      icon: 'size-4 mt-px',
      description: 'text-sm leading-relaxed',
    }"
  >
    <template #description>
      <slot />
    </template>
  </UAlert>
</template>
