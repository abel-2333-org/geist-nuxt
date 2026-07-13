<script setup lang="ts">
import type { BadgeProps } from '@nuxt/ui'
// `lifecyclePreset` (value) and `LifecycleStatus` (type) live in this kit's
// app/utils/lifecycle-preset.ts and are auto-imported across the layer — no
// explicit import, so the reference resolves for consumers too (a `~/` path
// would wrongly resolve to the CONSUMER's app dir when the kit is extended).

// PRESET WRAPPER (domain: API docs): turns a lifecycle value into the tone-based
// SemanticBadge atom (from @geist-nuxt/core) via `lifecyclePreset`. This is
// where domain knowledge lives; the core atom stays vocabulary-agnostic.
// Swap/extend the preset to retheme without editing either this wrapper or the
// atom.

const props = withDefaults(
  defineProps<{
    status: LifecycleStatus
    size?: BadgeProps['size']
    /** Override the preset's default label (e.g. for i18n). */
    label?: string
  }>(),
  { size: 'sm' },
)

const meta = computed(() => lifecyclePreset[props.status])
</script>

<template>
  <SemanticBadge
    :tone="meta.tone"
    :variant="meta.variant"
    :icon="meta.icon"
    :size="props.size"
    :label="props.label ?? meta.label"
  />
</template>
