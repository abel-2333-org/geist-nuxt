import type {
  EnumValue as FieldEnumValue,
  EnumVariant as FieldEnumVariant,
  FieldItemLabels,
  FieldLifecycle,
  FieldLifecycleInfo,
  FieldNode,
  FieldNote,
  FieldPresence,
  FieldValueNode,
  RequiredState,
  ValuePresence,
} from '../../kits/api-docs/components/FieldItem.vue'
import type {
  EnumValue,
  EnumVariant,
} from '../../kits/api-docs/components/EnumTable.vue'
import type { AnnotationPopoverLabels } from '../../foundation/components/AnnotationPopover.vue'

const required: RequiredState = 'conditional'
const lifecycle: FieldLifecycle = 'beta'
const lifecycleInfo: FieldLifecycleInfo = { status: lifecycle, since: 'v2' }
const note: FieldNote = { kind: 'constraint', text: 'Stable type import.' }
// @ts-expect-error `tone` was removed; note semantics have one canonical key.
const legacyNote: FieldNote = { tone: 'caution', text: 'Legacy note shape.' }
const value: EnumValue = { value: 'card', description: 'Card payment.' }
const variant: EnumVariant = { id: 'card', values: [value] }
// @ts-expect-error grouped enum identity is required and cannot fall back to localized copy.
const missingVariantId: EnumVariant = { values: [value] }
const fieldValue: FieldEnumValue = value
const fieldVariant: FieldEnumVariant = variant
const annotationLabels: AnnotationPopoverLabels = {
  loading: '正在加载预览',
  retry: '重试预览',
}
const labels: FieldItemLabels = {
  copyLink: name => `Copy ${name} link`,
  copiedLink: 'Link copied',
  composition: {
    oneOf: '其中一个',
    oneOfHint: '以下仅一个适用。',
  },
}
// A value node is additive: the field keeps its wire type and gains a shape.
const decoded: FieldValueNode = {
  relation: 'decoded',
  codec: 'json',
  type: 'object[]',
  // Decoded content may be an encoded empty container; the literal form is the author's.
  presence: { empty: '"[]"' },
  value: { relation: 'item', type: 'object', presence: { nullable: true }, fields: [{ name: 'sku', type: 'string' }] },
}
// A value has no key of its own, so it cannot be omitted — only its field can.
const valuePresence: ValuePresence = { nullable: true, empty: '[]' }
const leakedOptional: FieldValueNode = {
  relation: 'item',
  type: 'object',
  // @ts-expect-error `optional` is a field fact and never a value fact.
  presence: { optional: true },
}
const presence: FieldPresence = {
  optional: true,
  nullable: true,
  empty: '""',
  condition: 'Omitted until the build is `READY`.',
}
const field: FieldNode = {
  name: 'payment_method',
  type: 'object',
  required,
  presence,
  lifecycle: lifecycleInfo,
  notes: [note],
  enumVariants: [fieldVariant],
  value: decoded,
}

void field
void fieldValue
void valuePresence
void leakedOptional
void annotationLabels
void labels
void legacyNote
void missingVariantId
