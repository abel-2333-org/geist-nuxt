<script setup lang="ts">
// A lean gallery entry for one component. Deliberately does NOT duplicate source
// code or props tables — those live in the skill's references/ (single source of
// truth). The gallery's irreplaceable value is the *real rendered instance*.
//
// Structure: name + one-line description + optional usage link (to references),
// then labelled example blocks passed via the default slot (use <GalleryExample>).
defineProps<{
  /** Component display name, e.g. "UButton". */
  name: string
  /** One-line description of what the component is for. */
  description?: string
  /** Optional pointer to the authoritative usage docs (skill reference path or URL). */
  usageHref?: string
  /** Label for the usage link chrome; override for localization. */
  usageLabel?: string
}>()
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-start justify-between gap-4">
        <div class="space-y-1">
          <h3 class="font-mono font-medium text-highlighted">{{ name }}</h3>
          <p v-if="description" class="text-sm text-muted">{{ description }}</p>
        </div>
        <UButton
          v-if="usageHref"
          :to="usageHref"
          target="_blank"
          :label="usageLabel ?? 'Usage'"
          color="neutral"
          variant="ghost"
          size="xs"
          trailing-icon="i-lucide-arrow-up-right"
          class="shrink-0"
        />
      </div>
    </template>

    <div class="space-y-6">
      <slot />
    </div>
  </UCard>
</template>
