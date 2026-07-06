<script setup lang="ts">
// Domain component (API docs) — a single HTTP response: status pill + a
// short label + the response body (delegated to <ApiCodeSample>).
//
// Anatomy:  [status badge] [status text] · code body
// State:    status color derives from the code class (2xx/3xx/4xx/5xx),
//           conveyed with text as well as color.
// A11y:     status is a badge with its numeric code as text; body inherits
//           ApiCodeSample's copy affordance + live region.

const props = defineProps<{
  status: number
  /** Short human label, e.g. "OK", "Created", "Not Found". */
  statusText?: string
  /** Response body (typically JSON), shown in a code block. */
  body: string
  language?: string
  title?: string
}>()

// 2xx success, 3xx redirect, 4xx client error, 5xx server error.
const color = computed<'success' | 'info' | 'warning' | 'error' | 'neutral'>(() => {
  const c = Math.floor(props.status / 100)
  if (c === 2) return 'success'
  if (c === 3) return 'info'
  if (c === 4) return 'warning'
  if (c === 5) return 'error'
  return 'neutral'
})
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center gap-2">
      <UBadge :color="color" variant="subtle" class="font-mono font-semibold">
        {{ status }}
      </UBadge>
      <span v-if="statusText" class="text-sm text-muted">{{ statusText }}</span>
    </div>
    <ApiCodeSample
      :code="body"
      :language="language ?? 'json'"
      :title="title ?? 'response.json'"
    />
  </div>
</template>
