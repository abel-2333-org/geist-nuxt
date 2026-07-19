<script setup lang="ts">
import type { DocsShellDomain } from '~/utils/demo/api-docs/docs-shell-data'

const props = defineProps<{
  domain: DocsShellDomain
}>()

const requestVariants = computed(() => [{
  language: 'bash',
  label: 'cURL',
  code: props.domain.endpoint.request,
}])

const responseVariants = computed(() => [{
  language: 'json',
  label: 'JSON',
  code: props.domain.endpoint.response,
}])
</script>

<template>
  <UContainer class="py-8 sm:py-10">
    <div class="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.72fr)]">
      <article class="min-w-0 space-y-12">
        <header id="overview" class="scroll-mt-[var(--docs-shell-sticky-offset)] space-y-4">
          <p class="font-mono text-xs font-medium uppercase tracking-widest text-muted">
            {{ props.domain.label }}
          </p>
          <h1 class="text-3xl font-semibold tracking-tight text-highlighted sm:text-4xl">
            {{ props.domain.endpoint.title }}
          </h1>
          <p class="max-w-3xl text-base leading-7 text-muted">
            {{ props.domain.overview }}
          </p>
        </header>

        <section id="quickstart" class="scroll-mt-[var(--docs-shell-sticky-offset)] space-y-3">
          <h2 class="text-xl font-semibold tracking-tight text-highlighted">Quickstart</h2>
          <p class="max-w-3xl leading-7 text-muted">{{ props.domain.quickstart }}</p>
        </section>

        <section id="authentication" class="scroll-mt-[var(--docs-shell-sticky-offset)] space-y-3">
          <h2 class="text-xl font-semibold tracking-tight text-highlighted">Authentication</h2>
          <p class="max-w-3xl leading-7 text-muted">{{ props.domain.authentication }}</p>
          <UAlert
            color="info"
            variant="subtle"
            icon="i-lucide-shield-check"
            title="Keep credentials on the server"
            description="Never expose live bearer tokens in browser bundles or copied examples."
          />
        </section>

        <section :id="props.domain.endpoint.id" class="scroll-mt-[var(--docs-shell-sticky-offset)] space-y-6">
          <div class="space-y-3">
            <div class="flex flex-wrap items-center gap-3">
              <ApiDocsMethodBadge :method="props.domain.endpoint.method" />
              <code class="font-mono text-sm text-toned">{{ props.domain.endpoint.path }}</code>
            </div>
            <h2 class="text-2xl font-semibold tracking-tight text-highlighted">
              {{ props.domain.endpoint.title }}
            </h2>
            <p class="max-w-3xl leading-7 text-muted">{{ props.domain.endpoint.description }}</p>
          </div>

          <ApiDocsFieldGroup label="Request body" :count="props.domain.endpoint.fields.length">
            <ApiDocsFieldItem
              v-for="field in props.domain.endpoint.fields"
              :key="field.path"
              v-bind="field"
            />
          </ApiDocsFieldGroup>
        </section>

        <section class="space-y-4">
          <h2 class="text-xl font-semibold tracking-tight text-highlighted">Related endpoints</h2>
          <div class="grid gap-3 sm:grid-cols-2">
            <section
              v-for="endpoint in props.domain.secondaryEndpoints"
              :id="endpoint.id"
              :key="endpoint.id"
              class="scroll-mt-[var(--docs-shell-sticky-offset)] space-y-3 rounded-lg border border-default p-4"
            >
              <div class="flex items-center gap-2">
                <ApiDocsMethodBadge :method="endpoint.method" size="sm" />
                <h3 class="text-sm font-medium text-highlighted">{{ endpoint.title }}</h3>
              </div>
              <p class="text-sm leading-6 text-muted">{{ endpoint.description }}</p>
            </section>
          </div>
        </section>
      </article>

      <aside class="min-w-0 space-y-6 lg:sticky lg:top-[var(--docs-shell-sticky-offset)] lg:self-start">
        <ApiDocsCodeBlock title="Request" :variants="requestVariants" />
        <ApiDocsCodeBlock title="Response" :variants="responseVariants" default-wrap />
      </aside>
    </div>
  </UContainer>
</template>
