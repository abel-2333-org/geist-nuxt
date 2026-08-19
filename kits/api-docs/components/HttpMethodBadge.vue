<script setup lang="ts">
import type { BadgeProps } from '@nuxt/ui'
// `methodPreset` / `methodFallback` (values) and `HttpMethod` (type) live in
// this kit's utils/method-preset.ts and are exposed through Nuxt auto-import.
// The registry installs the preset in the consumer's standard app/utils root.

// PRESET WRAPPER (domain: API docs): turns an HTTP method into the tone-based
// foundation SemanticBadge atom via `methodPreset`. Mirrors
// LifecycleBadge — domain vocabulary lives in the preset, the atom stays
// vocabulary-agnostic. The mono/tabular typography is the method's visual
// identity, passed through as a class so the atom's calibration (tone → color
// + a11y) is reused unchanged.

const props = withDefaults(
  defineProps<{
    method: string
    size?: BadgeProps['size']
  }>(),
  // Default matches LifecycleBadge so the two align when they co-occur (e.g.
  // in an operation header). Callers can still size up explicitly.
  { size: 'sm' },
)

// Normalize the visible token once. Unknown/custom methods keep that token and
// use the neutral fallback; blank input becomes an explicit non-colour signal.
const method = computed(() => props.method.trim().toUpperCase() || 'UNKNOWN')
const meta = computed(() => methodPreset[method.value as HttpMethod] ?? methodFallback)
</script>

<template>
  <SemanticBadge
    :tone="meta.tone"
    :variant="meta.variant"
    :size="props.size"
    :label="method"
    translate="no"
    class="font-mono tracking-wide tabular-nums"
  />
</template>
