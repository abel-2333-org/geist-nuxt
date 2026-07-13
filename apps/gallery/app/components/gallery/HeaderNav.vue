<script setup lang="ts">
import type { DropdownMenuItem, NavigationMenuItem } from '@nuxt/ui'
import type { KitGroup } from '~/composables/useGalleryNav'

const props = defineProps<{
  primary: NavigationMenuItem[]
  kits: KitGroup[]
}>()

const route = useRoute()
const kitsActive = computed(() => route.path.startsWith('/kits'))

// One dropdown group per kit: a label heading followed by its pages.
// Nested arrays render as divider-separated groups, so more kits stay legible.
const kitMenu = computed<DropdownMenuItem[][]>(() =>
  props.kits.map((kit) => [
    { label: kit.label, type: 'label' },
    ...kit.pages.map((page) => ({ label: page.label, icon: page.icon, to: page.to })),
  ]),
)
</script>

<template>
  <div class="flex items-center gap-1">
    <UNavigationMenu
      :items="primary"
      variant="link"
      color="primary"
      highlight
      highlight-color="primary"
    />

    <UDropdownMenu
      v-if="kits.length"
      :items="kitMenu"
      :content="{ align: 'start', sideOffset: 8 }"
      :ui="{ content: 'min-w-56' }"
    >
      <UButton
        label="Kits"
        trailing-icon="i-lucide-chevron-down"
        color="neutral"
        variant="ghost"
        :class="[
          'font-normal',
          kitsActive ? 'text-highlighted' : 'text-muted hover:text-highlighted',
        ]"
      />
    </UDropdownMenu>
  </div>
</template>
