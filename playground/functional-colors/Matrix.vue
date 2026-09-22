<script setup lang="ts">
import type { FieldNode } from '../../kits/api-docs/utils/field'
import type { ResponseScenario } from '../../kits/api-docs/components/ResponseExample.vue'

definePageMeta({ layout: false })

// One static measurement fixture: all cases share the same rendering loop.
// Color candidates are supplied by the audit harness, never by this page.
const colorMode = useColorMode()
const route = useRoute()
const isRequiredMarkerCase = computed(() => route.query.case === 'required-marker')
const roles = [
  { name: 'primary', textClass: 'text-primary' },
  { name: 'secondary', textClass: 'text-secondary' },
  { name: 'success', textClass: 'text-success' },
  { name: 'info', textClass: 'text-info' },
  { name: 'warning', textClass: 'text-warning' },
  { name: 'error', textClass: 'text-error' },
] as const
const variants = ['solid', 'outline', 'soft', 'subtle'] as const
const surfaces = [
  { name: 'default', class: 'bg-default' },
  { name: 'muted', class: 'bg-muted' },
  { name: 'elevated', class: 'bg-elevated' },
  { name: 'accented', class: 'bg-accented' },
] as const
const selectedSurface = shallowRef<(typeof surfaces)[number]['name']>('default')
const surfaceItems = surfaces.map(surface => surface.name)
const visibleSurfaces = computed(() => surfaces.filter(surface => surface.name === selectedSurface.value))

const fieldExamples = surfaces.map(surface => ({
  surface: surface.name,
  required: {
    path: `functional-${surface.name}-required`,
    name: 'amount',
    type: 'integer',
    required: true,
    description: 'Amount in the smallest currency unit.',
  } satisfies FieldNode,
  conditional: {
    path: `functional-${surface.name}-conditional`,
    name: 'reference',
    type: 'string',
    required: 'conditional',
    condition: 'Required when the operation uses an external reference.',
    description: 'Reference used to correlate the operation.',
    notes: [{ kind: 'caveat', label: 'Caveat', text: 'This reference is visible in exported reports.' }],
  } satisfies FieldNode,
  value: {
    path: `functional-${surface.name}-value`,
    name: 'metadata',
    type: 'string',
    format: 'json_string',
    description: 'Additional information encoded as JSON.',
    value: {
      path: `functional-${surface.name}-decoded`,
      relation: 'decoded',
      codec: 'json',
      type: 'object',
      notes: [{ kind: 'caveat', label: 'Caveat', text: 'Decoded values are stored as supplied.' }],
    },
  } satisfies FieldNode,
}))
const selectedFields = computed(() => fieldExamples.find(example => example.surface === selectedSurface.value)!)
const responseExamples = [
  { status: 200, statusText: 'OK' },
  { status: 302, statusText: 'Found' },
  { status: 400, statusText: 'Bad Request' },
  { status: 500, statusText: 'Internal Server Error' },
].map(({ status, statusText }) => ({
  status,
  scenarios: [{
    id: `response-${status}`,
    label: statusText,
    statuses: [{
      status,
      statusText,
      description: `${status} response example.`,
      bodies: [{ id: 'json', kind: 'code', mediaType: 'application/json', variants: [{ language: 'json', code: '{ "example": true }' }] }],
    }],
  }] satisfies ResponseScenario[],
}))
const lifecycleExamples = [
  { status: 'beta', title: 'Beta', description: 'This operation is available for evaluation.' },
  { status: 'active', title: 'Active', description: 'This operation is available for integration.' },
  { status: 'maintenance', title: 'Maintenance', description: 'This operation is undergoing maintenance.' },
  { status: 'deprecated', title: 'Deprecated', description: 'Use the replacement operation for new integrations.' },
  { status: 'sunset', title: 'Sunsetting', description: 'Migrate before this operation is retired.' },
] as const
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
          <USelect v-model="selectedSurface" :items="surfaceItems" aria-label="Surface" data-testid="surface-picker" />
          <UButton color="neutral" variant="outline" data-theme="light" @click="colorMode.preference = 'light'"><span data-label>Light</span></UButton>
          <UButton color="neutral" variant="outline" data-theme="dark" @click="colorMode.preference = 'dark'"><span data-label>Dark</span></UButton>
        </div>
      </header>

      <section
        v-for="surface in visibleSurfaces"
        :key="surface.name"
        :data-surface="surface.name"
        :class="surface.class"
        class="space-y-6 rounded-lg border border-default p-4 sm:p-6"
      >
        <h2 class="text-xl font-semibold text-highlighted">{{ surface.name }}</h2>
        <UFormField
          v-if="isRequiredMarkerCase"
          label="Required field"
          required
          error="Enter a valid value."
          :name="`required-${surface.name}`"
          data-audit="form-field"
        >
          <UInput placeholder="Value" aria-label="Required field" />
        </UFormField>
        <template v-else>
          <div
            v-for="role in roles"
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

          <UFormField
            label="Invalid field"
            error="Enter a valid value."
            :name="`invalid-${surface.name}`"
            data-audit="form-field"
          >
            <UInput placeholder="Value" aria-label="Invalid field" />
          </UFormField>

          <div class="space-y-4" data-testid="api-fixture">
            <h3 class="text-lg font-semibold text-highlighted">API field colors</h3>
            <p class="flex flex-wrap gap-4 text-sm">
              <span data-annotation="required"><FieldAnnotation :field="selectedFields.required" /></span>
              <span data-annotation="conditional"><FieldAnnotation :field="selectedFields.conditional" /></span>
            </p>
            <div data-field-example="required"><FieldItem v-bind="selectedFields.required" /></div>
            <div data-field-example="conditional"><FieldItem v-bind="selectedFields.conditional" /></div>
            <div data-field-example="value-caveat"><FieldItem v-bind="selectedFields.value" /></div>
            <div class="grid gap-4 sm:grid-cols-2">
              <div v-for="response in responseExamples" :key="response.status" :data-response-status="response.status" class="min-w-0">
                <ResponseExample :scenarios="response.scenarios" />
              </div>
            </div>
            <!-- New is a field lifecycle, so its real consumer is LifecycleBadge. -->
            <div data-lifecycle="new"><LifecycleBadge status="new" /></div>
            <LifecycleNotice
              v-for="lifecycle in lifecycleExamples"
              :key="lifecycle.status"
              :status="lifecycle.status"
              :title="lifecycle.title"
              :description="lifecycle.description"
              :data-lifecycle="lifecycle.status"
            />
          </div>
        </template>
      </section>
    </UContainer>
  </main>
</template>
