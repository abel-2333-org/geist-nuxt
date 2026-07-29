import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import SiteSearch from '../../kits/api-docs/components/SiteSearch.vue'

let wrapper: VueWrapper | undefined

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('SiteSearch hash focus handoff', () => {
  it('uses Vue Router decoded hashes as literal DOM ids', async () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      callback(0)
      return 1
    }))
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))

    const target = document.createElement('div')
    target.id = 'res_state%25'
    target.scrollIntoView = vi.fn()
    document.body.append(target)

    wrapper = await mountSuspended(SiteSearch, {
      route: '/kits/api-docs',
      props: {
        groups: [{
          id: 'fields',
          label: 'Fields',
          items: [{ label: 'State', to: '/kits/api-docs#res_state%2525' }],
        }],
      },
      attachTo: document.body,
    })
    await wrapper.get('button').trigger('click')

    const palette = wrapper.findComponent({ name: 'UCommandPalette' })
    const option = palette.get('[role="option"][data-slot="item"]')
    expect(option.text()).toContain('State')
    await option.trigger('click')

    await vi.waitFor(() => expect(document.activeElement).toBe(target))
    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' })
  })
})
