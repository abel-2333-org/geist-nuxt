// Nested chrome localization contract (issue #29): a bilingual consumer must
// be able to remove every English chrome string through public props — no
// preset swap, no type cast, no component fork, no CSS hiding.
// Covers: operation-level beta + label injection (OperationHeader /
// LifecycleNotice), FieldItem lifecycle badge labels + condition rule lead-in,
// full EnumTable structural-label passthrough (flat + variant + filter empty
// state), recursive child rows, and unchanged English defaults. Layout-only
// FieldItem assertions live in field-item-structure.spec.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import CopyButton from '../../foundation/components/CopyButton.vue'
import FieldItem from '../../kits/api-docs/components/FieldItem.vue'
import EnumTable from '../../kits/api-docs/components/EnumTable.vue'
import OperationHeader from '../../kits/api-docs/components/OperationHeader.vue'
import LifecycleNotice from '../../kits/api-docs/components/LifecycleNotice.vue'
import { useCopy } from '../../foundation/composables/useCopy'

const copyState = vi.hoisted(() => ({
  add: vi.fn(),
  writeText: vi.fn(),
  execCommand: vi.fn(),
}))

mockNuxtImport('useToast', () => () => ({ add: copyState.add }))

let stopCopyScope: (() => void) | undefined

function createCopy(options: Parameters<typeof useCopy>[0] = {}) {
  const scope = effectScope()
  stopCopyScope = () => scope.stop()
  return scope.run(() => useCopy(options))!
}

beforeEach(() => {
  copyState.add.mockClear()
  copyState.writeText.mockReset()
  copyState.writeText.mockResolvedValue(undefined)
  copyState.execCommand.mockReset()
  copyState.execCommand.mockReturnValue(true)
  Object.defineProperty(globalThis.navigator, 'clipboard', {
    configurable: true,
    value: { writeText: copyState.writeText },
  })
  Object.defineProperty(globalThis.document, 'execCommand', {
    configurable: true,
    value: copyState.execCommand,
  })
})

afterEach(() => stopCopyScope?.())

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

describe('useCopy complete-message contract', () => {
  it('uses the complete generic success message without composing a label', async () => {
    const { copy } = createCopy()

    await copy('value')

    expect(copyState.add).toHaveBeenCalledWith({
      title: 'Copied to clipboard',
      color: 'success',
      icon: 'i-lucide-check',
    })
  })

  it('passes a complete call-level success message through verbatim', async () => {
    const { copy } = createCopy()

    const copied = await copy('value', { successMessage: '接口地址已复制' })

    expect(copied).toBe(true)
    expect(copyState.add).toHaveBeenCalledWith({
      title: '接口地址已复制',
      color: 'success',
      icon: 'i-lucide-check',
    })
  })

  it('uses the complete composable-level success message as the fallback', async () => {
    const { copy } = createCopy({ successMessage: 'Fallback copied' })

    await copy('value')

    expect(copyState.add).toHaveBeenCalledWith({
      title: 'Fallback copied',
      color: 'success',
      icon: 'i-lucide-check',
    })
  })

  it('uses the legacy result after Clipboard API rejects', async () => {
    copyState.writeText.mockRejectedValue(new Error('blocked'))
    const { copy } = createCopy()

    const copied = await copy('value')

    expect(copied).toBe(true)
    expect(copyState.execCommand).toHaveBeenCalledWith('copy')
  })

  it('uses the complete failure message when every clipboard writer fails', async () => {
    copyState.writeText.mockRejectedValue(new Error('blocked'))
    copyState.execCommand.mockReturnValue(false)
    const { copy } = createCopy({
      failureMessage: '复制失败，请手动复制地址',
    })

    const copied = await copy('value')

    expect(copied).toBe(false)
    expect(copyState.add).toHaveBeenCalledWith({
      title: '复制失败，请手动复制地址',
      color: 'error',
      icon: 'i-lucide-triangle-alert',
    })
  })

  it('lets CopyButton reuse copiedLabel as its complete success message', async () => {
    const wrapper = await mountSuspended(CopyButton, {
      props: {
        value: 'value',
        copiedLabel: '值已复制',
      },
    })

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(copyState.add).toHaveBeenCalledWith({
      title: '值已复制',
      color: 'success',
      icon: 'i-lucide-check',
    })
  })
})

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

  it.each(['beta', 'deprecated'] as const)(
    'renders a %s description-only lifecycle as prose instead of an orphan definition',
    async (status) => {
      const wrapper = await mountSuspended(FieldItem, {
        props: {
          name: 'legacyMode',
          type: 'string',
          lifecycle: { status, description: 'Use `mode` instead.' },
        },
      })

      const detail = wrapper.get('[data-field-lifecycle-detail]')
      expect(detail.element.tagName).toBe('P')
      expect(detail.text()).toContain('Use')
      expect(detail.text()).toContain('instead.')
      expect(wrapper.find('dl').exists()).toBe(false)
    },
  )

  it('renders lifecycle since metadata as a complete term-definition pair', async () => {
    const wrapper = await mountSuspended(FieldItem, {
      props: {
        name: 'channel',
        type: 'string',
        lifecycle: { status: 'beta', since: 'v2.4', description: 'Shape may change.' },
      },
    })

    const detail = wrapper.get('[data-field-lifecycle-detail]')
    expect(detail.element.tagName).toBe('DL')
    expect(detail.get('dt').text()).toBe('Since')
    expect(detail.get('dd').text()).toContain('v2.4')
  })

})

describe('FieldItem requiredness derivation', () => {
  it('marks a condition-only field conditional and leaves the rule unlabelled', async () => {
    const wrapper = await mountSuspended(FieldItem, {
      props: {
        name: 'teamId',
        type: 'string',
        condition: 'Required when the token is scoped to a team.',
      },
    })

    // The word is derived into the summary row, so the rule below carries the
    // sentence alone — one occurrence, guaranteed by the derivation.
    expect(wrapper.find('[data-field-requiredness]').text()).toBe('Conditional')
    const rule = wrapper.get('[data-field-condition]')
    expect(rule.text()).toBe('Required when the token is scoped to a team.')
  })

  it('localizes the derived marker through the shared conditional key', async () => {
    const wrapper = await mountSuspended(FieldItem, {
      props: {
        name: 'teamId',
        type: 'string',
        condition: '仅团队作用域下必填。',
        labels: { conditional: '条件必填' },
      },
    })

    expect(wrapper.find('[data-field-requiredness]').text()).toBe('条件必填')
    expect(wrapper.text()).not.toContain('Conditional')
  })

  it('lets an explicit hard requirement win while still rendering the condition', async () => {
    const wrapper = await mountSuspended(FieldItem, {
      props: {
        name: 'teamId',
        type: 'string',
        required: true,
        condition: 'Required when the token is scoped to a team.',
      },
    })

    expect(wrapper.find('[data-field-requiredness]').text()).toBe('Required')
    expect(wrapper.get('[data-field-condition]').text()).toContain('scoped to a team')
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
