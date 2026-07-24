<script setup lang="ts">
import type { CompositionNode, FieldNode } from '../../../../kits/api-docs/utils/field'

definePageMeta({ nav: { label: 'Schema 组合', icon: 'i-lucide-git-fork', order: 5 } })

// Demo/story for <ApiDocsSchemaComposition> — per the geist-nuxt layering,
// demo fixtures live in the gallery and the kit only ships the data-agnostic
// component. Inline neutral ViewModels exercise:
//   1. oneOf + discriminator (payment method) with a nested oneOf inside a
//      variant — recursion + tab auto-switching for deep links;
//   2. anyOf (contact channels) — non-exclusive collapsible sections;
//   3. allOf (resource shape) — fully expanded conjunction, incl. a
//      description-only part (partial data);
//   4. field-level composition — a plain field whose value is itself a oneOf,
//      rendered by ApiDocsFieldItem via delegation (the promotion's new path);
//   5. deep-link buttons that jump into hidden variants to verify the
//      switch/expand → scroll → flash chain end to end.

// --- 1. oneOf + discriminator: payment method -------------------------------
const paymentMethod: CompositionNode = {
  kind: 'oneOf',
  discriminator: {
    propertyName: 'type',
    mapping: [
      { value: 'card', variantId: 'card' },
      { value: 'saved_card', variantId: 'card' },
      { value: 'wallet', variantId: 'wallet' },
    ],
  },
  variants: [
    {
      id: 'card',
      label: 'Card payment',
      description: 'Charge a tokenized card. The token comes from the client-side SDK and is single-use.',
      // No hand-written `type` row: the component synthesizes the
      // discriminator field from the mapping (canonical usage).
      fields: [
        {
          path: 'request-body_card_token',
          name: 'token',
          type: 'string',
          required: true,
          description: 'Single-use card token issued by the client SDK.',
          examples: ['tok_1NirD82eZvKYlo2C'],
        },
        {
          path: 'request-body_card_save-for-future',
          name: 'save_for_future',
          type: 'boolean',
          defaultValue: 'false',
          description: 'Store the card for later reuse after a successful charge.',
        },
      ],
    },
    {
      id: 'wallet',
      label: 'Wallet payment',
      description: 'Charge a digital wallet. The wallet payload itself varies by provider (nested one-of).',
      fields: [
        {
          path: 'request-body_wallet_wallet-id',
          name: 'wallet_id',
          type: 'string',
          required: true,
          description: 'Identifier of the shopper wallet to charge.',
        },
        {
          path: 'request-body_wallet_type',
          name: 'type',
          type: 'string',
          required: true,
          description: 'Selects the wallet payment shape.',
        },
      ],
      composition: {
        kind: 'oneOf',
        discriminator: {
          propertyName: 'provider',
          mapping: [
            { value: 'apple_pay', variantId: 'apple-pay' },
            { value: 'google_pay', variantId: 'google-pay' },
          ],
        },
        variants: [
          {
            id: 'apple-pay',
            label: 'Apple Pay',
            fields: [
              {
                path: 'request-body_wallet_apple-pay_device-token',
                name: 'device_token',
                type: 'string',
                required: true,
                description: 'Opaque device payment token from PassKit.',
              },
            ],
          },
          {
            id: 'google-pay',
            label: 'Google Pay',
            fields: [
              {
                path: 'request-body_wallet_google-pay_gateway-token',
                name: 'gateway_token',
                type: 'string',
                required: true,
                description: 'Gateway token returned by the Google Pay API.',
              },
            ],
          },
        ],
      },
    },
  ],
}

// --- 2. anyOf: contact channels (non-exclusive) ------------------------------
const contactChannels: CompositionNode = {
  kind: 'anyOf',
  variants: [
    {
      id: 'email',
      label: 'Email channel',
      description: 'Reach the customer by email. Can be combined with the phone channel.',
      fields: [
        {
          path: 'contact_email_address',
          name: 'email',
          type: 'string',
          format: 'email',
          required: true,
          examples: ['ada@example.com'],
        },
      ],
    },
    {
      id: 'phone',
      label: 'Phone channel',
      description: 'Reach the customer by phone or SMS. Can be combined with the email channel.',
      fields: [
        {
          path: 'contact_phone_number',
          name: 'phone_number',
          type: 'string',
          format: 'e164',
          required: true,
          examples: ['+14155550132'],
        },
        {
          path: 'contact_phone_sms-opt-in',
          name: 'sms_opt_in',
          type: 'boolean',
          defaultValue: 'false',
          description: 'Whether the customer agreed to receive SMS.',
        },
      ],
    },
  ],
}

// --- 3. allOf: resource shape (conjunction, incl. a fields-less part) --------
const resourceShape: CompositionNode = {
  kind: 'allOf',
  variants: [
    {
      id: 'base',
      label: 'Base resource',
      fields: [
        {
          path: 'resource_base_id',
          name: 'id',
          type: 'string',
          required: true,
          description: 'Globally unique resource identifier.',
        },
        {
          path: 'resource_base_created-at',
          name: 'created_at',
          type: 'string',
          format: 'date-time',
          required: true,
        },
      ],
    },
    {
      id: 'audit',
      label: 'Audit fields',
      fields: [
        {
          path: 'resource_audit_updated-at',
          name: 'updated_at',
          type: 'string',
          format: 'date-time',
        },
        {
          path: 'resource_audit_updated-by',
          name: 'updated_by',
          type: 'string',
          description: 'Actor id of the last modification.',
        },
      ],
    },
    {
      id: 'immutability',
      label: 'Immutability rule',
      description: 'Once created, `id` and `created_at` never change. Updates only touch audit fields.',
      fields: [],
    },
  ],
}

// --- 4. Field-level composition: a field row whose value is itself a oneOf ----
// ApiDocsFieldItem delegates the `composition` to ApiDocsSchemaComposition
// after any concrete children — the promotion's new capability.
const destinationField: FieldNode = {
  path: 'transfer_destination',
  name: 'destination',
  type: 'object',
  required: true,
  description: 'Where the transfer lands. Concrete metadata plus a polymorphic target.',
  children: [
    {
      path: 'transfer_destination_reference',
      name: 'reference',
      type: 'string',
      required: true,
      description: 'Idempotent client reference for this destination.',
    },
  ],
  composition: {
    kind: 'oneOf',
    discriminator: {
      propertyName: 'kind',
      mapping: [
        { value: 'bank_account', variantId: 'bank' },
        { value: 'card', variantId: 'card' },
      ],
    },
    variants: [
      {
        id: 'bank',
        label: 'Bank account',
        fields: [
          {
            path: 'transfer_destination_bank_iban',
            name: 'iban',
            type: 'string',
            required: true,
            description: 'Destination IBAN.',
            examples: ['DE89370400440532013000'],
          },
        ],
      },
      {
        id: 'card',
        label: 'Debit card',
        fields: [
          {
            path: 'transfer_destination_card_last4',
            name: 'last4',
            type: 'string',
            required: true,
            description: 'Last four digits of the destination card.',
          },
        ],
      },
    ],
  },
}

// --- Deep links into hidden variants -----------------------------------------
const anchor = useFieldAnchor()
onMounted(() => anchor.initFromHash())

const deepLinks = [
  { label: 'card → token (other tab)', path: 'request-body_card_token' },
  { label: 'wallet → Apple Pay device_token (nested tab)', path: 'request-body_wallet_apple-pay_device-token' },
  { label: 'phone → sms_opt_in (collapsed section)', path: 'contact_phone_sms-opt-in' },
  { label: 'destination → card last4 (field-level tab)', path: 'transfer_destination_card_last4' },
]
</script>

<template>
  <UContainer class="py-16 sm:py-24">
    <section id="schema-composition" class="scroll-mt-20 space-y-10">
      <div class="space-y-2">
        <h2 class="text-2xl font-semibold tracking-tight text-highlighted">Schema 组合</h2>
        <p class="max-w-2xl text-muted">
          <code class="font-mono text-[0.8125rem]">ApiDocsSchemaComposition</code>：忠实呈现 OpenAPI / JSON Schema
          的 <b class="font-medium text-toned">oneOf / anyOf / allOf</b> 组合——
          oneOf 用 tabs（恰好一个成立）、anyOf 用独立开合的可折叠分区（至少一个成立）、
          allOf 顺序全展开（全部成立），三种语义绝不互相误读。
          <code class="font-mono text-[0.8125rem]">discriminator</code> 渲染为每个 variant 的首行真实字段（不虚构 wire path），
          deep link 会自动揭示隐藏的 tab / 分区。字段级组合由
          <code class="font-mono text-[0.8125rem]">ApiDocsFieldItem</code> 在子字段之后委托本组件渲染。
          组件数据无关、locale-ready，所有文案由调用方注入。
        </p>
      </div>

      <!-- Deep-link harness: each jump targets a row hidden behind a tab or a
           collapsed section, verifying reveal → scroll → flash. -->
      <section class="space-y-3">
        <h3 class="text-sm font-semibold text-highlighted">深链接检查</h3>
        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="link in deepLinks"
            :key="link.path"
            color="neutral"
            variant="subtle"
            size="xs"
            icon="i-lucide-link-2"
            @click="anchor.goTo(link.path, { focus: true })"
          >
            {{ link.label }}
          </UButton>
        </div>
      </section>

      <!-- 1. Top-level oneOf under a field group: the request body itself is a
           composition, so SchemaComposition sits directly inside FieldGroup. -->
      <section class="space-y-4">
        <h3 class="text-sm font-semibold text-highlighted">oneOf + discriminator — 支付方式</h3>
        <ApiDocsFieldGroup label="Request body" :heading-level="3">
          <ApiDocsSchemaComposition v-bind="paymentMethod" :heading-level="4" class="pt-3" />
        </ApiDocsFieldGroup>
      </section>

      <!-- 2. anyOf: sections open independently — verify two can be open at once. -->
      <section class="space-y-4">
        <h3 class="text-sm font-semibold text-highlighted">anyOf — 联系渠道</h3>
        <ApiDocsFieldGroup label="Contact" :heading-level="3">
          <ApiDocsSchemaComposition v-bind="contactChannels" :heading-level="4" class="pt-3" />
        </ApiDocsFieldGroup>
      </section>

      <!-- 3. allOf: no selector, everything expanded, incl. a description-only part. -->
      <section class="space-y-4">
        <h3 class="text-sm font-semibold text-highlighted">allOf — 资源形态</h3>
        <ApiDocsFieldGroup label="Response body" :heading-level="3">
          <ApiDocsSchemaComposition v-bind="resourceShape" :heading-level="4" class="pt-3" />
        </ApiDocsFieldGroup>
      </section>

      <!-- 4. Field-level composition delegated by a regular FieldItem row. -->
      <section class="space-y-4">
        <h3 class="text-sm font-semibold text-highlighted">字段级组合 — 委托自 FieldItem</h3>
        <ApiDocsFieldGroup label="Transfer" :heading-level="3">
          <ApiDocsFieldItem v-bind="destinationField" />
        </ApiDocsFieldGroup>
      </section>
    </section>
  </UContainer>
</template>
