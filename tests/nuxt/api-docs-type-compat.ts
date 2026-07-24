import type {
  EnumValue as FieldEnumValue,
  EnumVariant as FieldEnumVariant,
  FieldItemLabels,
  FieldLifecycle,
  FieldLifecycleInfo,
  FieldNode,
  FieldNote,
  RequiredState,
} from '../../kits/api-docs/components/FieldItem.vue'
import type {
  EnumValue,
  EnumVariant,
} from '../../kits/api-docs/components/EnumTable.vue'
import type { AnnotationPopoverLabels } from '../../foundation/components/AnnotationPopover.vue'

const required: RequiredState = 'conditional'
const lifecycle: FieldLifecycle = 'beta'
const lifecycleInfo: FieldLifecycleInfo = { status: lifecycle, since: 'v2' }
const note: FieldNote = { text: 'Stable legacy type import.' }
const value: EnumValue = { value: 'card', description: 'Card payment.' }
const variant: EnumVariant = { values: [value] }
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
const field: FieldNode = {
  name: 'payment_method',
  type: 'object',
  required,
  lifecycle: lifecycleInfo,
  notes: [note],
  enumVariants: [fieldVariant],
}

void field
void fieldValue
void annotationLabels
void labels
