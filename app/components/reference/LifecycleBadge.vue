<script setup lang="ts">
import type { BadgeProps } from '@nuxt/ui'
import type { LifecycleStatus } from '~/types/domain'
import { lifecyclePreset } from '~/utils/lifecycle-preset'

// PRESET WRAPPER: turns a lifecycle value into the tone-based StatusBadge atom
// via `lifecyclePreset`. This is where domain knowledge lives; the atom below
// stays vocabulary-agnostic. Swap/extend the preset to retheme without editing
// either this wrapper or the atom.

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
  <StatusBadge
    :tone="meta.tone"
    :variant="meta.variant"
    :icon="meta.icon"
    :size="props.size"
    :label="props.label ?? meta.label"
  />
</template>
