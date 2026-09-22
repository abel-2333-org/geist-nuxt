<script setup lang="ts">
import type { CompositionNode, FieldNode } from '../../../kits/api-docs/utils/field'

definePageMeta({ layout: false })

// A tiny test-only composition surface: data factories keep all rendered
// content on the real component prop path, including the long type notation.
const widths = [383, 384, 385]
const kinds = ['oneOf', 'anyOf', 'allOf'] as const
const colorMode = useColorMode()
const longType = 'Record<string, Array<PaymentTransactionMetadataWithAdditionalProperties>>'

function setTheme(theme: 'light' | 'dark') {
  colorMode.preference = theme
}

function nested(id: string): CompositionNode {
  return { kind: 'allOf', variants: [{ id: `${id}-inner`, label: 'Nested shape', fields: [{ name: 'status', type: 'string', path: `${id}-status` }] }] }
}

function composition(kind: CompositionNode['kind'], id: string): CompositionNode {
  return { kind, variants: [{ id, label: 'Variant with nested composition', fields: [], composition: nested(id) }] }
}

function field(width: number): FieldNode {
  const id = `field-${width}`
  return {
    name: 'payload', type: 'object', path: id,
    composition: composition('allOf', id),
    children: [{ name: 'child', type: 'string', path: `${id}-child` }],
  }
}

const stress: FieldNode = {
  name: 'entries', type: 'array', path: 'notation-field',
  value: { relation: 'item', path: 'notation-value', type: longType, presence: { nullable: true, empty: '{}' } },
}
</script>

<template>
  <main data-hierarchy-fixture class="min-h-screen space-y-8 bg-default p-4 text-default">
    <header class="flex flex-wrap items-center gap-3">
      <h1 class="text-xl font-semibold text-highlighted">Hierarchy verification</h1>
      <UButton data-theme="light" color="neutral" @click="setTheme('light')">Light</UButton>
      <UButton data-theme="dark" color="neutral" @click="setTheme('dark')">Dark</UButton>
    </header>
    <section class="flex flex-wrap items-start gap-4">
      <article v-for="width in widths" :key="width" :data-field-width="width" :style="{ width: `${width}px`, maxWidth: '100%' }">
        <h2 class="text-sm font-semibold">Field content box {{ width }}px</h2>
        <FieldItem v-bind="field(width)" />
      </article>
    </section>
    <section v-for="kind in kinds" :key="kind" class="space-y-3" :data-page-kind="kind">
      <h2 class="text-lg font-semibold">Page-level {{ kind }}</h2>
      <div class="flex flex-wrap items-start gap-4">
        <!-- anyOf's real content container has 48px padding + 2px card border.
             Compensation sets its content box to the same threshold probes.
             These exact test dimensions are intentionally fixture-only. -->
        <article v-for="width in widths" :key="width" :data-page-width="width" :style="{ width: `${width + (kind === 'anyOf' ? 50 : 0)}px`, maxWidth: '100%' }">
          <SchemaComposition v-bind="composition(kind, `page-${kind}-${width}`)" />
        </article>
      </div>
    </section>
    <section data-notation-fixture class="w-full max-w-sm">
      <h2 class="text-lg font-semibold">Long value notation</h2>
      <FieldItem v-bind="stress" />
    </section>
  </main>
</template>
