<script setup lang="ts">
// Domain component (API docs) — a self-contained multi-language code block.
// Composed from Nuxt UI UTabs + UButton, themed with Geist tokens. No content
// pipeline / no syntax highlighter: Geist code blocks are calm, near-mono.
//
// Anatomy:  header (filename/lang + copy button) · optional UTabs (langs) · <pre> body
// State:    active tab (string-controlled), copy hover/focus, transient "copied".
// A11y:     copy button has dynamic aria-label + polite live region; UTabs
//           (Reka UI) provides roving-tabindex keyboard nav out of the box.

export interface CodeVariant {
  /** Tab label, e.g. "cURL" | "JavaScript" | "Python". */
  label: string
  /** Freeform language tag shown when there is a single variant. */
  language?: string
  code: string
}

const props = defineProps<{
  /** Multi-language variants → language tabs. */
  variants?: CodeVariant[]
  /** Single-sample shortcut (ignored when `variants` is provided). */
  code?: string
  language?: string
  /** Optional filename/title shown at the header left. */
  title?: string
}>()

// Normalize to a variants array so the template has one code path.
const items = computed<CodeVariant[]>(() =>
  props.variants?.length
    ? props.variants
    : [{ label: props.title ?? 'code', language: props.language, code: props.code ?? '' }],
)

const isMulti = computed(() => (props.variants?.length ?? 0) > 1)

// UTabs must be controlled by a *string* value (Reka UI compares by identity).
const active = ref('0')
const current = computed<CodeVariant>(() => items.value[Number(active.value)] ?? items.value[0]!)

// Tab items use string `value` so v-model stays string end-to-end.
const tabItems = computed(() =>
  items.value.map((v, i) => ({ label: v.label, value: String(i) })),
)

const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

async function copy() {
  try {
    await navigator.clipboard.writeText(current.value.code)
    copied.value = true
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => (copied.value = false), 1600)
  } catch {
    // Clipboard may be unavailable (e.g. insecure context); fail silently.
  }
}

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-default bg-elevated shadow-xs">
    <!-- Header: filename/lang (or tabs) + copy affordance -->
    <div class="flex items-center justify-between gap-2 border-b border-default bg-muted/60 px-3 py-1.5">
      <div class="flex min-w-0 items-center gap-2">
        <UIcon name="i-lucide-terminal" class="size-4 shrink-0 text-muted" aria-hidden="true" />
        <UTabs
          v-if="isMulti"
          v-model="active"
          :items="tabItems"
          variant="link"
          size="xs"
          class="min-w-0"
        />
        <span v-else class="truncate font-mono text-xs text-muted">
          {{ title ?? current.language ?? 'code' }}
        </span>
      </div>

      <UButton
        :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
        :color="copied ? 'success' : 'neutral'"
        variant="ghost"
        size="xs"
        :aria-label="copied ? 'Copied to clipboard' : 'Copy code'"
        @click="copy"
      />
    </div>

    <!-- Body -->
    <pre class="overflow-x-auto bg-default px-4 py-3 text-sm leading-relaxed"><code class="font-mono text-highlighted">{{ current.code }}</code></pre>

    <!-- Polite announcement for copy result -->
    <span role="status" aria-live="polite" class="sr-only">
      {{ copied ? 'Copied to clipboard' : '' }}
    </span>
  </div>
</template>
