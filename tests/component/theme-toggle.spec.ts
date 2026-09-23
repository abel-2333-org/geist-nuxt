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

  it('forwards caller attributes and merges its touch class onto the button', async () => {
    wrapper = await mountSuspended(ThemeToggle, {
      attrs: { id: 'theme-action', 'data-owner': 'header', class: 'caller-theme' },
    })

    const button = wrapper.get('button')
    expect(button.attributes('id')).toBe('theme-action')
    expect(button.attributes('data-owner')).toBe('header')
    expect(button.classes()).toContain('caller-theme')
    expect(button.classes()).toContain('touch-manipulation')
  })

  it('preserves an explicit accessible-name override', async () => {
    wrapper = await mountSuspended(ThemeToggle, {
      attrs: { 'aria-label': 'Change appearance' },
    })

    expect(wrapper.get('button').attributes('aria-label')).toBe('Change appearance')
  })
})
