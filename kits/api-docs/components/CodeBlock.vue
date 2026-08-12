<script setup lang="ts">
// Domain component (API docs) — a self-contained, multi-language code block.
//
// This is NOT a Markdown code fence or a ProsePre. It renders structured
// samples that come from an API spec. Per the Geist code aesthetic it is
// deliberately near-monochrome and carries NO runtime syntax highlighter or
// content pipeline. It can render explicitly trusted, pre-sanitized build-time
// highlighted HTML; otherwise it escapes the raw code. For trusted dual-theme
// Shiki fragments (inline light `color` + `--shiki-dark` per token span) it
// also owns the dark-mode token switch — see the style block. The component
// owns UI, interaction (language switch, wrap), responsive layout, and a11y;
// copy always uses the raw source and is delegated to the shared <CopyButton>.
//
// Composed only from Nuxt UI primitives (USelect, UButton, UIcon) + CopyButton
// + Geist semantic tokens. It is the reusable base that RequestExample and
// ResponseExample delegate their body to.
//
// Anatomy:  header/toolbar
//             ├─ left:  icon · title · #leading slot (e.g. status badge)
//             └─ right: #controls slot (scenario/status) · language · wrap · copy
//           notice: optional #notice slot strip below the toolbar (wrapper context)
//           body: scrollable, max-height near-mono code surface; with no code,
//                 an optional #body slot lets wrappers render a semantic panel
//                 (empty body / missing example / file) inside the same frame
// States:   active language, wrap on/off, empty / unavailable. (Copied state
//           lives in CopyButton.)
// A11y:     icon buttons carry dynamic aria-labels; copy result announcement is
//           owned by CopyButton; selects are labelled; :focus-visible rings
//           are preserved. The scrollable code surface is a keyboard-focusable
//           named group (tabindex=0) so keyboard users can scroll it without
//           turning every code block into a page landmark.

export interface CodeVariant {
  /** Language id used for selection, e.g. 'curl' | 'json' | 'node' | 'python' | 'go'. */
  language: string
  /** Display label for the language switch. Falls back to a humanized id. */
  label?: string
  /** Raw source — always the clipboard truth and the escaped-render fallback. */
  code: string
  /**
   * Optional build-time highlighted markup. It is rendered only when the
   * CodeBlock explicitly opts into `trustHighlightedHtml`; never pass user or
   * runtime-authored HTML without sanitizing it upstream.
   */
  highlightedHtml?: string
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
  /** Complete localized success/failure toast sentences. */
  copySuccess?: string
  copyFailure?: string
  wrapOn?: string
  wrapOff?: string
  emptyTitle?: string
  emptyHint?: string
  /** Accessible name of the scrollable code region when no `title` is given. */
  codeRegion?: string
}

type ResolvedApiCodeLabels = Required<Omit<ApiCodeLabels, 'copySuccess' | 'copyFailure'>>
  & Pick<ApiCodeLabels, 'copySuccess' | 'copyFailure'>

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
    /**
     * Explicitly trust and render variants[].highlightedHtml. Keep false for
     * untrusted/runtime content; raw `code` remains escaped and copyable.
     */
    trustHighlightedHtml?: boolean
  }>(),
  {
    variants: () => [],
    icon: 'i-lucide-terminal',
    defaultWrap: false,
    maxHeight: '24rem',
    labels: () => ({}),
    languageLabels: () => ({}),
    trustHighlightedHtml: false,
  },
)

// Merge caller copy over neutral English defaults. Chrome text only.
const t = computed<ResolvedApiCodeLabels>(() => ({
  language: 'Language',
  copy: 'Copy code',
  copied: 'Copied to clipboard',
  wrapOn: 'Turn on line wrap',
  wrapOff: 'Turn off line wrap',
  emptyTitle: 'No example available',
  emptyHint: 'There is no sample here yet. Try another selection.',
  codeRegion: 'Code sample',
  ...props.labels,
  // Preserve the existing localization surface: a caller that already supplied
  // `copied` gets the same complete sentence in both aria feedback and toast.
  copySuccess: props.labels.copySuccess ?? props.labels.copied,
  copyFailure: props.labels.copyFailure,
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
const trustedHighlightedHtml = computed(() =>
  props.trustHighlightedHtml ? current.value?.highlightedHtml : undefined,
)

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
// carry its own `label`. `langLabel` (kit utils/lang-preset.ts, auto-imported)
// resolves caller overrides (`languageLabels`) → preset → capitalized id.
const languageItems = computed(() =>
  variants.value.map(v => ({
    label: v.label ?? langLabel(v.language, props.languageLabels),
    value: v.language,
  })),
)

/* ------------------------------------------------------------------ *
 * Word wrap (shared + persisted). Copy is delegated to <CopyButton>.
 * ------------------------------------------------------------------ */
const wrap = useCodeWrap(props.defaultWrap)
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
           the reader can always switch back to a populated selection. The
           language select follows the same rule — it is a selection control,
           so it stays visible whenever >1 languages exist even if the ACTIVE
           variant has no code (otherwise a single empty variant would trap the
           reader in the empty state its own hint says to switch away from);
           only the content-bound controls (wrap/copy) hide with no code. -->
      <div class="flex min-w-0 items-center justify-end gap-1.5">
        <slot name="controls" />

        <!-- Language -->
        <USelect
          v-if="languageItems.length > 1"
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
          @click="() => { wrap = !wrap }"
        />

        <!-- Copy — shared CopyButton owns the clipboard logic, copied state,
             toast, and polite announcement. Matches the toolbar's `xs` ghost
             controls; no tooltip here since the sibling buttons don't use one. -->
        <CopyButton
          v-if="hasContent"
          :value="current?.code ?? ''"
          :success-message="t.copySuccess"
          :failure-message="t.copyFailure"
          :label="t.copy"
          :copied-label="t.copied"
          size="xs"
        />
      </div>
    </div>

    <!-- Notice strip — optional wrapper-provided context (e.g. a response
         status description) rendered between the toolbar and the body so it
         shares the block's chrome. Non-breaking: absent slot renders nothing. -->
    <div
      v-if="$slots.notice"
      class="border-b border-default bg-muted/40 px-4 py-2 text-sm text-muted"
    >
      <slot name="notice" />
    </div>

    <!-- Body — raw source by default; v-html is behind an explicit trust gate
         for pre-sanitized build-time output only. Clipboard always uses code.
         The surface scrolls internally, so it must be reachable by keyboard
         (tabindex=0 + named group + focus-visible ring), or keyboard users
         could never read past maxHeight. translate="no": code is identifiers,
         not prose — machine translation must leave it verbatim. -->
    <div
      v-if="hasContent"
      class="code-surface bg-default focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
      :class="{ 'is-wrap': wrap }"
      :style="{ maxHeight }"
      tabindex="0"
      role="group"
      :aria-label="title || t.codeRegion"
    >
      <pre class="raw-pre" translate="no"><code
        v-if="trustedHighlightedHtml"
        class="font-mono text-sm leading-relaxed text-highlighted"
        v-html="trustedHighlightedHtml"
      /><code
        v-else
        class="font-mono text-sm leading-relaxed text-highlighted"
      >{{ current?.code }}</code></pre>
    </div>

    <!-- Wrapper-owned body panel — when there is no code but a wrapper supplies
         a semantic body state (empty body, missing example, binary file), it
         renders here instead of the generic empty state, inside the same frame. -->
    <div v-else-if="$slots.body" class="bg-default">
      <slot name="body" />
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

/* Trusted dual-theme Shiki fragments (defaultColor:'light' output): each token
   span carries its light color inline plus a `--shiki-dark` variable. The
   fragment has no `.shiki` wrapper for consumer CSS to target, and dark mode
   must beat the generator's inline style — `!important` is the only lever that
   does so without rewriting the HTML. Color only by contract: background stays
   with the surface, `--shiki-dark-font-style` etc. are a future contract.
   Spans without the variable fall back to the inherited neutral foreground
   (unpromised, out-of-contract input). `.dark` is the Nuxt UI color-mode
   class; v-html content needs :deep(). */
.dark .raw-pre :deep(span) {
  color: var(--shiki-dark, inherit) !important;
}
</style>
