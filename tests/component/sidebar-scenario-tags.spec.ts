import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import SidebarScenarioTags from '../../kits/api-docs/internal/SidebarScenarioTags.vue'

// The fit loop reads real layout metrics (offsetWidth / clientWidth) that the
// test DOM reports as 0, so stub deterministic geometry: every element is as
// wide as its text (10px per character), and the flex-1 root reports the
// configured available budget. GAP resolves to the 4px fallback (no computed
// columnGap in the test DOM); the assertions below stay correct for GAP 0–4.
const CHAR_W = 10
let availWidth = 0

// Stub on HTMLElement.prototype: the test DOM defines these accessors there,
// so a stub on Element.prototype would be shadowed and never consulted.
const offsetWidthDesc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')
const clientWidthDesc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')

let wrapper: VueWrapper | undefined

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get(this: HTMLElement) {
      return (this.textContent ?? '').trim().length * CHAR_W
    },
  })
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get(this: HTMLElement) {
      // Only the component root carries flex-1 in this template.
      return this.classList.contains('flex-1') ? availWidth : 0
    },
  })
})

function restore(name: 'offsetWidth' | 'clientWidth', desc: PropertyDescriptor | undefined) {
  if (desc) Object.defineProperty(HTMLElement.prototype, name, desc)
  else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[name]
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  restore('offsetWidth', offsetWidthDesc)
  restore('clientWidth', clientWidthDesc)
})

/** The visible tag cluster is the first <span> child of the root; the
 *  measurement layer is aria-hidden and excluded by scoping to it. */
function visibleCluster() {
  return wrapper!.element.querySelector(':scope > span') as HTMLElement
}

function visibleBadgeTexts(cluster: HTMLElement): string[] {
  return [...cluster.children]
    .filter(el => el.tagName !== 'BUTTON')
    .map(el => (el.textContent ?? '').trim())
}

async function mountTags(scenarios: string[], avail: number) {
  availWidth = avail
  wrapper = await mountSuspended(SidebarScenarioTags, { props: { scenarios } })
  // onMounted defers the first measurement to nextTick; one more tick lets the
  // re-render with the measured count land.
  await nextTick()
  await nextTick()
}

describe('SidebarScenarioTags measured overflow', () => {
  it('renders every fitting tag whole, uncapped after measurement', async () => {
    // Widths: 20 + 120 (+ gap ≤ 4) ≤ 200 — both fit, including the tag wider
    // than the 112px max-w-28 cap. Post-measure the cap must be absent so the
    // over-long tag shows WHOLE instead of as an ellipsised chip with no
    // popover to reveal it (the regression this spec pins down).
    await mountTags(['支付', '超长十二个字符的场景标签'], 200)

    const cluster = visibleCluster()
    expect(visibleBadgeTexts(cluster)).toEqual(['支付', '超长十二个字符的场景标签'])
    expect(cluster.querySelector('button')).toBeNull()
    for (const el of cluster.querySelectorAll('*')) {
      expect(el.classList.contains('max-w-28')).toBe(false)
    }
  })

  it('folds tags that exceed the budget into a "+N" popover trigger', async () => {
    // Widths: 20 + 140 (+ gap) > 100, but 20 + "+1"(20) (+ gaps ≤ 8) ≤ 100 —
    // only the first tag fits once the "+N" chip reserves its room.
    await mountTags(['支付', '这是一个特别长的场景标签名称'], 100)

    const cluster = visibleCluster()
    expect(visibleBadgeTexts(cluster)).toEqual(['支付'])
    const trigger = cluster.querySelector('button')
    expect(trigger).not.toBeNull()
    expect(trigger!.getAttribute('aria-label')).toBe('View all 2 scenarios')
    expect(trigger!.textContent).toContain('+1')
  })

  it('collapses to a count chip when not even one tag fits', async () => {
    // Widths: 50 each; even 50 + "+2"(20) (+ gaps) > 10 — nothing fits, so the
    // cluster degrades to the lone count-chip trigger showing the total.
    await mountTags(['超长标签一', '超长标签二'], 10)

    const cluster = visibleCluster()
    expect(visibleBadgeTexts(cluster)).toEqual([])
    const trigger = cluster.querySelector('button')
    expect(trigger).not.toBeNull()
    expect(trigger!.textContent).toContain('2')
  })
})
