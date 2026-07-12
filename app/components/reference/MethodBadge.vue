<script setup lang="ts">
import type { BadgeProps } from '@nuxt/ui'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

const props = withDefaults(
  defineProps<{
    method: string
    size?: BadgeProps['size']
  }>(),
  { size: 'md' },
)

// HTTP method → semantic color. Color is a *reinforcement*, never the sole
// signal: the method text itself always spells out the verb.
const COLOR: Record<HttpMethod, BadgeProps['color']> = {
  GET: 'info',
  POST: 'success',
  PUT: 'warning',
  PATCH: 'secondary',
  DELETE: 'error',
}

const method = computed(() => props.method.toUpperCase() as HttpMethod)
const color = computed<BadgeProps['color']>(() => COLOR[method.value] ?? 'neutral')
</script>

<template>
  <UBadge
    :color="color"
    variant="subtle"
    :size="size"
    class="font-mono font-semibold tracking-wide tabular-nums"
  >
    {{ method }}
  </UBadge>
</template>
