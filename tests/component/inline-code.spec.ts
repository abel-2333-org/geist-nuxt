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

  it('keeps the Geist calibrations on the rendered element', async () => {
    const w = await mountSuspended(InlineCode, {
      slots: { default: () => '3000' },
    })
    const classes = w.get('code').classes()
    expect(classes).toContain('rounded-sm')
    expect(classes).toContain('text-code')
  })
})
