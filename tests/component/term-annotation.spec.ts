// TermAnnotation regressions live outside annotation-forms.spec.ts because
// that shared file is evidence-bound to the completed Doc/Field audit.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import TermAnnotation from '../../foundation/components/TermAnnotation.vue'

let wrapper: VueWrapper | undefined

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

describe('TermAnnotation overflow', () => {
  it('wraps an unbroken term and definition inside the fixed-width panel', async () => {
    const term = 'settlement_reconciliation_batch_cursor'
    const definition = 'https://api.example.com/v1/settlement/reconciliation/batches/cursor'
    wrapper = await mountSuspended(TermAnnotation, {
      props: { entry: { term, definition } },
      attachTo: document.body,
    })

    const trigger = wrapper.get('button[type="button"]')
    expect(trigger.classes()).toContain('wrap-anywhere')
    await trigger.trigger('click')
    await vi.waitFor(() => {
      if (!document.querySelector('div[tabindex="-1"][class*="w-72"]')) {
        throw new Error('annotation panel did not open')
      }
    })

    const paragraphs = Array.from(document.querySelectorAll('div[tabindex="-1"][class*="w-72"] p'))
    const termElement = paragraphs.find(element => element.textContent === term)
    const definitionElement = paragraphs.find(element => element.textContent === definition)

    expect(termElement).toBeDefined()
    expect([...termElement!.classList]).toContain('wrap-anywhere')
    expect(definitionElement).toBeDefined()
    expect([...definitionElement!.classList]).toContain('wrap-anywhere')
  })
})
