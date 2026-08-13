import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import SiteSearch from '../../kits/api-docs/components/SiteSearch.vue'

let wrapper: VueWrapper | undefined

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const groups = [{
  id: 'guides',
  label: 'Guides',
  items: [{ label: 'Authentication', to: '/' }],
}]

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

async function mountSearch(props: Record<string, unknown> = {}) {
  wrapper = await mountSuspended(SiteSearch, {
    props: { groups, searchDelay: 0, ...props },
    attachTo: document.body,
  })
  await wrapper.get('button').trigger('click')
  return wrapper
}

function status() {
  return wrapper!.get('[role="status"]')
}

function palette() {
  return wrapper!.findComponent({ name: 'UCommandPalette' })
}

async function query(value: string) {
  await palette().get('input').setValue(value)
}

describe('SiteSearch status announcements', () => {
  it('keeps one persistent polite region silent while idle and after close', async () => {
    wrapper = await mountSuspended(SiteSearch, {
      props: { groups },
      attachTo: document.body,
    })

    expect(wrapper.findAll('[role="status"]')).toHaveLength(1)
    expect(status().attributes()).toMatchObject({
      'aria-live': 'polite',
      'aria-atomic': 'true',
    })
    expect(status().text()).toBe('')

    await wrapper.get('button').trigger('click')
    expect(status().text()).toBe('')

    await query('   ')
    expect(status().text()).toBe('')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(status().text()).toBe('')
  })

  it('announces each static no-result query without duplicating the visible empty label', async () => {
    await mountSearch({
      emptyLabel: 'Nothing visible',
      noResultsAnnouncement: (value: string) => `No docs for ${value}`,
    })

    await query('first-miss')
    await vi.waitFor(() => expect(status().text()).toBe('No docs for first-miss'))
    expect(palette().get('[data-slot="empty"]').text()).toBe('Nothing visible')

    await query('second-miss')
    await vi.waitFor(() => expect(status().text()).toBe('No docs for second-miss'))
  })

  it('never announces a matching query while replacing a previous empty state', async () => {
    await mountSearch({
      noResultsAnnouncement: (value: string) => `No docs for ${value}`,
    })

    await query('missing')
    await vi.waitFor(() => expect(status().text()).toBe('No docs for missing'))

    const changes: string[] = []
    const observer = new MutationObserver(() => changes.push(status().text()))
    observer.observe(status().element, { childList: true, characterData: true, subtree: true })

    await query('Authentication')
    await flushPromises()
    observer.disconnect()

    expect(palette().text()).toContain('Authentication')
    expect(status().text()).toBe('')
    expect(changes).not.toContain('No docs for Authentication')
  })

  it('filters consumer groups with the current query before applying postFilter', async () => {
    const postFilter = vi.fn((_query: string, items: { label?: string }[]) => items)
    await mountSearch({
      extraGroups: [{
        id: 'extra',
        label: 'Extra',
        postFilter,
        items: [
          { label: 'Billing shortcut', to: '/billing' },
          { label: 'Team shortcut', to: '/team' },
        ],
      }],
    })

    await query('Billing')
    await flushPromises()

    expect(palette().text()).toContain('Billing shortcut')
    expect(palette().text()).not.toContain('Team shortcut')
    expect(postFilter).toHaveBeenLastCalledWith('Billing', [expect.objectContaining({ label: 'Billing shortcut' })])
  })

  it('announces async loading, empty, failure and successful-result transitions', async () => {
    const empty = deferred<never[]>()
    const failed = deferred<never[]>()
    const found = deferred<{ label: string, to: string }[]>()
    const search = vi.fn()
      .mockReturnValueOnce(empty.promise)
      .mockReturnValueOnce(failed.promise)
      .mockReturnValueOnce(found.promise)

    await mountSearch({
      search,
      searchGroupLabel: 'Content',
      searchingLabel: 'Looking…',
      searchErrorLabel: 'Lookup failed',
      noResultsAnnouncement: (value: string) => `No docs for ${value}`,
    })

    await query('empty-query')
    await vi.waitFor(() => expect(status().text()).toBe('Looking…'))
    empty.resolve([])
    await flushPromises()
    await vi.waitFor(() => expect(status().text()).toBe('No docs for empty-query'))

    await query('failed-query')
    await vi.waitFor(() => expect(status().text()).toBe('Looking…'))
    await vi.waitFor(() => expect(search).toHaveBeenCalledTimes(2))
    failed.reject(new Error('offline'))
    await flushPromises()
    await vi.waitFor(() => expect(status().text()).toBe('Lookup failed'))

    await query('found-query')
    await vi.waitFor(() => expect(status().text()).toBe('Looking…'))
    found.resolve([{ label: 'Found guide', to: '/found' }])
    await flushPromises()
    await vi.waitFor(() => expect(palette().text()).toContain('Found guide'))
    expect(status().text()).toBe('')
  })

  it('does not announce an async failure while a static option remains available', async () => {
    const request = deferred<never[]>()
    const search = vi.fn(() => request.promise)
    await mountSearch({
      search,
      searchGroupLabel: 'Content',
      searchErrorLabel: 'Lookup failed',
    })

    await query('Authentication')
    expect(palette().text()).toContain('Authentication')
    expect(status().text()).toBe('')
    await vi.waitFor(() => expect(search).toHaveBeenCalledOnce())
    request.reject(new Error('offline'))
    await flushPromises()
    expect(palette().text()).toContain('Authentication')
    expect(status().text()).toBe('')
  })

  it('clears immediately on close and ignores a late request', async () => {
    const request = deferred<never[]>()
    const search = vi.fn(() => request.promise)
    await mountSearch({
      search,
      searchGroupLabel: 'Content',
      searchingLabel: 'Looking…',
    })

    await query('pending-query')
    await vi.waitFor(() => expect(status().text()).toBe('Looking…'))
    await vi.waitFor(() => expect(search).toHaveBeenCalledOnce())
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(status().text()).toBe('')

    request.resolve([])
    await flushPromises()
    expect(status().text()).toBe('')
  })
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
