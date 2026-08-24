// <SidebarNav> — documented behaviour contracts from
// references/kits/api-docs/sidebar-nav.md: the single search filters across
// label / method / scenario tags, a section-label hit keeps the whole section,
// active state comes from ONE source (explicit boolean wins, '#' links never
// self-infer, plain paths infer from the resolved route), fully-CJK section
// labels fall back to the label itself instead of colliding on an empty slug,
// Esc clears the query but never while an IME composition is being cancelled,
// and the resize separator is keyboard-operable within [min, max].
import { describe, it, expect, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import SidebarNav from '../../kits/api-docs/components/SidebarNav.vue'

let wrapper: VueWrapper | undefined

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

const groups = [
  {
    label: '文档',
    sections: [
      {
        label: '指南',
        kind: 'guide' as const,
        defaultOpen: true,
        items: [
          { label: '快速开始', to: '/guide/quickstart' },
          { label: '认证', to: '/guide/auth' },
        ],
      },
    ],
  },
  {
    label: 'API 参考',
    sections: [
      {
        label: 'Tasks',
        kind: 'endpoints' as const,
        defaultOpen: true,
        items: [
          { label: '创建任务', to: '/api/tasks/create', method: 'POST', scenarios: ['批处理'] },
          { label: '查询任务', to: '/api/tasks/get', method: 'GET', scenarios: ['实时查询'] },
        ],
      },
    ],
  },
]

function searchInput() {
  return wrapper!.find('input[type="search"]')
}

async function mountNav(props: Record<string, unknown> = {}) {
  wrapper = await mountSuspended(SidebarNav, { props: { groups, ...props } })
}

describe('SidebarNav search filter', () => {
  it('matches scenario tags and shows hit/total counts', async () => {
    await mountNav()
    await searchInput().setValue('批处理')

    expect(wrapper!.text()).toContain('创建任务')
    expect(wrapper!.text()).not.toContain('查询任务')
    // Guide-world sections have no hit → the whole group drops out.
    expect(wrapper!.text()).not.toContain('快速开始')
    expect(wrapper!.text()).toContain('1/2')
  })

  it('matches the HTTP method', async () => {
    await mountNav()
    await searchInput().setValue('get')

    expect(wrapper!.text()).toContain('查询任务')
    expect(wrapper!.text()).not.toContain('创建任务')
  })

  it('keeps every item when the section label matches', async () => {
    await mountNav()
    await searchInput().setValue('tasks')

    expect(wrapper!.text()).toContain('创建任务')
    expect(wrapper!.text()).toContain('查询任务')
  })

  it('announces results politely and shows the empty state on no match', async () => {
    await mountNav()
    const status = wrapper!.find('[role="status"]')
    expect(status.text()).toBe('')

    await searchInput().setValue('批处理')
    expect(status.text()).toBe('1 result found')

    await searchInput().setValue('zzz')
    expect(status.text()).toContain('No results for')
    expect(wrapper!.text()).toContain('No matching pages')
  })

  it('strips the trailing ellipsis from the search aria-label', async () => {
    await mountNav({ searchPlaceholder: '搜索文档…' })
    expect(searchInput().attributes('aria-label')).toBe('搜索文档')
  })

  it('Esc clears the query — except while an IME composition is cancelling', async () => {
    await mountNav()
    const input = searchInput()
    await input.setValue('批处理')

    // WebKit fires the composition-cancelling Esc with isComposing: true.
    input.element.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', isComposing: true, bubbles: true }),
    )
    await nextTick()
    expect((input.element as HTMLInputElement).value).toBe('批处理')

    input.element.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )
    await nextTick()
    expect((input.element as HTMLInputElement).value).toBe('')
  })
})

describe('SidebarNav active state', () => {
  it('derives aria-current from the single active source', async () => {
    // Flat `sections` prop also covers the back-compat single-group wrapping.
    wrapper = await mountSuspended(SidebarNav, {
      props: {
        sections: [
          {
            label: 'S',
            defaultOpen: true,
            items: [
              { label: 'Explicit', to: '/somewhere', active: true },
              { label: 'Hash', to: '/#part' },
              { label: 'Self', to: '/' },
            ],
          },
        ],
      },
    })

    // Explicit boolean wins.
    expect(wrapper.find('a[aria-label="Explicit"]').attributes('aria-current')).toBe('page')
    // A `to` containing '#' never self-infers.
    expect(wrapper.find('a[aria-label="Hash"]').attributes('aria-current')).toBeUndefined()
    // A plain internal path infers from the resolved current route ('/').
    expect(wrapper.find('a[aria-label="Self"]').attributes('aria-current')).toBe('page')
  })
})

describe('SidebarNav section identity', () => {
  it('keeps fully-CJK section labels independent (label slug fallback)', async () => {
    wrapper = await mountSuspended(SidebarNav, {
      props: {
        sections: [
          { label: '批量', items: [{ label: '甲', to: '/a' }] },
          { label: '实时', items: [{ label: '乙', to: '/b' }] },
        ],
      },
    })
    expect(wrapper.text()).not.toContain('甲')

    const trigger = wrapper.findAll('button').find(b => b.text().includes('批量'))
    expect(trigger).toBeDefined()
    await trigger!.trigger('click')

    // If both labels slugged to the same empty id, opening one would open both.
    expect(wrapper.text()).toContain('甲')
    expect(wrapper.text()).not.toContain('乙')
  })
})

describe('SidebarNav resize handle', () => {
  it('is keyboard-operable and clamps to [minWidth, maxWidth]', async () => {
    await mountNav({ widthStorageKey: 'sidebar-nav-spec-resize' })
    const sep = wrapper!.find('[role="separator"]')
    expect(sep.attributes('aria-valuenow')).toBe('288')

    await sep.trigger('keydown', { key: 'ArrowRight' })
    expect(sep.attributes('aria-valuenow')).toBe('304')

    await sep.trigger('keydown', { key: 'End' })
    expect(sep.attributes('aria-valuenow')).toBe('460')
    await sep.trigger('keydown', { key: 'ArrowRight' })
    expect(sep.attributes('aria-valuenow')).toBe('460')

    await sep.trigger('keydown', { key: 'Home' })
    expect(sep.attributes('aria-valuenow')).toBe('220')

    await sep.trigger('dblclick')
    expect(sep.attributes('aria-valuenow')).toBe('288')
  })

  it('renders no separator when resizable is off', async () => {
    await mountNav({ resizable: false })
    expect(wrapper!.find('[role="separator"]').exists()).toBe(false)
  })
})
