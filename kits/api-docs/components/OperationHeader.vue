<script setup lang="ts">
// ENDPOINT IDENTITY HEADER (domain: API docs): the recurring block that
// introduces one HTTP operation — method badge + mono path on the identity
// row, then the summary heading and an optional description paragraph.
// Promoted from repeated page markup (standalone reference page + long-scroll
// domain pages + compact endpoint stubs) once the same anatomy appeared in
// every consumer.
//
// Anatomy:  identity row ── <ApiDocsMethodBadge> · truncating mono path ·
//                           #badges slot (e.g. <ApiDocsLifecycleBadge>)
//           heading      ── summary, level via `headingLevel`
//           description  ── optional muted paragraph
//
// Pure display, no state model. All copy comes in via props/slot — the
// component hardcodes no strings.
//
// `headingLevel` slots the header into the page outline (spec precedent:
// FieldGroup): a standalone reference page owns the page <h1>; a long-scroll
// domain page keeps its own <h1> and renders endpoints as <h2>. Defaults to 2
// — the page-unique <h1> remains the consumer's responsibility. At level 1
// the heading gains the page-title upsize (sm:text-[2rem]) used by standalone
// reference pages.
//
// `size="sm"` is the compact stub form (index/anchor targets in a long
// scroll): smaller heading, tighter stack. `divider` appends the bottom
// hairline + breathing room that full reference sections use to separate the
// header from the field tree below; stubs leave it off.
const props = withDefaults(
  defineProps<{
    method: string
    path: string
    summary: string
    description?: string
    headingLevel?: 1 | 2 | 3 | 4
    size?: 'lg' | 'sm'
    divider?: boolean
  }>(),
  {
    headingLevel: 2,
    size: 'lg',
    divider: false,
  },
)

const headingClass = computed(() => {
  if (props.size === 'sm') return 'text-lg font-semibold tracking-tight text-highlighted text-balance'
  if (props.headingLevel === 1)
    return 'text-2xl font-semibold tracking-tight text-highlighted text-balance sm:text-[2rem] sm:leading-tight'
  return 'text-2xl font-semibold tracking-tight text-highlighted text-balance'
})
</script>

<template>
  <header
    :class="[
      props.size === 'sm' ? 'space-y-2' : 'space-y-4',
      props.divider ? 'border-b border-default pb-8' : '',
    ]"
  >
    <div class="flex flex-wrap items-center gap-2.5">
      <ApiDocsMethodBadge :method="props.method" />
      <code class="min-w-0 truncate font-mono text-sm text-highlighted">{{ props.path }}</code>
      <slot name="badges" />
    </div>
    <component :is="`h${props.headingLevel}`" :class="headingClass">
      {{ props.summary }}
    </component>
    <p v-if="props.description" class="max-w-2xl leading-relaxed text-muted text-pretty">
      {{ props.description }}
    </p>
  </header>
</template>
