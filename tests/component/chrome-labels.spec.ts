// Nested chrome localization contract (issue #29): a bilingual consumer must
// be able to remove every English chrome string through public props — no
// preset swap, no type cast, no component fork, no CSS hiding.
// Covers: operation-level beta + label injection (OperationHeader /
// LifecycleNotice), FieldItem lifecycle badge labels, full EnumTable
// structural-label passthrough (flat + variant + filter empty state),
// recursive child rows, and unchanged English defaults.
import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import FieldItem from '../../kits/api-docs/components/FieldItem.vue'
import EnumTable from '../../kits/api-docs/components/EnumTable.vue'
import OperationHeader from '../../kits/api-docs/components/OperationHeader.vue'
import LifecycleNotice from '../../kits/api-docs/components/LifecycleNotice.vue'

/** 中文 chrome labels，一次声明覆盖整棵字段树（含递归子行）。 */
const zhLabels = {
  required: '必填',
  default: '默认值',
  lifecycle: { new: '新增', beta: '内测', deprecated: '已废弃' },
  enumLabel: '允许值',
  enumFilter: '筛选值',
  enumEmpty: '无匹配值',
  enumVariant: (i: number) => `选项 ${i + 1}`,
  composition: {
    oneOf: '其中一个',
    anyOf: '任意组合',
    allOf: '全部组合',
    oneOfHint: '以下仅一个适用。',
    anyOfHint: '以下至少一个适用。',
    allOfHint: '以下全部适用。',
    discriminatorDescription: (values: readonly string[]) => `固定为 ${values.join('、')}。`,
    empty: '暂无组合形态',
  },
}

/** ≥ filterThreshold(30) 的扁平 enum，触发筛选框 + 空态路径。 */
const manyValues = Array.from({ length: 30 }, (_, i) => ({
  value: `value_${i}`,
  description: `desc ${i}`,
}))

describe('operation-level lifecycle (OperationHeader / LifecycleNotice)', () => {
  it('accepts beta without casts and renders the preset default label', async () => {
    const wrapper = await mountSuspended(OperationHeader, {
      props: { kind: 'endpoint', method: 'POST', path: '/v1/pay', summary: '支付', lifecycle: 'beta' },
    })
    expect(wrapper.text()).toContain('Beta')
  })

  it('injects a localized lifecycle label via lifecycle-label', async () => {
    const wrapper = await mountSuspended(OperationHeader, {
      props: {
        kind: 'endpoint', method: 'POST', path: '/v1/pay', summary: '支付',
        lifecycle: 'beta', lifecycleLabel: '内测',
      },
    })
    expect(wrapper.text()).toContain('内测')
    expect(wrapper.text()).not.toContain('Beta')
  })

  it('LifecycleNotice shares the vocabulary: beta renders with a localizable title', async () => {
    const wrapper = await mountSuspended(LifecycleNotice, {
      props: { status: 'beta', title: '内测中', description: '接口可能变更' },
    })
    expect(wrapper.text()).toContain('内测中')
    expect(wrapper.text()).not.toContain('Beta')
  })
})

describe('FieldItem lifecycle badge labels', () => {
  it('renders the localized label for the row status (中文 beta)', async () => {
    const wrapper = await mountSuspended(FieldItem, {
      props: { name: 'channel', type: 'string', lifecycle: { status: 'beta' as const }, labels: zhLabels },
    })
    expect(wrapper.text()).toContain('内测')
    expect(wrapper.text()).not.toContain('Beta')
  })

  it('keeps the English preset default when labels omit the status', async () => {
    const wrapper = await mountSuspended(FieldItem, {
      props: { name: 'channel', type: 'string', lifecycle: { status: 'new' as const }, labels: { lifecycle: { beta: '内测' } } },
    })
    expect(wrapper.text()).toContain('New')
  })
})

describe('FieldItem anchor accessible labels', () => {
  it('includes the field name in every default anchor action', async () => {
    const wrapper = await mountSuspended(FieldItem, {
      props: { name: 'amount', path: 'body_amount', type: 'integer' },
    })
    const labels = wrapper.findAll('button[aria-label]').map(button => button.attributes('aria-label'))

    expect(labels).toEqual(['Copy link to amount', 'Copy link to amount'])
  })

  it('keeps string labels compatible and lets a function own the complete label', async () => {
    const stringWrapper = await mountSuspended(FieldItem, {
      props: {
        name: 'amount',
        path: 'body_amount',
        type: 'integer',
        labels: { copyLink: '复制字段链接' },
      },
    })
    expect(stringWrapper.find('button[aria-label]').attributes('aria-label')).toBe('复制字段链接')

    const functionWrapper = await mountSuspended(FieldItem, {
      props: {
        name: 'amount',
        path: 'body_amount',
        type: 'integer',
        labels: { copyLink: name => `复制 ${name} 的字段链接` },
      },
    })
    expect(functionWrapper.find('button[aria-label]').attributes('aria-label')).toBe('复制 amount 的字段链接')
  })
})

describe('FieldItem → EnumTable structural label passthrough', () => {
  it('flat enum: localizes heading, filter placeholder and empty state', async () => {
    const wrapper = await mountSuspended(FieldItem, {
      props: {
        name: 'status',
        type: 'string',
        enumValues: manyValues,
        defaultValue: 'value_0',
        labels: zhLabels,
      },
    })
    expect(wrapper.text()).toContain('允许值')
    expect(wrapper.text()).not.toContain('Allowed values')
    expect(wrapper.text()).toContain('默认值')
    expect(wrapper.text()).not.toContain('Default')

    const filter = wrapper.findComponent({ name: 'UInput' })
    expect(filter.props('placeholder')).toBe('筛选值')

    // Filter down to zero matches → localized empty state.
    filter.vm.$emit('update:modelValue', 'zzz-no-match')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('无匹配值')
    expect(wrapper.text()).not.toContain('No matching values')
  })

  it('variant enum: localizes the unnamed-variant fallback tabs', async () => {
    const wrapper = await mountSuspended(FieldItem, {
      props: {
        name: 'bank', type: 'string',
        enumVariants: [
          { values: [{ value: 'a', description: '' }] },
          { values: [{ value: 'b', description: '' }] },
        ],
        labels: zhLabels,
      },
    })
    expect(wrapper.text()).toContain('选项 1')
    expect(wrapper.text()).toContain('选项 2')
    expect(wrapper.text()).not.toContain('Option 1')
  })

  it('recursive children reuse the same labels object', async () => {
    const wrapper = await mountSuspended(FieldItem, {
      props: {
        name: 'customer', type: 'object',
        children: [{
          name: 'kind', type: 'string',
          lifecycle: { status: 'beta' as const },
          enumValues: [{ value: 'person', description: '' }],
        }],
        labels: zhLabels,
      },
    })
    // Child rows render inside the collapsible (unmount-on-hide=false), so
    // their chrome is present without toggling.
    expect(wrapper.text()).toContain('内测')
    expect(wrapper.text()).toContain('允许值')
    expect(wrapper.text()).not.toContain('Beta')
    expect(wrapper.text()).not.toContain('Allowed values')
  })
})

describe('FieldItem → SchemaComposition structural label passthrough', () => {
  it('localizes field-level composition chrome through the shared labels object', async () => {
    const wrapper = await mountSuspended(FieldItem, {
      props: {
        name: 'destination',
        type: 'object',
        composition: {
          kind: 'oneOf' as const,
          discriminator: {
            propertyName: 'kind',
            mapping: [{ value: 'bank', variantId: 'bank' }],
          },
          variants: [{
            id: 'bank',
            label: '银行账户',
            fields: [{ name: 'iban', type: 'string' }],
          }],
        },
        labels: zhLabels,
      },
    })

    expect(wrapper.text()).toContain('其中一个')
    expect(wrapper.text()).toContain('以下仅一个适用。')
    expect(wrapper.text()).toContain('固定为 bank。')
    expect(wrapper.text()).not.toContain('One of')
    expect(wrapper.text()).not.toContain('Exactly one')
    expect(wrapper.text()).not.toContain('Always')
  })
})

describe('English defaults stay intact', () => {
  it('FieldItem without labels keeps preset + table defaults', async () => {
    const wrapper = await mountSuspended(FieldItem, {
      props: {
        name: 'status', type: 'string',
        lifecycle: { status: 'beta' as const },
        enumVariants: [{ values: [{ value: 'a', description: '' }] }],
      },
    })
    expect(wrapper.text()).toContain('Beta')
    expect(wrapper.text()).toContain('Allowed values')
    expect(wrapper.text()).toContain('Option 1')
  })

  it('EnumTable keeps its own defaults when props are omitted', async () => {
    const wrapper = await mountSuspended(EnumTable, {
      props: { values: manyValues },
    })
    expect(wrapper.text()).toContain('Allowed values')
    expect(wrapper.findComponent({ name: 'UInput' }).props('placeholder')).toBe('Filter values')
  })
})
