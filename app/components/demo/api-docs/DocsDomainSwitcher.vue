<script setup lang="ts">
import type { DocsShellDomainSummary } from '~/utils/demo/api-docs/docs-shell-data'

const props = defineProps<{
  domains: DocsShellDomainSummary[]
  modelValue: string
  ariaLabel?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [domainId: string]
}>()

const open = shallowRef(false)
const activeDomain = computed(() => props.domains.find(domain => domain.id === props.modelValue))

function selectDomain(domainId: string) {
  emit('update:modelValue', domainId)
  open.value = false
}
</script>

<template>
  <UPopover v-model:open="open" :ui="{ content: 'w-[calc(100vw-2rem)] max-w-xl p-2' }">
    <UButton
      color="neutral"
      variant="ghost"
      class="min-w-0"
      :aria-label="props.ariaLabel ?? 'Switch documentation domain'"
    >
      <UIcon v-if="activeDomain" :name="activeDomain.icon" class="size-4 shrink-0 text-muted" />
      <span class="truncate">{{ activeDomain?.label }}</span>
      <UIcon name="i-lucide-chevrons-up-down" class="size-3.5 shrink-0 text-dimmed" />
    </UButton>

    <template #content>
      <div
        role="group"
        :aria-label="props.ariaLabel ?? 'Documentation domains'"
        class="grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        <button
          v-for="domain in props.domains"
          :key="domain.id"
          type="button"
          :aria-pressed="domain.id === props.modelValue"
          class="flex min-w-0 items-start gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          :class="domain.id === props.modelValue
            ? 'border-primary bg-primary/10'
            : 'border-default hover:border-accented hover:bg-elevated'"
          @click="selectDomain(domain.id)"
        >
          <span class="flex size-9 shrink-0 items-center justify-center rounded-sm bg-elevated">
            <UIcon :name="domain.icon" class="size-4 text-toned" />
          </span>
          <span class="min-w-0 flex-1 space-y-1">
            <span class="flex items-center justify-between gap-2 text-sm font-medium text-highlighted">
              {{ domain.label }}
              <UIcon
                v-if="domain.id === props.modelValue"
                name="i-lucide-check"
                class="size-4 shrink-0 text-primary"
              />
            </span>
            <span class="block truncate text-xs text-muted">{{ domain.description }}</span>
          </span>
        </button>
      </div>
    </template>
  </UPopover>
</template>
