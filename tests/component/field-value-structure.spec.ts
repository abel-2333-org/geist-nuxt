// Contract for a field's VALUE shape (array elements, record members, encoded
// content) — the disclosure, counting and labelling policy settled in issue
// #117, now owned by the api-docs kit.
//
// The pure rules live in `utils/field.ts` and are asserted without a DOM; the
// mounted cases below pin what the row itself promises: the identity-line
// token, that value properties are never counted as children, and that a deep
// link into a doubly encoded payload reveals BOTH regions (the bug the
// playground caught when value paths were collected beside, not inside,
// `collectFieldPaths`).
import { defineComponent, nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import FieldItem from '../../kits/api-docs/components/FieldItem.vue'
import { useFieldAnchor } from '../../kits/api-docs/composables/useFieldAnchor'
import {
  collectFieldPaths,
  collectValueRegion,
  describeValueCodec,
  describeValueRequirements,
  fieldValueLabelDefaults,
  foldsIntoParentRegion,
  hasStructureBelow,
  valueScopeLabelKey,
} from '../../kits/api-docs/utils/field'
import type { FieldNode, FieldValueNode } from '../../kits/api-docs/utils/field'

const primitiveItem: FieldValueNode = {
  relation: 'item',
  type: 'string',
  notes: [{ text: 'At least 1 character.' }],
}

const objectItem: FieldValueNode = {
  relation: 'item',
  type: 'object',
  notes: [{ text: 'sku is unique across items.' }],
  fields: [{ path: 'sku', name: 'sku', type: 'string' }, { path: 'qty', name: 'qty', type: 'integer' }],
}

const jsonObjectArray: FieldValueNode = {
  relation: 'decoded',
  codec: 'json',
  type: 'object[]',
  notes: [{ text: 'At least 1 element.' }],
  value: objectItem,
}

describe('value disclosure policy', () => {
  it('leaves a primitive array flat — no fold around one sentence', () => {
    expect(hasStructureBelow(primitiveItem)).toBe(false)
  })

  it('opens a fold as soon as real properties live below', () => {
    expect(hasStructureBelow(objectItem)).toBe(true)
    // Reached through a level that has no properties of its own.
    expect(hasStructureBelow({ relation: 'item', type: 'object[]', value: objectItem })).toBe(true)
  })

  it('folds compatible boundaries and separates structural or repeated requirement scopes', () => {
    // The decode boundary and the element boundary share a region: "show me
    // what is inside" already promises the array.
    expect(foldsIntoParentRegion(jsonObjectArray, objectItem)).toBe(true)
    // A silent outer array can fold; two levels with item rules cannot.
    expect(foldsIntoParentRegion({ relation: 'item', type: 'object[]' }, objectItem)).toBe(true)
    expect(foldsIntoParentRegion({ relation: 'item', type: 'object[]', notes: [{ text: 'At least one.' }] }, objectItem)).toBe(false)
    // A decode boundary that carries properties of its own is already the
    // region's subject; the element below it is a second boundary.
    expect(foldsIntoParentRegion(
      { relation: 'decoded', type: 'object', fields: [{ name: 'a', type: 'string' }] },
      objectItem,
    )).toBe(false)
  })
})

describe('value region and codec helpers', () => {
  it('stops before a scope already represented anywhere in the region', () => {
    const inner: FieldValueNode = { ...objectItem }
    const middle: FieldValueNode = { relation: 'item', type: 'object[]', value: inner }
    const outer: FieldValueNode = { relation: 'item', type: 'object[][]', notes: [{ text: 'At least one row.' }], value: middle }
    expect(collectValueRegion(outer)).toEqual([outer, middle])
    expect(foldsIntoParentRegion(middle, inner, [outer, middle])).toBe(false)
  })

  it('reports consecutive codec coverage in decode order and stops at an item', () => {
    const item: FieldValueNode = { relation: 'item', type: 'string', value: { relation: 'decoded', codec: 'json', type: 'number' } }
    const json: FieldValueNode = { relation: 'decoded', codec: 'json', type: 'string[]', value: item }
    const base64: FieldValueNode = { relation: 'decoded', codec: 'base64', type: 'string', value: json }
    expect(describeValueCodec(base64)).toEqual({ token: 'base64<json<string[]>>', nodes: [base64, json] })
    expect(describeValueCodec(item)).toBeNull()
  })

  it('preserves codecs without inventing an omitted decoded type', () => {
    const json: FieldValueNode = { relation: 'decoded', codec: 'json' }
    const base64: FieldValueNode = { relation: 'decoded', codec: 'base64', type: 'string', value: json }
    expect(describeValueCodec(base64)).toEqual({ token: 'base64<json>', nodes: [base64, json] })
    expect(describeValueCodec({ relation: 'decoded', type: 'object' })).toBeNull()
  })
})

describe('disclosure wording', () => {
  // Settled against the consumer's real endpoint, where 11 structured fields
  // are `string` + `json_string`: a per-boundary verb landed on nearly every
  // row and discriminated nothing. One verb, reused from FieldItem, is the
  // accepted reading — so this model must not grow verb strings of its own.
  it('contributes no disclosure verbs to the label contract', () => {
    const keys = Object.keys(fieldValueLabelDefaults)
    expect(keys.filter(k => /^(show|hide)/i.test(k))).toEqual([])
  })

  it('keeps every label it does own scoped to requirements, not actions', () => {
    for (const value of Object.values(fieldValueLabelDefaults)) {
      expect(value).not.toMatch(/^(Show|Hide) /)
    }
  })
})

describe('scope labels', () => {
  // Withdrawn after review against the consumer's real endpoint: an auto
  // heading over the FIELD's own constraints has to guess their subject, and it
  // guessed wrong — `retailers`' rules are about marketplace semantics, not
  // about the string carrying them. Those constraints stay in the field's band
  // under the author's own labels; only the VALUE's levels get scope headings.
  it('offers no scope heading for the owner field\'s own constraints', () => {
    const keys = Object.keys(fieldValueLabelDefaults)
    expect(keys).not.toContain('arrayRequirements')
    expect(keys).not.toContain('stringRequirements')
    expect(keys).not.toContain('recordRequirements')
  })

  // The identity line prints `json<object[]>`; a scope label that also leads
  // with the codec says the same word twice, 30px apart.
  it('names the scope without repeating the codec', () => {
    expect(fieldValueLabelDefaults.decodedRequirements).not.toMatch(/json/i)
    expect(fieldValueLabelDefaults.decodedArrayRequirements).not.toMatch(/json/i)
  })

  it('gives each scope ONE name, whatever the layout does with it', () => {
    // The label answers "what are these rules about", which cannot depend on
    // whether the block happened to land inline or behind a disclosure.
    expect(valueScopeLabelKey(primitiveItem)).toBe('eachItem')
    expect(valueScopeLabelKey({ relation: 'member' })).toBe('eachMember')
    // A decoded ARRAY root keeps its own name, so its length rule never reads
    // as a rule about one element.
    expect(valueScopeLabelKey(jsonObjectArray)).toBe('decodedArrayRequirements')
    expect(valueScopeLabelKey({ relation: 'decoded', type: 'integer' })).toBe('decodedRequirements')
  })

  it('keeps scope labels in the register of the category labels beside them', () => {
    // They share one information column with author labels like MAX LENGTH, so
    // a wordier scope label wraps to two lines next to one-line neighbours.
    for (const key of ['eachItem', 'eachMember', 'decodedRequirements', 'decodedArrayRequirements'] as const) {
      expect(fieldValueLabelDefaults[key]).not.toMatch(/requirements/i)
    }
  })
})

describe('requirement density', () => {
  it('renders one lone constraint as a single scope-labelled row', () => {
    const block = describeValueRequirements(primitiveItem, fieldValueLabelDefaults)
    expect(block?.compact).toBe(true)
    expect(block?.label).toBe('Each item')
  })

  it('escalates as soon as the level says more than one thing', () => {
    const block = describeValueRequirements(
      { ...primitiveItem, examples: ['abc'] },
      fieldValueLabelDefaults,
    )
    expect(block?.compact).toBe(false)
  })

  it('never drops the author\'s own category label on a lone constraint', () => {
    // A labelled constraint says two things (category + rule); the compact row
    // has one slot, and that slot is the scope. So it escalates instead.
    const block = describeValueRequirements(
      { relation: 'item', type: 'object', notes: [{ label: 'Uniqueness', text: 'sku is unique.' }] },
      fieldValueLabelDefaults,
    )
    expect(block?.compact).toBe(false)
  })

  it('says nothing when there is nothing to say', () => {
    expect(describeValueRequirements({ relation: 'item', type: 'object' }, fieldValueLabelDefaults)).toBeNull()
  })
})

// envelope(string) → JSON object → payload(string) → JSON object → status
const doublyEncoded: FieldNode = {
  path: 'envelope',
  name: 'envelope',
  type: 'string',
  format: 'json_string',
  value: {
    relation: 'decoded',
    codec: 'json',
    path: 'envelope_json',
    type: 'object',
    fields: [{
      path: 'envelope_payload',
      name: 'payload',
      type: 'string',
      format: 'json_string',
      value: {
        relation: 'decoded',
        codec: 'json',
        type: 'object',
        fields: [{ path: 'envelope_payload_status', name: 'status', type: 'string' }],
      },
    }],
  },
}

describe('anchor collection', () => {
  it('reaches properties behind every value boundary, however deep', () => {
    // Without the innermost path in this set, the OUTER region never learns the
    // active anchor is below it and a deep link lands on a collapsed row. This
    // is why the value branch lives inside `collectFieldPaths` itself.
    expect(collectFieldPaths([doublyEncoded])).toEqual([
      'envelope',
      'envelope_json',
      'envelope_payload',
      'envelope_payload_status',
    ])
  })

  it('reaches fields inside a composition at a value root', () => {
    const fields: FieldNode[] = [{
      path: 'destinations',
      name: 'destinations',
      type: 'object[]',
      value: {
        relation: 'item',
        type: 'object',
        composition: {
          kind: 'oneOf',
          variants: [
            { id: 'bank', label: 'Bank', fields: [{ path: 'iban', name: 'iban', type: 'string' }] },
            { id: 'wallet', label: 'Wallet', fields: [{ path: 'walletId', name: 'walletId', type: 'string' }] },
          ],
        },
      },
    }]

    expect(collectFieldPaths(fields)).toEqual(['destinations', 'iban', 'walletId'])
  })
})

describe('recursive encoding boundaries', () => {
  // The shape matrix missed both of these: its only double-encoding case put a
  // NAMED FIELD between the boundaries, and a named field has an identity line
  // of its own to carry a token. Without one, the inner codec had nowhere to go
  // and the reader was never told the decoded result still needs parsing.

  it('composes every consecutive codec onto the identity line', async () => {
    const field: FieldNode = {
      name: 'token',
      type: 'string',
      value: {
        relation: 'decoded', codec: 'base64', type: 'string',
        value: {
          relation: 'decoded', codec: 'json', type: 'object',
          fields: [{ path: 'amount', name: 'amount', type: 'integer' }],
        },
      },
    }
    const w = await mountSuspended(FieldItem, { props: field })
    // base64-decode, then JSON.parse, then you hold an object — in that order.
    expect(w.text()).toContain('base64<json<object>>')
  })

  it('spells a codec the identity line cannot reach', async () => {
    // `string[]` whose every ELEMENT is a JSON string: the codec applies per
    // element, so it cannot ride the field's own identity line.
    const field: FieldNode = {
      name: 'receipts',
      type: 'string[]',
      value: {
        relation: 'item', type: 'string',
        value: {
          relation: 'decoded', codec: 'json', type: 'object',
          fields: [{ path: 'receiptId', name: 'receiptId', type: 'string' }],
        },
      },
    }
    const w = await mountSuspended(FieldItem, { props: field })
    expect(w.find('[data-boundary-codec]').text()).toBe('json<object>')
  })

  it('never repeats a codec the identity line already composed', async () => {
    const field: FieldNode = {
      name: 'token',
      type: 'string',
      value: {
        relation: 'decoded', codec: 'base64', type: 'string',
        value: {
          relation: 'decoded', codec: 'json', type: 'object',
          fields: [{ path: 'amount', name: 'amount', type: 'integer' }],
        },
      },
    }
    const w = await mountSuspended(FieldItem, { props: field })
    expect(w.findAll('[data-boundary-codec]')).toHaveLength(0)
  })

  it.each([
    [{ relation: 'decoded', codec: 'json' }, 'json'],
    [{ relation: 'decoded', codec: 'base64', type: 'string', value: { relation: 'decoded', codec: 'json' } }, 'base64<json>'],
  ] satisfies [FieldValueNode, string][])('renders supplied codecs with optional decoded types', async (value, token) => {
    const wrapper = await mountSuspended(FieldItem, { props: { name: 'payload', type: 'string', value } })
    expect(wrapper.get('[data-field-identity]').findAll('[translate="no"]').map(node => node.text()))
      .toEqual(['payload', 'string', token])
    expect(wrapper.find('[data-boundary-codec]').exists()).toBe(false)
  })

  it('prints inline codecs beyond an item without creating an empty disclosure', async () => {
    const wrapper = await mountSuspended(FieldItem, {
      props: {
        name: 'values', type: 'string[]',
        value: { relation: 'item', type: 'string', value: { relation: 'decoded', codec: 'json', type: 'number' } },
      },
    })
    expect(wrapper.get('[data-boundary-codec]').text()).toBe('json<number>')
    expect(wrapper.find('[data-value-structure-toggle]').exists()).toBe(false)
  })

  it('retains every codec when requirements split the chain across regions', async () => {
    const wrapper = await mountSuspended(FieldItem, {
      props: {
        name: 'payloads', type: 'string[]',
        value: {
          relation: 'item', type: 'string',
          value: {
            relation: 'decoded', codec: 'base64', type: 'string', notes: [{ text: 'Valid UTF-8.' }],
            value: {
              relation: 'decoded', codec: 'json', type: 'object', notes: [{ text: 'An object is required.' }],
              fields: [{ name: 'id', type: 'string' }],
            },
          },
        },
      },
    })
    expect(wrapper.findAll('[data-value-structure-toggle]')).toHaveLength(2)
    expect(wrapper.findAll('[data-boundary-codec]').map(node => node.text())).toEqual(['base64<json<object>>'])
  })

  it('keeps equal scopes separated even with a silent level between them', async () => {
    const wrapper = await mountSuspended(FieldItem, {
      props: {
        name: 'cube', type: 'object[][][]',
        value: {
          relation: 'item', type: 'object[][]', notes: [{ text: 'At least two rows.' }],
          value: {
            relation: 'item', type: 'object[]',
            value: {
              relation: 'item', type: 'object', notes: [{ text: 'A nonempty cell.' }],
              fields: [{ name: 'id', type: 'string' }],
            },
          },
        },
      },
    })
    const scopes = wrapper.findAll('[data-value-requirements]')
    expect(scopes).toHaveLength(2)
    expect(scopes[0]!.element.closest('[data-value-structure-region]'))
      .not.toBe(scopes[1]!.element.closest('[data-value-structure-region]'))
  })

  it('retains repeated equal tokens at different item boundaries on update', async () => {
    const value: FieldValueNode = {
      relation: 'item', type: 'string',
      value: {
        relation: 'decoded', codec: 'json', type: 'string[]',
        value: {
          relation: 'item', type: 'string',
          value: {
            relation: 'decoded', codec: 'json', type: 'string[]',
            value: { relation: 'item', type: 'string' },
          },
        },
      },
    }
    const wrapper = await mountSuspended(FieldItem, { props: { name: 'layers', type: 'string[]', value } })
    expect(wrapper.findAll('[data-boundary-codec]').map(node => node.text())).toEqual(['json<string[]>', 'json<string[]>'])
    await wrapper.setProps({ value: { ...value, value: value.value!.value } })
    expect(wrapper.findAll('[data-boundary-codec]').map(node => node.text())).toEqual(['json<string[]>'])
  })

  it('spends one disclosure on a chain with nothing to inspect between levels', async () => {
    const field: FieldNode = {
      name: 'token',
      type: 'string',
      value: {
        relation: 'decoded', codec: 'base64', type: 'string',
        value: {
          relation: 'decoded', codec: 'json', type: 'object',
          fields: [{ path: 'amount', name: 'amount', type: 'integer' }],
        },
      },
    }
    const w = await mountSuspended(FieldItem, { props: field })
    const verbs = w.findAll('button').filter(b => /Child Parameters/.test(b.text()))
    expect(verbs).toHaveLength(1)
    // and the one disclosure counts the real fields it reveals
    expect(verbs[0]!.text()).toContain('(1)')
  })

  it('keeps two same-named scopes out of one panel', async () => {
    // `object[][]` with rules at BOTH element levels: folding would stack two
    // identical `Each item` headings, the ambiguity the `[]` row created.
    const field: FieldNode = {
      name: 'matrix',
      type: 'object[][]',
      value: {
        relation: 'item', type: 'object[]',
        notes: [{ text: 'Each row holds 1 to 20 cells.' }],
        value: {
          relation: 'item', type: 'object',
          notes: [{ text: 'Every cell carries a value.' }],
          fields: [{ path: 'cell', name: 'value', type: 'number' }],
        },
      },
    }
    const w = await mountSuspended(FieldItem, { props: field })
    expect(w.findAll('button').filter(b => /Child Parameters/.test(b.text())).length)
      .toBeGreaterThan(1)
  })
})

describe('FieldItem with a value shape', () => {
  it.each([
    ['inline', { ...primitiveItem, path: 'inline-root' }],
    ['identity-only', { relation: 'decoded', codec: 'json', type: 'object', path: 'identity-root' }],
    ['folded', {
      ...jsonObjectArray,
      path: 'decoded-root',
      value: { ...objectItem, path: 'item-root' },
    }],
    ['folded without requirements', {
      relation: 'decoded', codec: 'json', type: 'object[]', path: 'decoded-root',
      value: { ...objectItem, notes: undefined, path: 'item-root' },
    }],
    ['three folded identity levels', {
      relation: 'decoded', codec: 'base64', type: 'string', path: 'outer-root',
      value: {
        relation: 'decoded', codec: 'json', type: 'object[]', path: 'middle-root',
        value: { ...objectItem, notes: undefined, path: 'last-root' },
      },
    }],
    ['inline chain', {
      relation: 'item', type: 'string', path: 'outer-root',
      value: { ...primitiveItem, path: 'inner-root' },
    }],
  ] satisfies [string, FieldValueNode][])('preserves every %s value anchor with its own arrival cue and focus target', async (_, value) => {
    let anchor!: ReturnType<typeof useFieldAnchor>
    const field: FieldNode = { name: 'payload', type: 'string', value }
    const Host = defineComponent({
      components: { FieldItem },
      setup() {
        anchor = useFieldAnchor()
        anchor.active.value = ''
        return { field }
      },
      template: '<FieldItem v-bind="field" />',
    })
    const wrapper = await mountSuspended(Host, { attachTo: document.body })
    try {
      for (const path of collectFieldPaths([field]).filter(path => path.endsWith('-root'))) {
        anchor.active.value = path
        await nextTick()
        await nextTick()
        const targets = wrapper.findAll('[id]').filter(node => node.attributes('id') === path)
        expect(targets, `DOM anchor for ${path}`).toHaveLength(1)
        const target = targets[0]!
        expect(target.element.firstElementChild?.hasAttribute('data-field-arrival-cue')).toBe(true)
        const element = target.element as HTMLElement
        element.tabIndex = -1
        element.focus()
        expect(document.activeElement).toBe(element)
      }
      if (value.path === 'decoded-root') {
        expect(wrapper.get('[data-value-structure-toggle]').attributes('aria-expanded')).toBe('true')
        expect(wrapper.get('#item-root').text()).toContain('sku')
      }
    }
    finally {
      wrapper.unmount()
    }
  })

  it('prints the decoded shape as `codec<shape>` and lets it lead the wire type', async () => {
    const wrapper = await mountSuspended(FieldItem, {
      props: {
        path: 'retailers',
        name: 'retailers',
        type: 'string',
        format: 'json_string',
        value: jsonObjectArray,
      },
    })

    const tokens = wrapper.get('[data-field-identity]').findAll('[translate="no"]')
    expect(tokens.map(node => node.text())).toEqual(['retailers', 'string', 'json<object[]>'])
    // The shape takes the type's own emphasis; `string` steps back.
    expect(tokens[1]!.classes()).toContain('text-dimmed')
    expect(tokens[2]!.classes()).toContain('text-muted')
  })

  it('keeps `format` and today\'s weighting for a field without a decode boundary', async () => {
    const wrapper = await mountSuspended(FieldItem, {
      props: {
        name: 'tags',
        type: 'string[]',
        format: 'csv',
        value: primitiveItem,
      },
    })

    const tokens = wrapper.get('[data-field-identity]').findAll('[translate="no"]')
    expect(tokens.map(node => node.text())).toEqual(['tags', 'string[]', 'csv'])
    expect(tokens[1]!.classes()).toContain('text-muted')
    expect(tokens[2]!.classes()).toContain('text-dimmed')
    // Nothing structural below: the element rule reads inline, no fold.
    expect(wrapper.find('[data-value-structure-toggle]').exists()).toBe(false)
    expect(wrapper.get('[data-value-requirements]').text()).toContain('Each item')
  })

  it('never counts value properties as children, and counts only real properties behind the fold', async () => {
    const wrapper = await mountSuspended(FieldItem, {
      props: {
        path: 'retailers',
        name: 'retailers',
        type: 'string',
        value: jsonObjectArray,
      },
    })

    // No child-parameter disclosure: `sku` / `qty` are value properties, not
    // children of `retailers`.
    const toggles = wrapper.findAll('button').filter(b => /Child Parameters/.test(b.text()))
    expect(toggles).toHaveLength(1)
    const toggle = toggles[0]!
    expect(toggle.attributes('data-value-structure-toggle')).toBeDefined()
    // The verb is FieldItem's own; the count is the two real properties, not
    // the decode + element levels above them.
    expect(toggle.text()).toContain('Show Child Parameters')
    expect(toggle.text()).toContain('(2)')
  })

  it('reveals every region above a deep link into doubly encoded content', async () => {
    // The anchor state is Nuxt `useState`, so it is read from inside a host
    // component rather than from the test body.
    let anchor!: ReturnType<typeof useFieldAnchor>
    const Host = defineComponent({
      components: { FieldItem },
      setup() {
        anchor = useFieldAnchor()
        // The anchor is app-level Nuxt state shared across mounts in this file.
        anchor.active.value = ''
        return { field: doublyEncoded }
      },
      template: '<FieldItem v-bind="field" />',
    })
    const wrapper = await mountSuspended(Host)

    const toggles = () => wrapper.findAll('[data-value-structure-toggle]')
    expect(toggles()).toHaveLength(2)
    for (const toggle of toggles()) expect(toggle.attributes('aria-expanded')).toBe('false')

    anchor.active.value = 'envelope_payload_status'
    await nextTick()
    await nextTick()

    // Both the outer (envelope) and inner (payload) regions open — the outer
    // one only knows because `collectFieldPaths` walks the value chain.
    for (const toggle of toggles()) expect(toggle.attributes('aria-expanded')).toBe('true')
    // The outer value root's own anchor is the region's DOM id.
    expect(wrapper.find('[data-value-structure-region]').attributes('id')).toBe('envelope_json')
  })

  it('reveals the region when the value root itself is the deep-link target, and owns its arrival cue', async () => {
    let anchor!: ReturnType<typeof useFieldAnchor>
    const Host = defineComponent({
      components: { FieldItem },
      setup() {
        anchor = useFieldAnchor()
        // The anchor is app-level Nuxt state shared across mounts in this file.
        anchor.active.value = ''
        return { field: doublyEncoded }
      },
      template: '<FieldItem v-bind="field" />',
    })
    const wrapper = await mountSuspended(Host)

    anchor.active.value = 'envelope_json'
    await nextTick()
    await nextTick()

    const toggles = wrapper.findAll('[data-value-structure-toggle]')
    expect(toggles[0]!.attributes('aria-expanded')).toBe('true')
    // The inner boundary is not on the way to `envelope_json`; it stays shut.
    expect(toggles[1]!.attributes('aria-expanded')).toBe('false')
    // useFieldAnchor flashes the first cue INSIDE the id'd element: the region
    // carries its own, so a nested row's cue is never the one that lights up.
    const region = wrapper.find('#envelope_json')
    expect(region.element.firstElementChild?.getAttribute('data-field-arrival-cue')).toBe('')
  })

  it('renders both the array\'s and the element\'s scope inside one folded region', async () => {
    const wrapper = await mountSuspended(FieldItem, {
      props: { name: 'retailers', type: 'string', value: jsonObjectArray },
    })

    const region = wrapper.get('[data-value-structure-region]')
    const scopes = region.findAll('[data-value-requirements] dt, [data-value-requirements] > p').map(n => n.text())
    // Decode boundary and element boundary share the region but keep their
    // own scope, so "at least 1 element" never reads as a rule about one item.
    expect(scopes).toEqual(['Array', 'Each item'])
    // The region is the only disclosure: nothing is a child of `retailers`.
    expect(wrapper.findAll('[data-value-structure-toggle]')).toHaveLength(1)
    expect(region.findAll('[data-field-identity]').map(n => n.text())).toEqual(['skustring', 'qtyinteger'])
  })

  it('labels a record member with its own scope, and honours label overrides for every scope', async () => {
    const wrapper = await mountSuspended(FieldItem, {
      props: {
        name: 'attributes',
        type: 'object',
        value: {
          relation: 'member',
          type: 'string',
          notes: [{ text: 'Non-empty.' }],
          value: { relation: 'decoded', codec: 'json', type: 'object[]', notes: [{ text: 'At least one.' }] },
        },
        labels: { eachMember: '每个键', decodedArrayRequirements: '数组要求', showChildren: '展开' },
      },
    })

    // No structure below either level: both rules read inline, no chevron.
    expect(wrapper.find('[data-value-structure-toggle]').exists()).toBe(false)
    const scopes = wrapper.findAll('[data-value-requirements] dt').map(n => n.text())
    expect(scopes).toEqual(['每个键', '数组要求'])
  })

  it('adds nothing below the row when the value only states identity facts', async () => {
    const wrapper = await mountSuspended(FieldItem, {
      props: {
        name: 'metaData',
        type: 'string',
        value: { relation: 'decoded', codec: 'json', type: 'object' },
      },
    })

    expect(wrapper.get('[data-field-identity]').text()).toContain('json<object>')
    expect(wrapper.find('[data-value-requirements]').exists()).toBe(false)
    expect(wrapper.find('[data-value-structure-toggle]').exists()).toBe(false)
  })
})
