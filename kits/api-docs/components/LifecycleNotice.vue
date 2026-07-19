<script setup lang="ts">
// PRESET WRAPPER (domain: API docs): the banner-form sibling of LifecycleBadge.
// Same vocabulary, same source of truth (`lifecyclePreset` — tone, icon,
// label), different form factor: the badge marks a row inline, the notice
// explains an operation-level lifecycle state in the document flow (placed
// after the OperationHeader, before the field groups).
//
// A thin wrapper over UAlert:
//  - color/icon derive from the preset so badge and notice can never drift
//    apart (one calibration to retune);
//  - NOT dismissible — this is documentation, not a transient toast;
//  - `title` defaults to the preset label; description is caller copy
//    (component stays copy-agnostic: props/slot, no hardcoded strings).
//
// Anatomy:  [ icon | title + description ]  (UAlert, variant subtle)
// States:   none beyond the status prop (static informational surface).
// A11y:     UAlert renders a landmark-friendly block; meaning is carried by
//           icon + title text, never color alone (preset guarantees the icon).

const props = defineProps<{
  status: EndpointLifecycle
  /** Override the preset's default label (e.g. for i18n). */
  title?: string
  /** Explanation copy; the #default slot wins over this prop if both given. */
  description?: string
}>()

const meta = computed(() => lifecyclePreset[props.status])

// BadgeTone → UAlert color. Tones are calibrated on the same semantic axis as
// alert colors, so the mapping is the identity for every tone the endpoint
// lifecycle uses (success/warning/neutral/error).
const color = computed(() => BADGE_TONE_COLOR[meta.value.tone])
</script>

<template>
  <UAlert
    :color="color"
    variant="subtle"
    :icon="meta.icon"
    :title="props.title ?? meta.label"
    :description="props.description"
  >
    <template v-if="$slots.default" #description>
      <slot />
    </template>
  </UAlert>
</template>
