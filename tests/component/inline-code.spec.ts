// <InlineCode> — foundation inline code atom over Nuxt UI ProseCode.
// Locks the atom's contract: literal content is protected from machine
// translation by default (translate="no", same rationale as CodeBlock), a
// caller can opt a specific instance back in via the fallthrough `translate`
// attr, and the two Geist theme calibrations (control-tier radius, Copy 13
// Mono) stay on the rendered element.
import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import InlineCode from '../../foundation/components/InlineCode.vue'

describe('InlineCode', () => {
  it('renders a <code> element with translate="no" by default', async () => {
    const w = await mountSuspended(InlineCode, {
      slots: { default: () => 'timeout_ms' },
    })
    const code = w.get('code')
    expect(code.text()).toBe('timeout_ms')
    expect(code.attributes('translate')).toBe('no')
  })

  it('lets a caller override translate via the fallthrough attr', async () => {
    const w = await mountSuspended(InlineCode, {
      attrs: { translate: 'yes' },
      slots: { default: () => 'localized sample' },
    })
    expect(w.get('code').attributes('translate')).toBe('yes')
  })

  it('replaces the ProseCode theme tiers instead of stacking on top of them', async () => {
    const w = await mountSuspended(InlineCode, {
      slots: { default: () => '3000' },
    })
    const classes = w.get('code').classes()
    expect(classes).toContain('rounded-sm')
    expect(classes).toContain('text-code')
    // Both calibrations must win through tailwind-merge, not through CSS
    // emission order: the theme's rounded-md / text-sm may not survive.
    expect(classes).not.toContain('rounded-md')
    expect(classes).not.toContain('text-sm')
  })

  it('keeps the 13px tier when a caller adds a text color', async () => {
    // `text-code` is registered as a font-size class in foundation/config/app.ts;
    // without that, tailwind-merge files it under text-color and a caller's
    // semantic color silently evicts the size calibration.
    const w = await mountSuspended(InlineCode, {
      attrs: { class: 'text-error' },
      slots: { default: () => 'invalid_request' },
    })
    const classes = w.get('code').classes()
    expect(classes).toContain('text-code')
    expect(classes).toContain('text-error')
  })

  it('lets a caller override the size tier via the class prop', async () => {
    const w = await mountSuspended(InlineCode, {
      attrs: { class: 'text-xs' },
      slots: { default: () => 'dense' },
    })
    const classes = w.get('code').classes()
    expect(classes).toContain('text-xs')
    expect(classes).not.toContain('text-code')
    expect(classes).not.toContain('text-sm')
  })
})
