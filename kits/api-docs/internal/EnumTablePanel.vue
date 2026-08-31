<script setup lang="ts">
import type { EnumValue } from '../utils/enum'
import { useResizeObserver } from '@vueuse/core'

const props = defineProps<{
  values: EnumValue[]
  when?: string
  bounded: boolean
  label: string
  defaultValue?: string
  defaultLabel: string
  emptyLabel: string
}>()

// A bounded panel only joins the tab order when it genuinely overflows.
// Descriptions and viewport width both affect the rendered height, so authored
// row count is not a sufficient proxy for keyboard scroll reachability.
const scrollBox = useTemplateRef<HTMLElement>('scrollBox')
const scrollable = shallowRef(false)
const focusable = computed(() => props.bounded && scrollable.value)

function measureOverflow() {
  const el = scrollBox.value
  scrollable.value = Boolean(
    props.bounded
    && el
    && el.scrollHeight > el.clientHeight + 1,
  )
}

// Coalesce resize bursts into one next-frame measurement; useRafTask owns the
// frame lifecycle (cancel-on-reschedule, unmount cleanup, sync test fallback).
const { schedule: scheduleOverflowMeasure } = useRafTask(measureOverflow)

useResizeObserver(scrollBox, scheduleOverflowMeasure)
onMounted(scheduleOverflowMeasure)
watch([() => props.values, () => props.bounded], () => scheduleOverflowMeasure(), {
  deep: true,
  flush: 'post',
})
</script>

<template>
  <div class="space-y-2">
    <!-- The tab title names the group; this caption says when it applies. -->
    <p
      v-if="when"
      data-enum-when
      class="wrap-anywhere min-w-0 text-xs leading-relaxed text-muted"
    >
      <InlineMarkdown :text="when" />
    </p>

    <!-- Authored length keeps the max-height stable; measured DOM overflow
         controls keyboard chrome so a short result leaves the tab order. -->
    <div
      ref="scrollBox"
      data-enum-scroll
      class="overflow-hidden rounded-lg border border-default"
      :class="bounded
        ? [
          'max-h-80 overflow-y-auto',
          focusable
            ? 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
            : '',
        ]
        : ''"
      :tabindex="focusable ? 0 : undefined"
      :role="focusable ? 'group' : undefined"
      :aria-label="focusable ? label : undefined"
    >
      <dl
        v-if="values.length"
        class="grid grid-cols-[fit-content(12rem)_1fr] gap-x-4 divide-y divide-default"
      >
        <div
          v-for="item in values"
          :key="item.value"
          class="col-span-2 grid grid-cols-subgrid items-baseline gap-y-1 bg-muted/40 px-3 py-2.5"
        >
          <dt class="min-w-0">
            <InlineCode class="break-all">{{ item.value }}</InlineCode>
            <span
              v-if="defaultValue !== undefined && item.value === defaultValue"
              class="ms-2 text-xs font-medium uppercase tracking-wide text-dimmed"
            >{{ defaultLabel }}</span>
          </dt>
          <dd v-if="item.description" class="min-w-0 text-sm leading-relaxed text-muted">
            <InlineMarkdown :text="item.description" />
          </dd>
        </div>
      </dl>

      <p v-else class="bg-muted/40 px-3 py-4 text-sm text-dimmed">
        {{ emptyLabel }}
      </p>
    </div>
  </div>
</template>
