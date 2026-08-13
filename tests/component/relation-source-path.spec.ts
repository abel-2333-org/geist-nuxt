import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import RelationSourcePath from '../../kits/api-docs/components/RelationSourcePath.vue'

afterEach(() => vi.restoreAllMocks())

describe('RelationSourcePath', () => {
  it('links a resolved field and exposes one locale-consistent spoken path', async () => {
    const wrapper = await mountSuspended(RelationSourcePath, {
      props: {
        source: {
          scope: 'response',
          location: 'body',
          segments: ['payment', 'id'],
          field: 'res_payment_id',
        },
      },
    })

    const link = wrapper.get('a')
    expect(link.attributes('href')).toBe('#res_payment_id')
    expect(link.text().replace(/\s+/g, ' ').trim()).toBe('Source: Response body under payment under id')
    expect(wrapper.findAll('[translate="no"]').map(node => node.text())).toEqual(['payment', 'id'])

    await link.trigger('click')
    expect(location.hash).toBe('#res_payment_id')
    wrapper.unmount()
    history.replaceState(history.state, '', '/')
  })

  it.each([
    { metaKey: true },
    { ctrlKey: true },
    { shiftKey: true },
    { altKey: true },
    { button: 1 },
  ])('preserves native anchor behavior for modified clicks (%o)', async (eventInit) => {
    const wrapper = await mountSuspended(RelationSourcePath, {
      props: {
        source: {
          scope: 'response',
          location: 'body',
          segments: ['payment', 'id'],
          field: 'res_payment_id',
        },
      },
    })

    const event = new MouseEvent('click', { bubbles: true, cancelable: true, ...eventInit })
    wrapper.get('a').element.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
    wrapper.unmount()
  })

  it('falls back to text when the consumer cannot provide a stable anchor', async () => {
    const add = vi.spyOn(EventTarget.prototype, 'addEventListener')
    const wrapper = await mountSuspended(RelationSourcePath, {
      props: {
        source: {
          scope: 'response',
          location: 'header',
          segments: ['Location'],
        },
      },
    })

    expect(wrapper.element.tagName).toBe('SPAN')
    expect(wrapper.find('a').exists()).toBe(false)
    expect(wrapper.text()).toContain('Location')
    expect(add.mock.calls.some((args, i) =>
      add.mock.contexts[i] === wrapper.element && args[0] === 'click',
    )).toBe(false)
    wrapper.unmount()
  })

  it('uses a router link when the documenting field lives on another page', async () => {
    const wrapper = await mountSuspended(RelationSourcePath, {
      props: {
        source: {
          scope: 'request',
          location: 'body',
          segments: ['callback_url'],
          to: '/reference/webhook#callback_url',
        },
        labels: {
          scope: { 'request:body': '请求体' },
          prefix: '来源：',
          connector: '下的',
        },
      },
    })

    const link = wrapper.get('a')
    expect(link.attributes('href')).toBe('/reference/webhook#callback_url')
    expect(link.text().replace(/\s+/g, ' ').trim()).toBe('来源： 请求体 下的 callback_url')
  })
})
