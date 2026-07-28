import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import AppHeader from '../../foundation/compositions/AppHeader.vue'

let wrapper: VueWrapper | undefined
const global = {
  stubs: {
    UHeader: {
      template: '<header><slot name="left" /><slot /><slot name="right" /><slot name="body" /></header>',
    },
    NuxtLink: {
      template: '<a><slot /></a>',
    },
    UNavigationMenu: true,
    ThemeToggle: true,
  },
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('AppHeader brand contract', () => {
  it('renders a neutral fallback by default', () => {
    wrapper = mount(AppHeader, { global })

    expect(wrapper.text()).toContain('Application')
    expect(wrapper.text()).not.toContain('geist-nuxt')
  })

  it('accepts a concise brand prop', () => {
    wrapper = mount(AppHeader, {
      props: { brand: 'Developer Docs' },
      global,
    })

    expect(wrapper.text()).toContain('Developer Docs')
    expect(wrapper.text()).not.toContain('Application')
  })

  it('lets the brand slot replace the fallback', () => {
    wrapper = mount(AppHeader, {
      slots: { brand: () => 'Onerway Docs' },
      global,
    })

    expect(wrapper.text()).toContain('Onerway Docs')
    expect(wrapper.text()).not.toContain('Application')
  })
})
