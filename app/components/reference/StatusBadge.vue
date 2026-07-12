<script setup lang="ts">
import type { BadgeProps } from '@nuxt/ui'
import type { BadgeTone } from '~/types/domain'

// Presentation ATOM: a semantic status badge. It knows nothing about
// lifecycle / HTTP status / any domain concept — it only renders a curated
// `tone` (color + a11y icon + text label). Mapping a domain value to a tone is
// a PRESET concern (see lifecycle-preset.ts + LifecycleBadge.vue), kept out of
// here so this atom is drop-in reusable for any state vocabulary.
//
// Tone → UBadge color is the design-system's semantic calibration:
//   success → healthy / available        warning → proceed with care
//   neutral → winding down, de-emphasized error   → severe / terminal
// Meaning never rides on color alone: every badge carries an icon + text.

const props = withDefaults(
  defineProps<{
    /** Curated semantic tone (design-system vocabulary). */
    tone: BadgeTone
    /** Text label (already localized by the caller). */
    label: string
    /** Optional leading icon (a11y: reinforces meaning beyond color). */
    icon?: string
    /** subtle (default) for most states; solid to escalate severity. */
    variant?: BadgeProps['variant']
    size?: BadgeProps['size']
  }>(),
  { variant: 'subtle', size: 'sm' },
)
</script>

<template>
  <UBadge
    :color="props.tone"
    :variant="props.variant"
    :size="props.size"
    :icon="props.icon"
    class="font-medium"
  >
    {{ props.label }}
  </UBadge>
</template>
