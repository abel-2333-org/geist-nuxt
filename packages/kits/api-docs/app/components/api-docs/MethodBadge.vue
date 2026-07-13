<script setup lang="ts">
import type { BadgeProps } from '@nuxt/ui'
// `methodPreset` / `methodFallback` (values) and `HttpMethod` (type) live in
// this kit's app/utils/method-preset.ts and are auto-imported across the layer
// — no explicit import, so the reference resolves for consumers too (a `~/`
// path would wrongly resolve to the CONSUMER's app dir when the kit is extended).

// PRESET WRAPPER (domain: API docs): turns an HTTP method into the tone-based
// SemanticBadge atom (from @geist-nuxt/core) via `methodPreset`. Mirrors
// LifecycleBadge — domain vocabulary lives in the preset, the atom stays
// vocabulary-agnostic. The mono/tabular typography is the method's visual
// identity, passed through as a class so the atom's calibration (tone → color
// + a11y) is reused unchanged.

const props = withDefaults(
  defineProps<{
    method: string
    size?: BadgeProps['size']
  }>(),
  { size: 'md' },
)

const method = computed(() => props.method.toUpperCase() as HttpMethod)
const meta = computed(() => methodPreset[method.value] ?? methodFallback)
</script>

<template>
  <SemanticBadge
    :tone="meta.tone"
    :variant="meta.variant"
    :size="props.size"
    :label="method"
    class="font-mono tracking-wide tabular-nums"
  />
</template>
