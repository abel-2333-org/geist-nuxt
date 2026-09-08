<script setup lang="ts">
// Candidate surface for issue #117 — "distinguish real fields from array
// elements and encoded content". Draft only: nothing on this page is in
// `registry.json`, and the page is `nav: false` so it stays out of the gallery.
//
// Read it top to bottom against the issue's acceptance list. The first section
// is the shipped component rendering the mapping the issue reports, so the
// comparison is against real behaviour rather than a description of it.
import {
  candidateMapping,
  currentMapping,
  shapeMatrix,
  zhLabels,
} from '../../playground/fixtures/field-value'
import {
  doTransactionRequestFields,
  doTransactionResponseFields,
} from '../../playground/fixtures/do-transaction'

definePageMeta({ nav: false })

const anchor = useFieldAnchor()
onMounted(() => anchor.initFromHash())

// Chrome language. English lives in the component defaults; Chinese arrives the
// way a consumer supplies it — one labels object for the whole tree.
const locale = shallowRef<'en' | 'zh'>('en')
function setLocale(next: 'en' | 'zh') { locale.value = next }


// Stripe also splits the child verb by DIRECTION — "child parameters" in the
// request section, "child attributes" in the response section. That needs no
// new capability here: `showChildren` / `hideChildren` are already per-call-site
// labels, so a consumer passes a different pair to each tree.

const labels = computed(() => (locale.value === 'zh' ? zhLabels : {}))

// Column width, not viewport width: these rows respond to their own container
// (`@container/field`), which is what a docs page actually varies.
const widths = [
  { value: 0, label: 'Full' },
  { value: 532, label: '532px' },
  { value: 390, label: '390px' },
]
const width = shallowRef(0)
function setWidth(next: number) { width.value = next }
const columnStyle = computed(() => (width.value ? { maxWidth: `${width.value}px` } : undefined))
</script>

<template>
  <PlaygroundStage
    title="Field value structure (#117)"
    description="Array elements and JSON-encoded content are the shape of a value, not fields. Candidate model, one region per boundary the reader actually crosses."
  >
    <div class="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-default bg-elevated/40 px-4 py-3">
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs font-medium uppercase tracking-wide text-dimmed">Chrome</span>
        <UButton
          v-for="option in (['en', 'zh'] as const)"
          :key="option"
          size="xs"
          :variant="locale === option ? 'solid' : 'outline'"
          :color="locale === option ? 'primary' : 'neutral'"
          @click="setLocale(option)"
        >
          {{ option === 'en' ? 'English' : '中文' }}
        </UButton>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs font-medium uppercase tracking-wide text-dimmed">Column</span>
        <UButton
          v-for="option in widths"
          :key="option.value"
          size="xs"
          :variant="width === option.value ? 'solid' : 'outline'"
          :color="width === option.value ? 'primary' : 'neutral'"
          @click="setWidth(option.value)"
        >
          {{ option.label }}
        </UButton>
      </div>
    </div>

    <section class="space-y-4">
      <header class="space-y-1">
        <h2 class="text-lg font-semibold tracking-tight text-highlighted">
          1 · Reported mapping — shipped &lt;FieldItem&gt;
        </h2>
        <p class="text-sm leading-relaxed text-muted">
          Two content boundaries spend two disclosures and two invented parameter names
          (<code class="font-mono text-xs">[]</code>, <code class="font-mono text-xs">JSON string content</code>),
          and each counts as a child.
        </p>
      </header>
      <div :style="columnStyle" class="ps-6">
        <FieldItem
          v-for="field in currentMapping"
          :key="field.path"
          v-bind="field"
          :labels="labels"
        />
      </div>
    </section>

    <section class="space-y-4">
      <header class="space-y-1">
        <h2 class="text-lg font-semibold tracking-tight text-highlighted">
          2 · Same facts, candidate model
        </h2>
        <p class="text-sm leading-relaxed text-muted">
          No invented rows. The array's element rule reads inline; the encoded object keeps
          <code class="font-mono text-xs">string</code> on the parent row and states its format.
        </p>
      </header>
      <div :style="columnStyle" class="ps-6">
        <PlaygroundFieldRow
          v-for="field in candidateMapping"
          :key="field.path"
          v-bind="field"
          :labels="labels"
        />
      </div>
    </section>

    <section class="space-y-4">
      <header class="space-y-1">
        <h2 class="text-lg font-semibold tracking-tight text-highlighted">
          3 · Shape matrix
        </h2>
        <p class="text-sm leading-relaxed text-muted">
          Primitive array · object array · JSON object · JSON object array · JSON primitive array ·
          JSON scalar · record · nested array · nested encoding · composition at a value root.
        </p>
      </header>
      <div :style="columnStyle" class="ps-6">
        <PlaygroundFieldRow
          v-for="field in shapeMatrix"
          :key="field.path"
          v-bind="field"
          :labels="labels"
        />
      </div>
    </section>

    <!-- 4 · The consumer's real endpoint. Encoding is the norm here, so this is
         the section that decides the disclosure question — the synthetic matrix
         cannot, because its base rate is wrong. -->
    <section class="mt-16">
      <h2 class="text-xl font-semibold text-highlighted">
        4 · Real endpoint — <code class="font-mono text-base" translate="no">POST /v1/txn/doTransaction</code>
      </h2>
      <p class="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
        Transcribed from the consumer's OpenAPI document. Eleven structured fields are
        <code class="font-mono" translate="no">type: string</code> + <code class="font-mono" translate="no">json_string</code>;
        not one is a plain object. <code class="font-mono" translate="no">txnOrderMsg.products</code> is encoded
        <em>inside</em> an encoded payload — the double-stringify trap.
      </p>

      <h3 class="mt-8 text-sm font-medium uppercase tracking-wide text-dimmed">Request</h3>
      <div class="mt-3" :style="columnStyle">
        <PlaygroundFieldRow
          v-for="field in doTransactionRequestFields"
          :key="field.path"
          v-bind="field"
          :labels="labels"
        />
      </div>

      <h3 class="mt-10 text-sm font-medium uppercase tracking-wide text-dimmed">Response · data</h3>
      <div class="mt-3" :style="columnStyle">
        <PlaygroundFieldRow
          v-for="field in doTransactionResponseFields"
          :key="field.path"
          v-bind="field"
          :labels="labels"
        />
      </div>
    </section>
  </PlaygroundStage>
</template>
