<script setup lang="ts">
import type { ButtonProps } from '@nuxt/ui'

// Shared copy-to-clipboard button. The single UI home for "copy this value":
// wraps a UButton with icon + color state, an optional tooltip, and a polite
// live-region announcement, all driven by the useCopy composable (which owns
// the clipboard write, the iframe/execCommand fallback, and the toast).
//
// Anatomy:  [ UTooltip? > UButton (idle/copied icon) ] + sr-only live region
// States:   idle → copied (transient, ~2s; no layout shift), success color pulse
// A11y:     dynamic aria-label (idle/copied); result announced politely; the
//           UButton keeps its :focus-visible ring.
//
// This component is intentionally content-agnostic: all labels come in via
// props so a doc site can localize them. It does NOT own navigation or any
// other side effect — a button that also *does* something (e.g. copy a deep
// link and scroll to it) stays a purpose-built button on its own.

const props = withDefaults(
  defineProps<{
    /** The text written to the clipboard. */
    value: string
    /** Object name used in the toast, e.g. 'Endpoint' → "Endpoint copied…". */
    toastLabel?: string
    /** Complete success toast sentence. Omit to use `<toastLabel> copied…`. */
    successMessage?: string
    /** Complete failure toast sentence. Omit to use the foundation default. */
    failureMessage?: string
    /** Accessible name + tooltip while idle. */
    label?: string
    /** Accessible name + tooltip right after a successful copy. */
    copiedLabel?: string
    /** Show a tooltip around the button. Off in dense toolbars. */
    tooltip?: boolean
    /** UButton size — match the surrounding controls. */
    size?: ButtonProps['size']
    /** UButton variant. */
    variant?: ButtonProps['variant']
    /** Idle color; flips to `copiedColor` on success. */
    color?: ButtonProps['color']
    /** Color shown during the copied pulse. */
    copiedColor?: ButtonProps['color']
    /** Idle icon. */
    icon?: string
    /** Icon shown during the copied pulse. */
    copiedIcon?: string
  }>(),
  {
    toastLabel: 'Value',
    label: 'Copy',
    copiedLabel: 'Copied',
    tooltip: false,
    size: 'sm',
    variant: 'ghost',
    color: 'neutral',
    copiedColor: 'success',
    icon: 'i-lucide-copy',
    copiedIcon: 'i-lucide-check',
  },
)

const { copied, copy } = useCopy()

function onCopy() {
  void copy(props.value, {
    label: props.toastLabel,
    successMessage: props.successMessage,
    failureMessage: props.failureMessage,
  })
}
</script>

<template>
  <UTooltip v-if="tooltip" :text="copied ? copiedLabel : label">
    <UButton
      :icon="copied ? copiedIcon : icon"
      :color="copied ? copiedColor : color"
      :variant="variant"
      :size="size"
      class="shrink-0"
      :aria-label="copied ? copiedLabel : label"
      @click="onCopy"
    />
    <span role="status" aria-live="polite" class="sr-only">{{ copied ? copiedLabel : '' }}</span>
  </UTooltip>

  <template v-else>
    <UButton
      :icon="copied ? copiedIcon : icon"
      :color="copied ? copiedColor : color"
      :variant="variant"
      :size="size"
      class="shrink-0"
      :aria-label="copied ? copiedLabel : label"
      @click="onCopy"
    />
    <span role="status" aria-live="polite" class="sr-only">{{ copied ? copiedLabel : '' }}</span>
  </template>
</template>
