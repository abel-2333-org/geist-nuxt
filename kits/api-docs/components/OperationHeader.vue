<script setup lang="ts">
// Domain composition (API docs): the identity header of an operation — it
// answers "which endpoint or webhook is this". One component for both kinds
// (OpenAPI 3.1 treats endpoint operations and webhooks as the same Operation
// object); the two forms are ~90% isomorphic, only the identity row differs:
//
//   endpoint → <ApiDocsMethodBadge> + mono path      (you call the platform)
//   webhook  → <ApiDocsEventBadge>  + mono event name (the platform calls you)
//
// Deliberately ORTHOGONAL to its siblings: it does not embed OperationTarget
// or LifecycleNotice — the consumer places those after the header, so each
// piece stays independently reusable.
//
// Anatomy:  identity row ── badge · mono identifier · [#actions, right-aligned]
//           heading      ── summary (+ inline <ApiDocsLifecycleBadge> when
//                           `lifecycle` is set)
//           #description ── caller copy (component stays copy-agnostic)
//           #default     ── trailing blocks (OperationTarget, LifecycleNotice…)
// States:   none of its own (static identity surface); children own theirs.
// A11y:     heading level is configurable (`headingLevel`, default 2, mirrors
//           FieldGroup) so the header slots into the page outline; the
//           identifier is real text (selectable, SR-readable); lifecycle badge
//           carries icon + text, never color alone.

// Identity is a discriminated union on `kind`: an endpoint MUST carry
// method + path, a webhook MUST carry event. This makes "endpoint without a
// method" a type error at the call site instead of silently rendering a fake
// GET badge over an empty path.
interface EndpointIdentity {
  kind: 'endpoint'
  /** Endpoint identity: HTTP method (e.g. "POST"). */
  method: string
  /** Endpoint identity: URL path (e.g. "/v1/checkout/sessions"). */
  path: string
  /** Webhook identity: not applicable to endpoints. */
  event?: never
}

interface WebhookIdentity {
  kind: 'webhook'
  /** Webhook identity: event name (e.g. "payment.succeeded"). */
  event: string
  /** Endpoint identity: not applicable to webhooks. */
  method?: never
  /** Endpoint identity: not applicable to webhooks. */
  path?: never
}

type OperationHeaderProps = (EndpointIdentity | WebhookIdentity) & {
  /** Human title of the operation. */
  summary: string
  /** Operation-level lifecycle, rendered as a badge next to the heading. */
  lifecycle?: EndpointLifecycle
  /** Heading level for the summary; slots into the page outline. */
  headingLevel?: 2 | 3 | 4
}

const props = withDefaults(defineProps<OperationHeaderProps>(), {
  headingLevel: 2,
})

const identifier = computed(() =>
  props.kind === 'endpoint' ? props.path : props.event,
)
</script>

<template>
  <header class="flex flex-col gap-3">
    <div class="flex min-w-0 items-center gap-3">
      <ApiDocsMethodBadge v-if="props.kind === 'endpoint'" :method="props.method" />
      <ApiDocsEventBadge v-else />

      <code class="min-w-0 truncate font-mono text-sm text-highlighted">
        {{ identifier }}
      </code>

      <div v-if="$slots.actions" class="ml-auto flex shrink-0 items-center gap-2">
        <slot name="actions" />
      </div>
    </div>

    <div class="flex min-w-0 flex-wrap items-center gap-3">
      <component
        :is="`h${props.headingLevel}`"
        class="text-balance text-2xl font-semibold tracking-tight text-highlighted"
      >
        {{ props.summary }}
      </component>
      <ApiDocsLifecycleBadge v-if="props.lifecycle" :status="props.lifecycle" />
    </div>

    <div v-if="$slots.description" class="max-w-prose text-pretty text-muted">
      <slot name="description" />
    </div>

    <slot />
  </header>
</template>
