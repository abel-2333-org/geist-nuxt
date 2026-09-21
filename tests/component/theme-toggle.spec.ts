import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import ThemeToggle from '../../foundation/components/ThemeToggle.vue'

let wrapper: VueWrapper | undefined

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('ThemeToggle touch contract', () => {
  it('opts the color-mode button into touch-manipulation', async () => {
    // Foundation tap-target touch contract (references/foundations/focus-a11y.md):
    // UColorModeButton takes `class` as a prop and forwards it to the root UButton.
    wrapper = await mountSuspended(ThemeToggle)
    expect(wrapper.get('button').classes()).toContain('touch-manipulation')
  })
})
