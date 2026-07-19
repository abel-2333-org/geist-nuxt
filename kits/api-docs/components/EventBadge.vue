<script setup lang="ts">
import type { BadgeProps } from '@nuxt/ui'

// PRESET WRAPPER (domain: API docs): the webhook counterpart of MethodBadge.
// Marks an operation as an OUT-OF-BAND EVENT (the platform calls you) instead
// of an HTTP verb (you call the platform). Same anatomy slot, same size, same
// mono/tabular typography as MethodBadge so the two align 1:1 wherever
// operations are listed side by side.
//
// Vocabulary is a SINGLE value ("EVENT"), so the preset degenerates to an
// inline constant — no event-preset.ts. Rationale for the calibration:
//  - tone `neutral` + `subtle`: EVENT is not an HTTP verb; true-neutral gray
//    keeps it OUTSIDE the five method hues so the badge never competes with
//    them for meaning. The word shape (EVENT vs a verb) is the primary signal;
//    color only reinforces it (a11y: never color alone).
//  - `secondary` (purple family) is NOT used: PATCH already owns it in
//    method-preset, and purple is calibrated for interaction (FieldItem).
// The label is domain vocabulary, not copy — it is intentionally NOT a prop
// (mirrors how method names pass through MethodBadge verbatim).

const props = withDefaults(
  defineProps<{
    size?: BadgeProps['size']
  }>(),
  // Default matches MethodBadge / LifecycleBadge so the atoms align when they
  // co-occur (e.g. in an operation header).
  { size: 'sm' },
)

// Preset degenerated to a constant (single-value vocabulary).
const EVENT_BADGE = { tone: 'neutral', variant: 'subtle', label: 'EVENT' } as const
</script>

<template>
  <SemanticBadge
    :tone="EVENT_BADGE.tone"
    :variant="EVENT_BADGE.variant"
    :size="props.size"
    :label="EVENT_BADGE.label"
    class="font-mono tracking-wide tabular-nums"
  />
</template>
