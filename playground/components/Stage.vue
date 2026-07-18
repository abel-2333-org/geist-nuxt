<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string
    description?: string
  }>(),
  {
    title: 'Component Playground',
    description: 'Draft components stay here until they are ready to promote.',
  },
)
</script>

<template>
  <UContainer class="py-10 sm:py-14">
    <header class="mb-8 space-y-2 border-b border-default pb-6">
      <h1 class="text-2xl font-semibold tracking-tight text-highlighted">
        {{ title }}
      </h1>
      <p class="text-sm leading-relaxed text-muted">
        {{ description }}
      </p>
    </header>

    <div class="space-y-8">
      <slot>
        <UAlert
          color="neutral"
          variant="subtle"
          icon="i-lucide-flask-conical"
          title="No draft component"
          description="Add the next candidate under playground/components."
        />
      </slot>
    </div>
  </UContainer>
</template>
