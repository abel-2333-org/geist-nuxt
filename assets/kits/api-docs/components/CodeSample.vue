<script setup lang="ts">
// Domain component (API docs) — a self-contained, multi-language code sample.
//
// This is NOT a Markdown code fence or a ProsePre. It renders structured
// samples that come from an API spec. Per the Geist code aesthetic it is
// deliberately near-monochrome: NO syntax highlighter, NO content pipeline —
// just a calm `<pre><code>` on the Geist code surface. The component owns UI,
// interaction (language switch, copy, wrap), responsive layout, and a11y.
//
// Composed only from Nuxt UI primitives (USelect, UButton, UIcon) + Geist
// semantic tokens. It is the reusable base that ApiRequestExample and
// ApiResponseExample delegate their body to.
//
// Anatomy:  header/toolbar
//             ├─ left:  icon · title · #leading slot (e.g. status badge)
//             └─ right: #controls slot (scenario/status) · language · wrap · copy
//           body: scrollable, max-height near-mono code surface
// States:   active language, copied (transient, no layout shift), wrap on/off,
//           empty / unavailable.
// A11y:     icon buttons carry dynamic aria-labels; copy result is announced in
//           a polite live region; selects are labelled; :focus-visible rings
//           are preserved.

export interface CodeVariant {
  /** Language id used for selection, e.g. 'curl' | 'json' | 'node' | 'python' | 'go'. */
  language: string
  /** Display label for the language switch. Falls back to a humanized id. */
  label?: string
  /** Raw source — this is what gets copied and rendered. */
  code: string
}

/**
 * Component-owned ("chrome") copy, so a doc site can localize the block in one
 * place — e.g. pass `$t()` values from @nuxtjs/i18n. Content strings (language
 * labels, titles) come from the data props and are rendered verbatim.
 */
export interface ApiCodeLabels {
  language?: string
  copy?: string
  copied?: string
  wrapOn?: string
  wrapOff?: string
  emptyTitle?: string
  emptyHint?: string
}

const props = withDefaults(
  defineProps<{
    /** Language variants. An empty array renders the unavailable state. */
    variants?: CodeVariant[]
    /** Toolbar title / filename shown at the header left. */
    title?: string
    /** Leading icon; defaults to a terminal glyph. */
    icon?: string
    /** Initial (first-visit) word-wrap state; shared + persisted afterwards. */
    defaultWrap?: boolean
    /** Max height of the scrollable code surface. */
    maxHeight?: string
    /** Overridable UI copy for localization. See ApiCodeLabels. */
    labels?: ApiCodeLabels
    /** Override / extend the language id → display label map, e.g. { curl: 'cURL' }. */
    languageLabels?: Record<string, string>
  }>(),
  {
    variants: () => [],
    icon: 'i-lucide-terminal',
    defaultWrap: false,
    maxHeight: '24rem',
    labels: () => ({}),
    languageLabels: () => ({}),
  },
)

// Merge caller copy over neutral English defaults. Chrome text only.
const t = computed<Required<ApiCodeLabels>>(() => ({
  language: 'Language',
  copy: 'Copy code',
  copied: 'Copied to clipboard',
  wrapOn: 'Turn on line wrap',
  wrapOff: 'Turn off line wrap',
  emptyTitle: 'No example available',
  emptyHint: 'There is no sample here yet. Try another selection.',
  ...props.labels,
}))

/* ------------------------------------------------------------------ *
 * Selection state
 * ------------------------------------------------------------------ */
const variants = computed(() => props.variants ?? [])
const activeLanguage = ref<string | undefined>()

const current = computed<CodeVariant | undefined>(
  () => variants.value.find(v => v.language === activeLanguage.value) ?? variants.value[0],
)

const hasContent = computed(() => !!current.value?.code)

// Preserve the chosen language across data changes when it still exists;
// otherwise fall back to the first available language.
watch(
  variants,
  (set) => {
    if (!set.some(v => v.language === activeLanguage.value)) {
      activeLanguage.value = set[0]?.language
    }
  },
  { immediate: true },
)

/* ------------------------------------------------------------------ *
 * Language items
 * ------------------------------------------------------------------ */
// Fallback display label for a language id, used only when a variant doesn't
// carry its own `label`. Caller overrides (`languageLabels`) win over defaults.
const DEFAULT_LANG_LABELS: Record<string, string> = {
  curl: 'cURL',
  json: 'JSON',
  node: 'Node',
  nodejs: 'Node',
  javascript: 'JavaScript',
  js: 'JavaScript',
  python: 'Python',
  py: 'Python',
  go: 'Go',
  http: 'HTTP',
  bash: 'Shell',
  shell: 'Shell',
}
function humanize(id: string) {
  const key = id.toLowerCase()
  return (
    props.languageLabels[key]
    ?? DEFAULT_LANG_LABELS[key]
    ?? id.charAt(0).toUpperCase() + id.slice(1)
  )
}

const languageItems = computed(() =>
  variants.value.map(v => ({ label: v.label ?? humanize(v.language), value: v.language })),
)

/* ------------------------------------------------------------------ *
 * Word wrap (shared + persisted) and copy (transient, no layout shift)
 * ------------------------------------------------------------------ */
const wrap = useCodeWrap(props.defaultWrap)

const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

async function copy() {
  const code = current.value?.code
  if (!code) return
  try {
    await navigator.clipboard.writeText(code)
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
  <section class="w-full overflow-hidden rounded-lg border border-default bg-elevated shadow-xs">
    <!-- Header / toolbar — ALWAYS a single row (never wraps or stacks). The
         title truncates first and the selects shrink to fit; the icon buttons
         stay fixed. Wrappers inject scenario/status controls via #controls. -->
    <div
      class="flex flex-nowrap items-center justify-between gap-x-3 border-b border-default bg-muted/60 px-3 py-2"
    >
      <!-- Left: icon · title · injected leading (e.g. status badge) -->
      <div class="flex min-w-0 items-center gap-2">
        <UIcon
          :name="icon"
          class="size-4 shrink-0 text-muted"
          aria-hidden="true"
        />
        <span v-if="title" class="truncate text-sm font-medium text-highlighted">
          {{ title }}
        </span>
        <slot name="leading" />
      </div>

      <!-- Right: injected controls (scenario/status) · language · wrap · copy.
           Uniform `xs` selects align perfectly; each may shrink + truncate its
           trigger to keep the row single-line, while the dropdown panel still
           opens to full content width. Icon buttons never shrink. The injected
           #controls (scenario/status) stay visible even in the empty state so
           the reader can always switch back to a populated selection; only the
           content-bound controls (language/wrap/copy) hide when there's no code. -->
      <div class="flex min-w-0 items-center justify-end gap-1.5">
        <slot name="controls" />

        <!-- Language -->
        <USelect
          v-if="hasContent && languageItems.length > 1"
          v-model="activeLanguage"
          :items="languageItems"
          icon="i-lucide-code"
          size="xs"
          color="neutral"
          variant="subtle"
          :aria-label="t.language"
          class="min-w-0 max-w-full"
          :ui="{ content: 'min-w-fit' }"
        />

        <!-- Wrap toggle -->
        <UButton
          v-if="hasContent"
          :icon="wrap ? 'i-lucide-wrap-text' : 'i-lucide-text'"
          :color="wrap ? 'primary' : 'neutral'"
          variant="ghost"
          size="xs"
          class="shrink-0"
          :aria-label="wrap ? t.wrapOff : t.wrapOn"
          :aria-pressed="wrap"
          @click="wrap = !wrap"
        />

        <!-- Copy -->
        <UButton
          v-if="hasContent"
          :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
          :color="copied ? 'success' : 'neutral'"
          variant="ghost"
          size="xs"
          class="shrink-0"
          :aria-label="copied ? t.copied : t.copy"
          @click="copy"
        />
      </div>
    </div>

    <!-- Body — near-monochrome, no highlighter (Geist code aesthetic). -->
    <div
      v-if="hasContent"
      class="code-surface bg-default"
      :class="{ 'is-wrap': wrap }"
      :style="{ maxHeight }"
    >
      <pre class="raw-pre"><code class="font-mono text-sm leading-relaxed text-highlighted">{{ current?.code }}</code></pre>
    </div>

    <!-- Empty / unavailable state -->
    <div
      v-else
      class="flex flex-col items-center justify-center gap-2 bg-default px-6 py-12 text-center"
    >
      <UIcon name="i-lucide-code-xml" class="size-8 text-dimmed" aria-hidden="true" />
      <p class="text-sm font-medium text-highlighted">{{ t.emptyTitle }}</p>
      <p class="max-w-xs text-sm text-muted">{{ t.emptyHint }}</p>
    </div>

    <!-- Polite announcement for copy result -->
    <span role="status" aria-live="polite" class="sr-only">
      {{ copied ? t.copied : '' }}
    </span>
  </section>
</template>

<style scoped>
/* Scroll surface: internal scrolling only, so long code never forces the page
   into horizontal overflow. Both axes scroll here; wrap mode kills the x-axis. */
.code-surface {
  overflow: auto;
  overscroll-behavior: contain;
}

.raw-pre {
  margin: 0;
  padding: 0.75rem 1rem;
  white-space: pre;
}

/* Word wrap on: stop horizontal scroll, wrap long lines. */
.code-surface.is-wrap .raw-pre {
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}
</style>
