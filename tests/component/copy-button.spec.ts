import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { UApp } from '#components'
import { useToast } from '#imports'
import CopyButton from '../../foundation/components/CopyButton.vue'
import OperationTarget from '../../kits/api-docs/components/OperationTarget.vue'

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

describe('copy result announcements', () => {
  let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
  let toast: ReturnType<typeof useToast> | undefined
  const clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')

  afterEach(() => {
    toast?.clear()
    wrapper?.unmount()
    if (clipboard) Object.defineProperty(navigator, 'clipboard', clipboard)
    else Reflect.deleteProperty(navigator, 'clipboard')
  })

  it.each([
    {
      name: 'plain CopyButton',
      render: () => h(CopyButton, { value: 'value', copiedLabel: '值已复制' }),
      label: 'Copy',
      message: '值已复制',
    },
    {
      name: 'tooltip CopyButton',
      render: () => h(CopyButton, { value: 'value', copiedLabel: '值已复制', tooltip: true }),
      label: 'Copy',
      message: '值已复制',
    },
    ...(['host', 'path'] as const).map(segment => ({
      name: `OperationTarget ${segment}`,
      render: () => h(OperationTarget, {
        hosts: [{ id: 'prod', label: 'Production', baseUrl: 'https://api.example.com' }],
        path: '/v1/health',
        labels: { copiedHost: '环境已复制', copiedPath: '路径已复制' },
      }),
      label: segment === 'host' ? 'Copy host https://api.example.com' : 'Copy path /v1/health',
      message: segment === 'host' ? '环境已复制' : '路径已复制',
    })),
  ])('announces $name once through a polite toast', async ({ render, label, message }) => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
    const Host = defineComponent({
      setup() {
        toast = useToast()
        return () => h(UApp, null, { default: render })
      },
    })
    wrapper = await mountSuspended(Host, {
      attachTo: document.body,
    })
    const target = wrapper.findComponent(OperationTarget)
    const component = target.exists() ? target : wrapper.getComponent(CopyButton)
    // Reject duplicate sources before copied can expire during the toast wait.
    expect(component.find('[aria-live]').exists()).toBe(false)
    await wrapper.get(`button[aria-label="${label}"]`).trigger('click')

    // Reka mounts its announcement after two frames. Wait for that source,
    // then ensure no component-owned status region duplicates the message.
    await vi.waitFor(() => {
      const announcements = [...document.querySelectorAll('[aria-live]')]
        .filter(element => element.textContent?.includes(message))
      expect(announcements.some(element => element.getAttribute('role') === 'alert')).toBe(true)
      expect(announcements).toHaveLength(1)
      expect(announcements[0]!.getAttribute('aria-live')).toBe('polite')
    }, { timeout: 5000 })
  }, 10_000)
})
