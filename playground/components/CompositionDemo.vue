<script setup lang="ts">
// Playground demo page for the SchemaComposition candidate. Demo-only
// fixtures stay inline here (never promoted). Exercises:
//   1. oneOf + discriminator (payment method) with a nested oneOf inside a
//      variant — recursion + tab auto-switching for deep links;
//   2. anyOf (contact channels) — non-exclusive collapsible sections;
//   3. allOf (resource shape) — fully expanded conjunction, incl. a
//      description-only variant (partial data);
//   4. deep-link buttons that jump into hidden variants to verify the
//      switch/expand → scroll → flash chain end to end.
// Spec: playground/composition.spec.md (issue #31).

import type { CompositionNode } from './SchemaComposition.vue'

// --- 1. oneOf + discriminator: payment method -------------------------------
const paymentMethod: CompositionNode = {
  kind: 'oneOf',
  discriminator: {
    propertyName: 'type',
    mapping: [
      { value: 'card', variantId: 'card' },
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

// --- Deep links into hidden variants -----------------------------------------
const anchor = useFieldAnchor()
onMounted(() => anchor.initFromHash())

const deepLinks = [
  { label: 'card → token (other tab)', path: 'request-body_card_token' },
  { label: 'wallet → Apple Pay device_token (nested tab)', path: 'request-body_wallet_apple-pay_device-token' },
  { label: 'phone → sms_opt_in (collapsed section)', path: 'contact_phone_sms-opt-in' },
]
</script>

<template>
  <div class="space-y-12">
    <!-- Deep-link harness: each jump targets a row hidden behind a tab or a
         collapsed section, verifying reveal → scroll → flash. -->
    <section class="space-y-3">
      <h2 class="text-base font-semibold text-highlighted">
        Deep-link checks
      </h2>
      <div class="flex flex-wrap gap-2">
        <UButton
          v-for="link in deepLinks"
          :key="link.path"
          color="neutral"
          variant="subtle"
          size="xs"
          icon="i-lucide-link-2"
          @click="anchor.goTo(link.path)"
        >
          {{ link.label }}
        </UButton>
      </div>
    </section>

    <!-- 1. Top-level oneOf under a field group: the request body itself is a
         composition, so SchemaComposition sits directly inside FieldGroup. -->
    <section class="space-y-4">
      <h2 class="text-base font-semibold text-highlighted">
        oneOf + discriminator — payment method
      </h2>
      <ApiDocsFieldGroup label="Request body" :heading-level="3">
        <PlaygroundSchemaComposition v-bind="paymentMethod" :heading-level="4" class="pt-3" />
      </ApiDocsFieldGroup>
    </section>

    <!-- 2. anyOf: sections open independently — verify two can be open at once. -->
    <section class="space-y-4">
      <h2 class="text-base font-semibold text-highlighted">
        anyOf — contact channels
      </h2>
      <ApiDocsFieldGroup label="Contact" :heading-level="3">
        <PlaygroundSchemaComposition v-bind="contactChannels" :heading-level="4" class="pt-3" />
      </ApiDocsFieldGroup>
    </section>

    <!-- 3. allOf: no selector, everything expanded, incl. a description-only part. -->
    <section class="space-y-4">
      <h2 class="text-base font-semibold text-highlighted">
        allOf — resource shape
      </h2>
      <ApiDocsFieldGroup label="Response body" :heading-level="3">
        <PlaygroundSchemaComposition v-bind="resourceShape" :heading-level="4" class="pt-3" />
      </ApiDocsFieldGroup>
    </section>
  </div>
</template>
