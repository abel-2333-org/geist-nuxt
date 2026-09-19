<script setup lang="ts">
// Literal classes are intentional: this fixture is an explicit Tailwind source.
const surfaces = [
  { name: 'default', class: 'bg-default' },
  { name: 'muted', class: 'bg-muted' },
  { name: 'elevated', class: 'bg-elevated' },
  { name: 'accented', class: 'bg-accented' },
] as const
const tokens = [
  { name: 'dimmed', class: 'text-dimmed' },
  { name: 'muted', class: 'text-muted' },
  { name: 'toned', class: 'text-toned' },
  { name: 'default', class: 'text-default' },
  { name: 'highlighted', class: 'text-highlighted' },
] as const
</script>

<template>
  <section data-testid="token-matrix" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <div v-for="surface in surfaces" :key="surface.name" :class="[surface.class, 'space-y-2 rounded-md p-4']">
      <p
        v-for="token in tokens"
        :key="token.name"
        :class="[token.class, 'text-sm']"
        :data-token="token.name"
        :data-surface="surface.name"
      >{{ token.name }} on {{ surface.name }}</p>
    </div>
  </section>
</template>
