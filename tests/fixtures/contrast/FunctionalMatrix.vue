<script setup lang="ts">
import FunctionalRoleMatrix from './FunctionalRoleMatrix.vue'
import FunctionalApiMatrix from './FunctionalApiMatrix.vue'
import FunctionalOwnerReview from './FunctionalOwnerReview.vue'

definePageMeta({ layout: false })
const colorMode = useColorMode()
const route = useRoute()
const api = computed(() => route.query.case === 'api')
const overrides = computed(() => route.query.case === 'instance-overrides')
const ownerReview = computed(() => route.query.case === 'owner-review')
const roles = ['primary', 'secondary', 'success', 'info', 'warning', 'error'] as const
const selectedRole = shallowRef<(typeof roles)[number]>('primary')
const required = computed(() => route.query.case === 'required-marker')
const surfaces = [
  { name: 'default', class: 'bg-default' },
  { name: 'muted', class: 'bg-muted' },
  { name: 'elevated', class: 'bg-elevated' },
  { name: 'accented', class: 'bg-accented' },
] as const
const selectedSurface = shallowRef<(typeof surfaces)[number]['name']>('default')
const visibleSurface = computed(() => surfaces.find(surface => surface.name === selectedSurface.value)!)
</script>

<template>
  <main class="min-h-screen bg-default text-default" data-testid="functional-color-matrix">
    <UContainer class="space-y-8 py-8">
      <header class="flex flex-wrap items-center justify-between gap-4">
        <div class="space-y-2">
          <h1 class="text-2xl font-semibold text-highlighted">Functional color matrix</h1>
          <p class="text-sm text-muted">Six roles · four surfaces · native component states</p>
        </div>
        <div class="flex gap-2" aria-label="Color mode">
          <USelect v-if="!required && !api && !overrides && !ownerReview" v-model="selectedRole" :items="[...roles]" aria-label="Role" data-testid="role-picker" />
          <USelect v-model="selectedSurface" :items="surfaces.map(surface => surface.name)" aria-label="Surface" data-testid="surface-picker" />
          <UButton color="neutral" variant="outline" data-theme="light" @click="() => { colorMode.preference = 'light' }">Light</UButton>
          <UButton color="neutral" variant="outline" data-theme="dark" @click="() => { colorMode.preference = 'dark' }">Dark</UButton>
        </div>
      </header>
      <section :key="visibleSurface.name" :data-surface="visibleSurface.name" :class="visibleSurface.class" class="space-y-6 rounded-lg border border-default p-4 sm:p-6">
        <h2 class="text-xl font-semibold text-highlighted">{{ visibleSurface.name }}</h2>
        <UFormField v-if="required" label="Required field" required error="Enter a valid value." :name="`required-${visibleSurface.name}`" data-audit="form-field">
          <UInput placeholder="Value" aria-label="Required field" />
        </UFormField>
        <FunctionalApiMatrix v-else-if="api" :surface="visibleSurface.name" />
        <FunctionalOwnerReview v-else-if="ownerReview" />
        <div v-else-if="overrides" class="flex flex-wrap gap-4">
          <UButton color="primary" :ui="{ base: 'hover:bg-error active:bg-success' }" data-audit="button-ui-override">
            <span data-label>UI override</span>
          </UButton>
          <UButton color="primary" class="hover:bg-error active:bg-success" data-audit="button-class-override">
            <span data-label>Class override</span>
          </UButton>
        </div>
        <template v-else>
          <FunctionalRoleMatrix :role="selectedRole" />
          <UFormField label="Invalid field" error="Enter a valid value." :name="`invalid-${visibleSurface.name}`" data-audit="form-field">
            <UInput placeholder="Value" aria-label="Invalid field" />
          </UFormField>
        </template>
      </section>
    </UContainer>
  </main>
</template>
