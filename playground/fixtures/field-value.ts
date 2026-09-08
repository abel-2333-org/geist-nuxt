// Playground fixtures for issue #117. Draft data only — never distributed, and
// deliberately synthetic so no real endpoint's wording is being reviewed here.
//
// The set is the acceptance matrix from the issue, in the issue's order, so a
// reviewer can walk the page top to bottom against the checklist: primitive
// array → object array → JSON object → JSON object array → JSON primitive array
// → JSON scalar → record → nested array → nested encoding → composition.
import type { FieldItemLabels, FieldNode } from '../../kits/api-docs/utils/field'
import type { FieldValueLabels, ValueBearingField } from '../model/field-value'

/**
 * The mapping the issue reports, expressed the only way the CURRENT model
 * allows. Rendered by the real kit <FieldItem> so the "before" is the shipped
 * component, not a strawman: `[]` and "JSON string content" are real rows here,
 * with real child counts and a real second disclosure.
 */
export const currentMapping: FieldNode[] = [
  {
    path: 'before_tags',
    name: 'tags',
    type: 'array',
    description: 'Search tags attached to the resource.',
    children: [
      {
        path: 'before_tags_item',
        name: '[]',
        type: 'string',
        notes: [{ kind: 'constraint', label: 'Min length', text: 'At least 1 character.' }],
      },
    ],
  },
  {
    path: 'before_nested',
    name: 'nested',
    type: 'string',
    description: 'Additional information passed as a JSON string.',
    children: [
      {
        path: 'before_nested_content',
        name: 'JSON string content',
        type: 'object',
        children: [
          { path: 'before_nested_enabled', name: 'enabled', type: 'boolean' },
        ],
      },
    ],
  },
]

/** The same facts, expressed as value shape instead of invented fields. */
export const candidateMapping: ValueBearingField[] = [
  {
    path: 'after_tags',
    name: 'tags',
    type: 'string[]',
    description: 'Search tags attached to the resource.',
    value: {
      relation: 'item',
      type: 'string',
      notes: [{ label: 'Min length', text: 'At least 1 character.' }],
    },
  },
  {
    path: 'after_nested',
    name: 'nested',
    type: 'string',
    description: 'Additional information passed as a JSON string.',
    value: {
      relation: 'decoded',
      codec: 'json',
      type: 'object',
      path: 'after_nested_json',
      fields: [
        { path: 'after_nested_enabled', name: 'enabled', type: 'boolean' },
      ],
    },
  },
]

/** The full shape matrix the issue requires ("不得只美化上述两个例子"). */
export const shapeMatrix: ValueBearingField[] = [
  // 1. Primitive array — the issue's mock, verbatim: two scannable rows, no
  //    disclosure, no invented row.
  {
    path: 'm_tags',
    name: 'tags',
    type: 'string[]',
    description: 'Search tags attached to the resource.',
    notes: [{ text: 'At least 1 element.' }],
    value: {
      relation: 'item',
      type: 'string',
      notes: [{ text: 'At least 1 character.' }],
    },
  },

  // 1b. A plain object field with REAL children, parked next to the object
  //     array on purpose: this is the adjacency that decides whether the two
  //     disclosure verbs need different wording. `gitSource.ref` is addressed
  //     directly; `items[].sku` is addressed per element.
  {
    path: 'm_gitSource',
    name: 'gitSource',
    type: 'object',
    description: 'Where the deployment source is pulled from.',
    children: [
      { path: 'm_gitSource_repoId', name: 'repoId', type: 'string', required: true },
      { path: 'm_gitSource_ref', name: 'ref', type: 'string', defaultValue: 'main' },
      // Object inside an object — children all the way down. Ordinary nesting
      // never touches the value model, however deep it goes: every level has a
      // real name you can write (`gitSource.auth.tokenRef`).
      {
        path: 'm_gitSource_auth',
        name: 'auth',
        type: 'object',
        description: 'Credentials used to clone the repository.',
        children: [
          { path: 'm_gitSource_auth_tokenRef', name: 'tokenRef', type: 'string', required: true },
        ],
      },
      // Array inside an object — the FIELD is an ordinary child. Only its
      // ELEMENT is nameless, so only that one level is a value.
      {
        path: 'm_gitSource_regions',
        name: 'regions',
        type: 'string[]',
        description: 'Regions to build in.',
        notes: [{ text: 'At least 1 element.' }],
        value: {
          relation: 'item',
          type: 'string',
          notes: [{ label: 'Format', text: 'Region slug, e.g. `iad1`.' }],
        },
      },
    ],
  },

  // 2. Object array — one disclosure reaches the real properties. The element's
  //    own rule survives the removal of the `[]` row.
  {
    path: 'm_items',
    name: 'items',
    type: 'object[]',
    required: true,
    description: 'Line items on the order.',
    notes: [{ text: 'At least 1 element.' }],
    value: {
      relation: 'item',
      type: 'object',
      path: 'm_items_item',
      notes: [{ label: 'Rule', text: '`sku` must be unique across items.' }],
      fields: [
        {
          path: 'm_items_sku',
          name: 'sku',
          type: 'string',
          required: true,
          description: 'Merchant-side product identifier.',
          examples: ['SKU-10293'],
        },
        {
          path: 'm_items_quantity',
          name: 'quantity',
          type: 'integer',
          required: true,
          defaultValue: '1',
          notes: [{ label: 'Range', text: 'Between 1 and 999.' }],
        },
      ],
    },
  },

  // 3. JSON-encoded object — the parent row still says `string`, because that
  //    is what the wire carries.
  {
    path: 'm_metadata',
    name: 'metadata',
    type: 'string',
    description: 'Additional information passed as a JSON string.',
    notes: [{ label: 'Max length', text: 'Up to 4096 characters after encoding.' }],
    value: {
      relation: 'decoded',
      codec: 'json',
      type: 'object',
      path: 'm_metadata_json',
      notes: [{ label: 'Size', text: 'Up to 20 keys.' }],
      fields: [
        {
          path: 'm_metadata_reference',
          name: 'reference',
          type: 'string',
          required: true,
          description: 'Merchant-side reference echoed back on every event.',
        },
        {
          path: 'm_metadata_channel',
          name: 'channel',
          type: 'string',
          enumValues: [
            { value: 'web', description: 'Hosted checkout.' },
            { value: 'pos', description: 'In-store terminal.' },
          ],
        },
      ],
    },
  },

  // 4. JSON-encoded object array — the one FOLD in the model: decode boundary
  //    and element boundary share a single disclosure.
  {
    path: 'm_lineItemsJson',
    name: 'lineItemsJson',
    type: 'string',
    description: 'Line items serialized as a JSON array.',
    notes: [{ label: 'Max length', text: 'Up to 8192 characters after encoding.' }],
    value: {
      relation: 'decoded',
      codec: 'json',
      type: 'object[]',
      notes: [{ label: 'Size', text: 'At least 1 element, at most 100.' }],
      value: {
        relation: 'item',
        type: 'object',
        notes: [{ label: 'Rule', text: 'Amounts are expressed in minor units.' }],
        fields: [
          { path: 'm_lineItemsJson_sku', name: 'sku', type: 'string', required: true },
          { path: 'm_lineItemsJson_amount', name: 'amount', type: 'integer', required: true },
        ],
      },
    },
  },

  // 5. JSON-encoded primitive array — nothing structural, so no empty fold.
  {
    path: 'm_allowedCurrenciesJson',
    name: 'allowedCurrenciesJson',
    type: 'string',
    description: 'Currencies the merchant may settle in.',
    value: {
      relation: 'decoded',
      codec: 'json',
      type: 'string[]',
      notes: [{ text: 'At least 1 element.' }],
      value: {
        relation: 'item',
        type: 'string',
        // An element with allowed values, so the review can see what the issue
        // calls for when an element says more than one short rule: the block
        // gets a heading and reuses EnumTable, rather than being flattened into
        // one sentence or dropped.
        description: 'Currency the merchant is cleared to settle in.',
        enumValues: [
          { value: 'USD', description: 'United States dollar.' },
          { value: 'EUR', description: 'Euro.' },
          { value: 'SGD', description: 'Singapore dollar.' },
        ],
        notes: [{ label: 'Format', text: 'ISO 4217 alphabetic code.' }],
      },
    },
  },

  // 6. JSON-encoded scalar — a default and a range, still no structure, so the
  //    block gets a heading but never a chevron.
  {
    path: 'm_retryLimitJson',
    name: 'retryLimitJson',
    type: 'string',
    description: 'Delivery retry budget, sent as a JSON number.',
    value: {
      relation: 'decoded',
      codec: 'json',
      type: 'integer',
      description: 'Number of redelivery attempts before the event is parked.',
      defaultValue: '3',
      notes: [{ label: 'Range', text: 'Between 0 and 10.' }],
      examples: ['5'],
    },
  },

  // 7. Record — dynamic members get their own voice; no `*` row.
  {
    path: 'm_headers',
    name: 'headers',
    type: 'record<string, object>',
    description: 'Custom headers sent with every delivery, keyed by header name.',
    notes: [{ label: 'Size', text: 'Up to 10 entries.' }],
    value: {
      relation: 'member',
      type: 'object',
      notes: [{ label: 'Key', text: 'Header name must match `^[A-Za-z0-9-]+$`.' }],
      fields: [
        { path: 'm_headers_value', name: 'value', type: 'string', required: true },
        {
          path: 'm_headers_secret',
          name: 'secret',
          type: 'boolean',
          defaultValue: 'false',
          notes: [{ kind: 'caveat', text: 'Non-secret header values are stored in plain text.' }],
        },
      ],
    },
  },

  // 8. Nested array — two element boundaries, so two regions. The indent, not
  //    a repeated heading, is what tells them apart.
  {
    path: 'm_matrix',
    name: 'matrix',
    type: 'object[][]',
    description: 'Pricing grid, one array per tier.',
    notes: [{ text: 'At least 1 row.' }],
    value: {
      relation: 'item',
      type: 'object[]',
      notes: [{ label: 'Size', text: 'Each row holds 1 to 20 cells.' }],
      value: {
        relation: 'item',
        type: 'object',
        fields: [
          { path: 'm_matrix_value', name: 'value', type: 'number', required: true },
          { path: 'm_matrix_label', name: 'label', type: 'string' },
        ],
      },
    },
  },

  // 9. Nested encoding — the next JSON boundary appears only because a REAL
  //    field is itself an encoded string.
  {
    path: 'm_envelope',
    name: 'envelope',
    type: 'string',
    description: 'Signed envelope carrying the provider payload.',
    value: {
      relation: 'decoded',
      codec: 'json',
      type: 'object',
      fields: [
        { path: 'm_envelope_signature', name: 'signature', type: 'string', required: true },
        {
          path: 'm_envelope_payload',
          name: 'payload',
          type: 'string',
          required: true,
          description: 'Provider payload, itself JSON-encoded.',
          value: {
            relation: 'decoded',
            codec: 'json',
            type: 'object',
            fields: [
              { path: 'm_envelope_payload_status', name: 'status', type: 'string', required: true },
            ],
          },
        },
      ],
    },
  },

  // 10. Composition at a value root — the element is polymorphic; the existing
  //     SchemaComposition keeps its semantics instead of being flattened.
  {
    path: 'm_destinations',
    name: 'destinations',
    type: 'object[]',
    description: 'Where settlement funds are routed.',
    notes: [{ text: 'At least 1 element.' }],
    value: {
      relation: 'item',
      type: 'object',
      composition: {
        kind: 'oneOf',
        discriminator: {
          propertyName: 'type',
          mapping: [
            { value: 'bank_account', variantId: 'bank' },
            { value: 'wallet', variantId: 'wallet' },
          ],
        },
        variants: [
          {
            id: 'bank',
            label: 'Bank account',
            fields: [
              { path: 'm_dest_bank_iban', name: 'iban', type: 'string', format: 'iban', required: true },
            ],
          },
          {
            id: 'wallet',
            label: 'Wallet',
            fields: [
              { path: 'm_dest_wallet_id', name: 'walletId', type: 'string', required: true },
            ],
          },
        ],
      },
    },
  },
]

/** Chinese chrome, supplied the way a bilingual consumer supplies it: one
 *  labels object, no component fork. Mirrors the issue's ZH wording. */
export const zhLabels: FieldItemLabels & FieldValueLabels = {
  required: '必填',
  conditional: '条件必填',
  default: '默认值',
  example: '示例',
  constraints: '约束',
  note: '说明',
  caveat: '注意',
  showChildren: '展开子参数',
  hideChildren: '收起子参数',
  enumLabel: '允许值',
  enumFilter: '筛选值',
  enumEmpty: '没有匹配的值',
  composition: {
    oneOf: '二选一',
    oneOfHint: '请求体只能匹配下列其中一种结构。',
  },
  eachItem: '每个元素',
  eachMember: '每个键',
  // Chrome is configured per locale, so the two languages need not be equally terse:
  // English drops "requirements" because the column already is requirements,
  // while a bare 「值」/「数组」 reads as a noun fragment rather than a heading.
  decodedRequirements: '值要求',
  decodedArrayRequirements: '数组要求',
}
