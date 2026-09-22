<script setup lang="ts">
const dropdownItems = [{ label: 'Menu option', description: 'Dropdown description' }]
</script>

<template>
  <section data-testid="overlay-descriptions" class="flex flex-wrap gap-4">
    <UModal title="Modal title" description="Modal description" :ui="{ content: 'contrast-modal-content' }">
      <UButton data-testid="modal-trigger" color="neutral" variant="outline">Open modal</UButton>
      <template #body><p data-contrast-slot="modal-body" class="text-muted">Modal body</p></template>
    </UModal>
    <USlideover title="Slideover title" description="Slideover description" :ui="{ content: 'contrast-slideover-content' }">
      <UButton data-testid="slideover-trigger" color="neutral" variant="outline">Open slideover</UButton>
      <template #body><p data-contrast-slot="slideover-body" class="text-muted">Slideover body</p></template>
    </USlideover>
    <UPopover :ui="{ content: 'contrast-popover-content' }">
      <UButton data-testid="popover-trigger" color="neutral" variant="outline">Open popover</UButton>
      <template #content>
        <p data-contrast-slot="popover-description" class="p-4 text-sm text-muted">Popover description</p>
      </template>
    </UPopover>
    <UTooltip text="Tooltip description" :delay-duration="0" :ui="{ content: 'contrast-tooltip-content' }">
      <UButton data-testid="tooltip-trigger" color="neutral" variant="outline">Show tooltip</UButton>
    </UTooltip>
    <UDropdownMenu :items="dropdownItems" :ui="{ content: 'contrast-dropdown-content' }">
      <UButton data-testid="dropdown-trigger" color="neutral" variant="outline">Open dropdown</UButton>
    </UDropdownMenu>
  </section>
</template>
