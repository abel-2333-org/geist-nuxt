<script setup lang="ts">
import type { EndpointLifecycle } from '~/types/domain'

const props = defineProps<{
  method: string
  path: string
  title: string
  version?: string
  date?: string
  /** Operation-level lifecycle (active/maintenance/deprecated/sunset). */
  status?: EndpointLifecycle
}>()

// The full "METHOD /path" string is what gets copied.
const endpoint = computed(() => `${props.method.toUpperCase()} ${props.path}`)
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
      <h1 class="text-balance text-2xl font-semibold tracking-tight text-highlighted sm:text-3xl">
        {{ title }}
      </h1>
      <LifecycleBadge v-if="status" :status="status" />
      <UBadge
        v-if="version"
        color="neutral"
        variant="subtle"
        size="sm"
        class="font-mono"
      >
        {{ version }}
      </UBadge>
      <span v-if="date" class="font-mono text-xs text-dimmed">{{ date }}</span>
    </div>

    <!-- Endpoint URL bar: method badge + path, with copy. -->
    <div
      class="flex items-center gap-3 overflow-hidden rounded-lg border border-default bg-muted/50 py-2 ps-2 pe-1"
    >
      <MethodBadge :method="method" />
      <code class="min-w-0 flex-1 truncate font-mono text-sm text-highlighted">{{ path }}</code>
      <CopyButton
        :value="endpoint"
        toast-label="Endpoint"
        label="Copy endpoint URL"
        copied-label="Endpoint copied"
        tooltip
        size="sm"
      />
    </div>
  </div>
</template>
