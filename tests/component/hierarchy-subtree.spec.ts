// Contract for the hierarchy grammar settled in issue #152
// (references/kits/api-docs/index.md «折叠与层级语法»): a structural line only
// marks a SUBTREE, every subtree draws it from the one shared foundation
// utility, and headings, fact lists and semantic rules never draw one.
//
// happy-dom has no container queries, so what `subtree` resolves to (1px
// neutral line, container-driven indent) is pinned by the built-CSS markers in
// scripts/check-root-css.mjs and the consumer smoke. What THIS file locks is
// the DOM contract: which elements ask for the utility, that nothing else
// hand-writes a line, and that both usage contexts declare the container the
// utility's query resolves against.
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import FieldItem from '../../kits/api-docs/components/FieldItem.vue'
import SchemaComposition from '../../kits/api-docs/components/SchemaComposition.vue'
import type { CompositionNode, FieldNode } from '../../kits/api-docs/utils/field'

const SUBTREE = 'subtree'
const CONTAINER = '@container/field'

/** A structural line drawn by hand: the 1px neutral `border-s` (with or
 *  without the container-query indent) that the subtree containers carried
 *  before the shared utility existed. `border-s-2` (a semantic rule) and a
 *  bare `ps-*` (card alignment, rule indent) are deliberately NOT lines. */
function handWrittenLine(el: Element) {
  return [...el.classList].filter(c => c === 'border-s' || /^@sm\/field:ps-\d+$/.test(c))
}

/** Every element from `el` up to (excluding) `root` that carries a start border class. */
function startBorders(el: Element, root: Element) {
  const out: string[] = []
  for (let node: Element | null = el; node && node !== root; node = node.parentElement) {
    const line = [...node.classList].filter(c => c === SUBTREE || /^border-s(-\d+)?$/.test(c))
    if (line.length) out.push(line.join(' '))
  }
  return out
}

function expectSubtree(el: Element | null | undefined, label: string) {
  expect(el, label).toBeTruthy()
  expect([...el!.classList], `${label} uses the shared utility`).toContain(SUBTREE)
  // The utility owns the line AND the indent; a container must not add either.
  expect([...el!.classList].filter(c => handWrittenLine(el!).includes(c) || /^ps-\d+$/.test(c)), `${label} draws no line or indent of its own`).toEqual([])
}

const nestedAllOf: CompositionNode = {
  kind: 'allOf',
  variants: [{ id: 'base', label: 'Base', fields: [{ path: 'base_id', name: 'id', type: 'string' }] }],
}

const oneOf: CompositionNode = {
  kind: 'oneOf',
  variants: [
    { id: 'card', label: 'Card', fields: [{ path: 'card_brand', name: 'brand', type: 'string' }], composition: nestedAllOf },
    { id: 'wallet', label: 'Wallet', fields: [{ path: 'wallet_provider', name: 'provider', type: 'string' }] },
  ],
}

const anyOf: CompositionNode = {
  kind: 'anyOf',
  variants: [{
    id: 'email',
    label: 'Email',
    fields: [{
      path: 'email_address', name: 'address', type: 'object',
      children: [{ path: 'email_address_domain', name: 'domain', type: 'string' }],
    }],
    composition: nestedAllOf,
  }],
}

const allOf: CompositionNode = {
  kind: 'allOf',
  variants: [{ id: 'audit', label: 'Audit', fields: [{ path: 'audit_at', name: 'at', type: 'string' }], composition: nestedAllOf }],
}

/** Roots of compositions nested inside a variant: every composition root
 *  below the outermost one (the recursion resolves the globally registered
 *  component, which VTU cannot match by import, so this reads the DOM). */
function nestedRoots(wrapper: VueWrapper) {
  const roots = [...wrapper.element.querySelectorAll('[data-schema-composition]')]
  const outer = roots.find(root => !root.parentElement?.closest('[data-schema-composition]'))
  return roots.filter(root => root !== outer)
}

describe('hierarchy grammar — subtree containers', () => {
  it('draws every subtree under a field row from the shared utility', async () => {
    const field: FieldNode = {
      path: 'order', name: 'order', type: 'object',
      children: [{ path: 'order_id', name: 'id', type: 'string' }],
      composition: oneOf,
    }
    const wrapper = await mountSuspended(FieldItem, { props: field })
    // The row is the container the utility's query resolves against.
    expect(wrapper.element.classList).toContain(CONTAINER)
    // Child fields.
    expectSubtree(wrapper.get('#order_id').element.parentElement, 'child field region')
    // Field-level composition.
    expectSubtree(wrapper.element.querySelector('[data-schema-composition]')?.parentElement, 'field-level composition region')
    // A composition nested inside a variant of that composition.
    const nested = nestedRoots(wrapper)
    expect(nested).toHaveLength(1)
    expectSubtree(nested[0], 'nested composition inside a field')
  })

  it('draws the value region from the same utility, and its fact lists draw nothing', async () => {
    const field: FieldNode = {
      path: 'items', name: 'items', type: 'array',
      value: {
        relation: 'item', type: 'object', path: 'items_item',
        // Heading form on purpose: a notation AND a condition rule AND a
        // labelled constraint — everything a block can carry.
        presence: { nullable: true, condition: 'Retired items stay `null`.' },
        notes: [{ label: 'Uniqueness', text: 'sku is unique.' }, { kind: 'caveat', text: 'Legacy rows omit sku.' }],
        fields: [{ path: 'items_sku', name: 'sku', type: 'string' }],
      },
    }
    const wrapper = await mountSuspended(FieldItem, { props: field })
    const region = wrapper.get('[data-value-structure-region]').element
    expectSubtree(region, 'value region')

    const block = wrapper.get('[data-value-requirements]')
    // Nothing between the region and a fact draws a neutral line: no subtree
    // class, no hand-written `border-s`, inside the block at all.
    for (const el of [block.element, ...block.element.querySelectorAll('*')]) {
      expect([...el.classList], 'facts list draws no structural line').not.toContain(SUBTREE)
      expect([...el.classList], 'facts list draws no structural line').not.toContain('border-s')
    }
    // From the presence rule up to the row: the subtree line and the 2px
    // semantic rule — two start borders, never a third.
    const rule = block.get('[data-value-presence-condition]').element
    expect(startBorders(rule, wrapper.element)).toEqual(['border-s-2', SUBTREE])
    const caveat = block.get('[data-value-caveat]').element
    expect(startBorders(caveat, wrapper.element)).toEqual(['border-s-2', SUBTREE])
  })

  it('keeps the same rule set at page level: variants declare the container, nested compositions are subtrees, cards are not', async () => {
    for (const node of [oneOf, anyOf, allOf]) {
      const wrapper = await mountSuspended(SchemaComposition, { props: node })
      // The root itself is not a subtree of anything here.
      expect(wrapper.element.classList).not.toContain(SUBTREE)
      const nested = nestedRoots(wrapper)
      expect(nested, `${node.kind} nests one composition`).toHaveLength(1)
      expectSubtree(nested[0], `${node.kind} nested composition`)
      // The variant content container is a `field` container, so the query in
      // the utility resolves without a FieldItem row above it.
      const panel = nested[0]!.parentElement!
      expect([...panel.classList], `${node.kind} variant content declares the container`).toContain(CONTAINER)
      expect(handWrittenLine(panel), `${node.kind} variant content draws no line`).toEqual([])
    }
  })

  it('does not repeat the anyOf card boundary as a line, but lines the real subtrees inside the card', async () => {
    const wrapper = await mountSuspended(SchemaComposition, { props: anyOf })
    const card = wrapper.get('.rounded-lg').element
    expect([...card.classList]).not.toContain(SUBTREE)
    expect(handWrittenLine(card)).toEqual([])
    // Card interior: a child-field region under a variant field row, and the
    // nested composition, both keep the subtree line.
    expectSubtree(wrapper.get('#email_address_domain').element.parentElement, 'child region inside a card')
    expectSubtree(nestedRoots(wrapper)[0], 'nested composition inside a card')
  })

  it('leaves no hand-written structural line anywhere in the field tree or a composition', async () => {
    const field: FieldNode = {
      path: 'root', name: 'root', type: 'object',
      children: [{ path: 'root_a', name: 'a', type: 'string' }],
      composition: anyOf,
    }
    for (const [component, props] of [[FieldItem, field], [SchemaComposition, oneOf], [SchemaComposition, allOf]] as const) {
      const wrapper = await mountSuspended(component as typeof FieldItem, { props: props as FieldNode })
      const offenders = [...wrapper.element.querySelectorAll('*')]
        .filter(el => !el.classList.contains(SUBTREE))
        .map(el => handWrittenLine(el))
        .filter(line => line.length)
      expect(offenders).toEqual([])
    }
  })
})
