<script setup lang="ts">
// The Authentication panel: a calm, structured card (not an alarm alert) that
// frames auth as a *contract* the caller must meet. Renders each requirement
// via AuthMethod, divided by hairlines. When more than one requirement is
// present they are combined with AND — surfaced by the "All required" badge so
// the relationship is unambiguous without an inline connector.
import type { AuthRequirement } from '~/types/domain'

defineProps<{
  requirements: AuthRequirement[]
  /** Panel heading (chrome copy → i18n seam). */
  title?: string
  /** Reference link label passed through to each method. */
  referenceLabel?: string
}>()
</script>

<template>
  <section
    v-if="requirements.length"
    class="overflow-hidden rounded-lg border border-default bg-elevated/30"
    aria-labelledby="auth-panel-title"
  >
    <header class="flex items-center justify-between gap-3 border-b border-default bg-elevated/50 px-6 py-3">
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-lock" class="size-4 text-muted" aria-hidden="true" />
        <h2
          id="auth-panel-title"
          class="font-mono text-xs font-semibold uppercase tracking-widest text-muted"
        >
          {{ title ?? 'Authentication' }}
        </h2>
      </div>
      <UBadge
        v-if="requirements.length > 1"
        color="neutral"
        variant="soft"
        size="sm"
      >
        All Required
      </UBadge>
    </header>

    <!-- Methods stacked and divided by hairlines. The AND relationship is
         carried by the "All required" badge above, so no inline connector is
         needed — keeping the left edge clean and aligned. -->
    <ul class="divide-y divide-default px-6">
      <li v-for="(req, i) in requirements" :key="`${req.scheme}-${i}`">
        <AuthMethod :requirement="req" :reference-label="referenceLabel" />
      </li>
    </ul>
  </section>
</template>
