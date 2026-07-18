<script setup lang="ts">
import type { BadgeProps } from '@nuxt/ui'
import type { BadgeTone } from '../utils/badge'
import { BADGE_TONE_COLOR } from '../utils/badge'

// Presentation ATOM: a semantic badge. It knows nothing about lifecycle /
// HTTP method / any domain concept — it only renders a curated `tone` (color +
// a11y icon + text label). Mapping a domain value to a tone is a PRESET concern
// (kept in the consuming project / kit, e.g. LifecycleBadge, MethodBadge), so
// this atom stays drop-in reusable for any state vocabulary.
//
// Tone → UBadge color is the design-system's semantic calibration:
//   success → healthy / available        warning → proceed with care
//   neutral → winding down, de-emphasized error   → severe / terminal
//   info    → informational / read-only   secondary → alternate accent
// Meaning never rides on color alone: pair a tone with an icon + text.

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
    :color="BADGE_TONE_COLOR[props.tone]"
    :variant="props.variant"
    :size="props.size"
    :icon="props.icon"
    class="font-medium"
  >
    {{ props.label }}
  </UBadge>
</template>
