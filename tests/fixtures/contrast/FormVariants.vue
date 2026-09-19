<script setup lang="ts">
const variants = ['outline', 'soft', 'subtle', 'ghost', 'none'] as const
const items = [
  { label: 'First option', value: 'first', description: 'First option description' },
  { label: 'Second option', value: 'second', description: 'Second option description' },
]
const tabs = [
  { label: 'First tab', value: 'first', content: 'First tab content' },
  { label: 'Second tab', value: 'second', content: 'Second tab content' },
]
</script>

<template>
  <section data-testid="form-variants" class="space-y-8">
    <div class="grid gap-4 md:grid-cols-2">
      <template v-for="variant in variants" :key="variant">
        <div :data-testid="`input-${variant}`" data-contrast-component="Input" :data-contrast-variant="variant">
          <UInput :variant="variant" color="neutral" :aria-label="`${variant} input placeholder`" placeholder="Input placeholder" class="w-full" />
        </div>
        <div :data-testid="`input-readonly-${variant}`" data-contrast-component="InputReadonly" :data-contrast-variant="variant">
          <UInput :variant="variant" color="neutral" :aria-label="`${variant} readonly input`" model-value="Readonly input value" readonly class="w-full" />
        </div>
        <div :data-testid="`textarea-${variant}`" data-contrast-component="Textarea" :data-contrast-variant="variant">
          <UTextarea :variant="variant" color="neutral" :aria-label="`${variant} textarea placeholder`" placeholder="Textarea placeholder" class="w-full" />
        </div>
        <div :data-testid="`textarea-readonly-${variant}`" data-contrast-component="TextareaReadonly" :data-contrast-variant="variant">
          <UTextarea :variant="variant" color="neutral" :aria-label="`${variant} readonly textarea`" model-value="Readonly textarea value" readonly class="w-full" />
        </div>
        <div :data-testid="`select-${variant}`" data-contrast-component="Select" :data-contrast-variant="variant">
          <USelect :variant="variant" color="neutral" :aria-label="`${variant} select`" :items="items" placeholder="Select placeholder" class="w-full" />
        </div>
        <div :data-testid="`select-menu-${variant}`" data-contrast-component="SelectMenu" :data-contrast-variant="variant">
          <USelectMenu
            :variant="variant" color="neutral" :aria-label="`${variant} select menu`" :items="items"
            placeholder="Select menu placeholder" :search-input="{ placeholder: 'Search options' }" class="w-full"
          />
        </div>
        <div :data-testid="`input-menu-${variant}`" data-contrast-component="InputMenu" :data-contrast-variant="variant">
          <UInputMenu :variant="variant" color="neutral" :aria-label="`${variant} input menu`" :items="items" placeholder="Input menu placeholder" class="w-full" />
        </div>
      </template>
    </div>
    <div data-testid="form-field-props">
      <UFormField label="Props field" description="Prop description" hint="Prop hint" help="Prop help">
        <UInput color="neutral" placeholder="Field placeholder" />
      </UFormField>
    </div>
    <div data-testid="form-field-slots">
      <UFormField label="Slots field">
        <template #description>Slot description</template>
        <template #hint>Slot hint</template>
        <template #help>Slot help</template>
        <UInput color="neutral" placeholder="Slot field placeholder" />
      </UFormField>
    </div>
    <div data-testid="tabs-pill">
      <UTabs :items="tabs" color="neutral" variant="pill" />
    </div>
    <div data-testid="tabs-link">
      <UTabs :items="tabs" color="neutral" variant="link" />
    </div>
    <UAlert data-testid="alert-neutral" color="neutral" variant="solid" title="Neutral alert" description="Neutral alert description retains its opacity" />
    <div data-testid="disabled-controls" class="flex flex-wrap gap-4">
      <div data-testid="disabled-input"><UInput color="neutral" disabled aria-label="Disabled input" placeholder="Disabled input placeholder" /></div>
      <div data-testid="disabled-textarea"><UTextarea color="neutral" disabled aria-label="Disabled textarea" placeholder="Disabled textarea placeholder" /></div>
    </div>
  </section>
</template>
