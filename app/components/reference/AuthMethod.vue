<script setup lang="ts">
// One authentication method row inside the Authentication panel. Scheme-
// agnostic: it looks up presentation (icon/title/summary/params) from the
// overridable `authPreset` and renders it. Adding a new scheme = extend the
// preset + the AuthRequirement union; this component doesn't change.
import type { AuthRequirement } from '~/types/domain'
import { authPreset } from '~/utils/auth-preset'

const props = defineProps<{
  requirement: AuthRequirement
  /** Reference link label (chrome copy → i18n seam). */
  referenceLabel?: string
}>()

const entry = computed(() => authPreset[props.requirement.scheme])
const summary = computed(() => entry.value.summary(props.requirement))
const params = computed(() => entry.value.params(props.requirement))
const isExternal = computed(() =>
  props.requirement.reference ? /^https?:\/\//i.test(props.requirement.reference) : false,
)
</script>

<template>
  <div class="py-4">
    <!-- Marker + title share one centered row so the icon's center aligns to
         the title's center — no magic nudge, no floating icon. -->
    <div class="flex items-center gap-3">
      <span
        class="flex size-8 shrink-0 items-center justify-center rounded-md bg-elevated text-muted ring-1 ring-inset ring-default"
        aria-hidden="true"
      >
        <UIcon :name="entry.icon" class="size-4" />
      </span>
      <h3 class="min-w-0 flex-1 text-sm font-medium text-default">
        {{ entry.title }}
      </h3>
    </div>

    <!-- Body indented to align under the title (pl = icon 32 + gap 12 = 44). -->
    <div class="mt-2 space-y-2 pl-11">
      <p class="text-pretty text-sm leading-relaxed text-toned">
        {{ summary }}
      </p>

      <!-- Structured parameters: label + code token, tabular and scannable -->
      <dl v-if="params.length" class="flex flex-wrap gap-x-6 gap-y-2">
        <div v-for="p in params" :key="p.label" class="flex min-w-0 max-w-full items-center gap-2">
          <dt class="shrink-0 text-xs font-medium uppercase tracking-wide text-dimmed">
            {{ p.label }}
          </dt>
          <dd class="min-w-0">
            <InlineCode v-if="p.code" class="break-all">{{ p.value }}</InlineCode>
            <span v-else class="text-sm text-toned tabular-nums">{{ p.value }}</span>
          </dd>
        </div>
      </dl>

      <ProseA
        v-if="requirement.reference"
        :href="requirement.reference"
        :target="isExternal ? '_blank' : undefined"
        class="inline-flex items-center gap-1 rounded-sm text-sm text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {{ referenceLabel ?? 'Learn more' }}
        <UIcon
          :name="isExternal ? 'i-lucide-arrow-up-right' : 'i-lucide-arrow-right'"
          class="size-4"
          aria-hidden="true"
        />
      </ProseA>
    </div>
  </div>
</template>
