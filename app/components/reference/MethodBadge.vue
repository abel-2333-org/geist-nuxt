<script setup lang="ts">
import type { BadgeProps } from '@nuxt/ui'
import { methodPreset, methodFallback, type HttpMethod } from '~/utils/method-preset'

// PRESET WRAPPER: turns an HTTP method into the tone-based SemanticBadge atom
// via `methodPreset`. Mirrors LifecycleBadge — domain vocabulary lives in the
// preset, the atom stays vocabulary-agnostic. The mono/tabular typography is
// the method's visual identity, passed through as a class so the atom's
// calibration (tone → color + a11y) is reused unchanged.

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
