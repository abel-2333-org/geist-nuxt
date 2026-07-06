<script setup lang="ts">
// Domain component (API docs) — built from Nuxt UI primitives per the spec
// template. Renders an HTTP endpoint's method + path + summary.
//
// Anatomy:  [method badge] [monospace path] / [optional summary]
// State:    method color is derived from the verb (semantic, not decorative).
// A11y:     method is conveyed by text + color (never color alone); the path
//           is a real <code>; summary is plain prose.

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

const props = defineProps<{
  method: HttpMethod
  path: string
  summary?: string
}>()

// Map verbs to Geist semantic color roles. Read/write/destroy read at a glance.
const methodColor: Record<HttpMethod, 'success' | 'primary' | 'warning' | 'error'> = {
  GET: 'success',
  POST: 'primary',
  PUT: 'warning',
  PATCH: 'warning',
  DELETE: 'error',
}

const color = computed(() => methodColor[props.method] ?? 'neutral')
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center gap-2">
      <UBadge :color="color" variant="subtle" class="font-mono font-semibold">
        {{ method }}
      </UBadge>
      <code class="font-mono text-sm text-highlighted break-all">{{ path }}</code>
    </div>
    <p v-if="summary" class="text-muted max-w-2xl">{{ summary }}</p>
  </div>
</template>
