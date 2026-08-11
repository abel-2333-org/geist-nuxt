import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import CopyButton from '../../foundation/components/CopyButton.vue'

describe('CopyButton attrs contract', () => {
  it.each([false, true])('keeps layout attrs off rendered roots when tooltip=%s', async (tooltip) => {
    const wrapper = await mountSuspended(CopyButton, {
      props: { value: 'value', tooltip },
      attrs: { class: 'layout-owner' },
      global: {
        stubs: {
          UTooltip: { template: '<div><slot /></div>' },
        },
      },
    })

    expect(wrapper.find('.layout-owner').exists()).toBe(false)
  })
})
