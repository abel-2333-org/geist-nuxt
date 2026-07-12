<script setup lang="ts">
// Inline code token for example values, default values and allowed values shown
// within prose. Light, tonal surface — the calm counterpart to the always-dark
// code panel on the right.
//
// Delegates to Nuxt UI's ProseCode primitive (available via `ui.prose: true`,
// no @nuxt/content needed). We override two theme defaults to stay on Geist
// foundations: radius back to the control tier (`rounded-sm`, 6px) instead of
// the primitive's `rounded-md`, and font size to Copy 13 Mono per the type scale.
</script>

<template>
  <ProseCode class="rounded-sm text-[0.8125rem]">
    <slot />
  </ProseCode>
</template>
