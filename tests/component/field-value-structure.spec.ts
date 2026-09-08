// CANDIDATE contract for issue #117 — the disclosure and counting policy for a
// field's VALUE shape (array elements, record members, encoded content).
//
// Scoped to the playground candidate on purpose: these assertions are the
// display contract the issue asks a candidate to establish, and they move with
// the code when it is promoted into `kits/api-docs`. They cover the pure rules
// only — the reading model is settled by a human at `/playground`, not here.
//
// Every case below is one line of the issue's acceptance list; the last one
// exists because the playground caught a real bug: a deep link into a doubly
// encoded payload revealed only the inner boundary, because path collection
// stopped at `children`.
import { describe, expect, it } from 'vitest'
import {
  collectCandidateFieldPaths,
  countValueFields,
  describeValueRequirements,
  fieldValueLabelDefaults,
  foldsIntoParentRegion,
  hasStructureBelow,
  valueScopeLabelKey,
} from '../../playground/model/field-value'
import type { FieldValueNode, ValueBearingField } from '../../playground/model/field-value'

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

  it('folds a JSON-encoded array into ONE region, and nothing else', () => {
    // The decode boundary and the element boundary share a region: "show JSON
    // structure" already promises what is inside.
    expect(foldsIntoParentRegion(jsonObjectArray, objectItem)).toBe(true)
    // A nested array keeps two regions — folding would stack two identical
    // headings in one panel with nothing to tell them apart.
    expect(foldsIntoParentRegion({ relation: 'item', type: 'object[]' }, objectItem)).toBe(false)
    // A decode boundary that carries properties of its own is already the
    // region's subject; the element below it is a second boundary.
    expect(foldsIntoParentRegion(
      { relation: 'decoded', type: 'object', fields: [{ name: 'a', type: 'string' }] },
      objectItem,
    )).toBe(false)
  })
})

describe('disclosure wording', () => {
  // Settled at /playground against the consumer's real endpoint, where 11
  // structured fields are `string` + `json_string`: a per-boundary verb landed
  // on nearly every row and repeated what `format` and the VALUE FORMAT fact
  // already said. One verb, reused from FieldItem, is the accepted reading — so
  // this model must not grow verb strings of its own again.
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

describe('counting', () => {
  it('counts real properties, never value roots', () => {
    // Two properties behind the fold — the decode and element levels above them
    // are not parameters and must not inflate the number.
    expect(countValueFields(jsonObjectArray)).toBe(2)
    expect(countValueFields(primitiveItem)).toBe(0)
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

  it('says nothing when there is nothing to say', () => {
    expect(describeValueRequirements({ relation: 'item', type: 'object' }, fieldValueLabelDefaults)).toBeNull()
  })
})

describe('anchor collection', () => {
  it('reaches properties behind every value boundary, however deep', () => {
    // envelope(string) → JSON object → payload(string) → JSON object → status
    const fields: ValueBearingField[] = [{
      path: 'envelope',
      name: 'envelope',
      type: 'string',
      value: {
        relation: 'decoded',
        path: 'envelope_json',
        type: 'object',
        fields: [{
          path: 'envelope_payload',
          name: 'payload',
          type: 'string',
          value: {
            relation: 'decoded',
            type: 'object',
            fields: [{ path: 'envelope_payload_status', name: 'status', type: 'string' }],
          },
        }],
      },
    }]

    // Without the innermost path in this set, the OUTER region never learns the
    // active anchor is below it and a deep link lands on a collapsed row.
    expect(collectCandidateFieldPaths(fields)).toEqual([
      'envelope',
      'envelope_json',
      'envelope_payload',
      'envelope_payload_status',
    ])
  })

  it('reaches fields inside a composition at a value root', () => {
    const fields: ValueBearingField[] = [{
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

    expect(collectCandidateFieldPaths(fields)).toEqual(['destinations', 'iban', 'walletId'])
  })
})
