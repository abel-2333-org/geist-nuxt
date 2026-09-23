<script setup lang="ts">
const roles = [
  { name: 'primary', textClass: 'text-primary' },
  { name: 'secondary', textClass: 'text-secondary' },
  { name: 'success', textClass: 'text-success' },
  { name: 'info', textClass: 'text-info' },
  { name: 'warning', textClass: 'text-warning' },
  { name: 'error', textClass: 'text-error' },
] as const
const props = defineProps<{ role: (typeof roles)[number]['name'] }>()
const visibleRoles = computed(() => roles.filter(role => role.name === props.role))
const variants = ['solid', 'outline', 'soft', 'subtle'] as const
</script>

<template>
  <div
    v-for="role in visibleRoles"
    :key="role.name"
    :data-role="role.name"
    class="space-y-4 border-b border-default pb-6"
  >
    <div class="flex flex-wrap items-center gap-3">
      <h3 class="font-mono text-sm text-muted">{{ role.name }}</h3>
      <span :class="role.textClass" class="text-sm" data-audit="role-text">Functional text</span>
      <UButton :color="role.name" variant="solid" data-audit="button-solid" data-interactive><span data-label>Solid button</span></UButton>
      <UButton :color="role.name" variant="link" data-audit="button-link" data-interactive><span data-label>Link button</span></UButton>
      <UBadge
        v-for="variant in variants"
        :key="variant"
        :color="role.name"
        :variant="variant"
        :data-audit="`badge-${variant}`"
      >{{ variant }} badge</UBadge>
    </div>
    <div class="grid gap-3 sm:grid-cols-2">
      <UAlert
        v-for="variant in variants"
        :key="variant"
        :color="role.name"
        :variant="variant"
        :title="`${role.name} ${variant} alert`"
        description="Description text in the native alert surface."
        :data-audit="`alert-${variant}`"
      />
    </div>
  </div>
</template>
