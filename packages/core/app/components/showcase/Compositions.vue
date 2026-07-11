<script setup lang="ts">
// Showcase compositions — the visual mirror of references/compositions.md.
// Each block is a real, self-contained composition component from
// components/composition/*, arranged as signature "hero" specimens.
//
// Deliberately NOT here:
// - single-component展示 (Button/Badge variants…) → that is GalleryCatalog's job
// - semantic color / token展示 → that is Foundations' job
// When a new signature composition lands, add a <Composition*> component and
// drop it in below.
</script>

<template>
  <section id="compositions" class="scroll-mt-20 space-y-10">
    <div class="space-y-2">
      <h2 class="text-2xl font-semibold tracking-tight text-highlighted">Compositions</h2>
      <p class="text-muted max-w-2xl">
        Signature Nuxt UI components composed the way real screens use them, themed by Geist tokens.
      </p>
    </div>

    <div class="grid gap-6 lg:grid-cols-2">
      <CompositionSignupForm />
      <CompositionFeedback />
      <CompositionNavigation />
    </div>
  </section>
</template>
