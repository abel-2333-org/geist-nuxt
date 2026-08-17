<script setup lang="ts">
// Inline code token for example values, default values and allowed values shown
// within prose. Light, tonal surface — the calm counterpart to an always-dark
// code panel.
//
// Delegates to Nuxt UI's ProseCode primitive (available via `ui.prose: true`,
// no @nuxt/content needed). We override two theme defaults to stay on Geist
// foundations: radius back to the control tier (`rounded-sm`, 6px) instead of
// the primitive's `rounded-md`, and font size to Copy 13 Mono (`text-code`,
// 13px) per the type scale.
//
// translate="no" is part of the atom's contract: the content is literal
// (identifiers, values, enum members), so machine translation must leave it
// alone — same rationale as CodeBlock's raw <pre>. Callers can still opt a
// specific instance back in via a fallthrough `translate` attr, which wins
// over this default.
</script>

<template>
  <ProseCode class="rounded-sm text-code" translate="no">
    <slot />
  </ProseCode>
</template>
