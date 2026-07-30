// Annotation family forms — public behavior above the shared popover shell.
// The shell's pointer/focus mechanics have their own focused suite; these tests
// cover data resolution, async preview state, and field navigation contracts.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { defineComponent } from 'vue'
import TermAnnotation from '../../foundation/components/TermAnnotation.vue'
import DocAnnotation from '../../foundation/components/DocAnnotation.vue'
import FieldAnnotation from '../../kits/api-docs/components/FieldAnnotation.vue'
import { provideGlossary } from '../../foundation/composables/useGlossary'
import { provideFieldSource } from '../../kits/api-docs/composables/useFieldSource'

let wrapper: VueWrapper | undefined

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  history.replaceState(history.state, '', '/')
  vi.restoreAllMocks()
})

function panel(): HTMLElement | null {
  return document.querySelector<HTMLElement>('div[tabindex="-1"][class*="w-72"]')
}

async function open(w: VueWrapper) {
  await w.get('button[type="button"]').trigger('click')
  await vi.waitFor(() => {
    if (!panel()) throw new Error('annotation panel did not open')
  })
}

describe('TermAnnotation', () => {
  it('resolves a provided glossary entry and renders its definition action', async () => {
    const Host = defineComponent({
      components: { TermAnnotation },
      setup() {
        provideGlossary({
          'sliding-window': {
            term: 'Sliding window',
            definition: 'Counts requests in a **rolling** interval.',
            to: '/guides/rate-limits',
          },
        })
      },
      template: '<TermAnnotation id="sliding-window" />',
    })

    wrapper = await mountSuspended(Host, { attachTo: document.body })
    expect(wrapper.get('button').text()).toBe('Sliding window')

    await open(wrapper)
    expect(panel()!.textContent).toContain('Counts requests in a rolling interval.')
    expect(panel()!.querySelector('a')?.getAttribute('href')).toBe('/guides/rate-limits')
  })

  it('degrades an unknown id to slot text without an interactive trigger', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    wrapper = await mountSuspended(TermAnnotation, {
      props: { id: 'missing' },
      slots: { default: () => 'Legacy term' },
    })

    expect(wrapper.text()).toBe('Legacy term')
    expect(wrapper.find('button').exists()).toBe(false)
  })
})

describe('DocAnnotation', () => {
  it('keeps unbroken authored content inside the fixed-width panel', async () => {
    const title = 'https://api.example.com/v1/accounts/settlement_reconciliation_batches'
    const description = 'settlement_reconciliation_batch_cursor_identifier'
    const load = vi.fn().mockResolvedValue({ title, description })
    wrapper = await mountSuspended(DocAnnotation, {
      props: { to: '/guides/settlement', load },
      slots: { default: () => 'Settlement guide' },
      attachTo: document.body,
    })

    await open(wrapper)
    await flushPromises()
    const paragraphs = Array.from(panel()!.querySelectorAll('p'))
    const titleElement = paragraphs.find(element => element.textContent === title)
    const descriptionElement = paragraphs.find(element => element.textContent === description)

    expect(titleElement).toBeDefined()
    expect([...titleElement!.classList]).toContain('wrap-anywhere')
    expect(descriptionElement).toBeDefined()
    expect([...descriptionElement!.classList]).toContain('wrap-anywhere')
  })

  it('loads once on first open and reuses the cached preview', async () => {
    const load = vi.fn().mockResolvedValue({
      title: 'Rate limiting guide',
      description: 'Recommended retry backoff.',
    })
    wrapper = await mountSuspended(DocAnnotation, {
      props: { to: '/guides/rate-limits', load },
      slots: { default: () => 'Rate limits' },
      attachTo: document.body,
    })

    expect(load).not.toHaveBeenCalled()
    await open(wrapper)
    await flushPromises()
    expect(panel()!.textContent).toContain('Rate limiting guide')
    expect(load).toHaveBeenCalledTimes(1)

    await wrapper.get('button[type="button"]').trigger('click')
    await vi.waitFor(() => {
      if (panel()) throw new Error('annotation panel did not close')
    })
    await open(wrapper)
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('keeps the page fallback in error state and retries successfully', async () => {
    const load = vi.fn()
      .mockRejectedValueOnce(new Error('not found'))
      .mockResolvedValueOnce({ title: 'Recovered preview' })
    wrapper = await mountSuspended(DocAnnotation, {
      props: { to: '/guides/recovery', load },
      slots: { default: () => 'Recovery guide' },
      attachTo: document.body,
    })

    await open(wrapper)
    await flushPromises()
    expect(panel()!.textContent).toContain('Preview failed to load.')
    expect(panel()!.querySelector('a')?.getAttribute('href')).toBe('/guides/recovery')

    const retry = Array.from(panel()!.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Retry preview'))
    expect(retry).toBeDefined()
    retry!.click()
    await flushPromises()

    expect(panel()!.textContent).toContain('Recovered preview')
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('ignores a stale response after the target document changes', async () => {
    let resolveFirst!: (value: { title: string }) => void
    let resolveSecond!: (value: { title: string }) => void
    const first = new Promise<{ title: string }>((resolve) => { resolveFirst = resolve })
    const second = new Promise<{ title: string }>((resolve) => { resolveSecond = resolve })
    const load = vi.fn()
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second)
    wrapper = await mountSuspended(DocAnnotation, {
      props: { to: '/guides/first', load },
      slots: { default: () => 'Guide' },
      attachTo: document.body,
    })

    await open(wrapper)
    await wrapper.setProps({ to: '/guides/second' })
    resolveSecond({ title: 'Second guide' })
    await flushPromises()
    resolveFirst({ title: 'Stale first guide' })
    await flushPromises()

    expect(panel()!.textContent).toContain('Second guide')
    expect(panel()!.textContent).not.toContain('Stale first guide')
  })
})

describe('FieldAnnotation', () => {
  it('allows long field facts to shrink and wrap inside the panel', async () => {
    const type = 'oneof_settlement_reconciliation_batch_or_payout_adjustment_envelope'
    const description = 'settlement_reconciliation_batch_cursor_identifier'
    wrapper = await mountSuspended(FieldAnnotation, {
      props: {
        field: {
          path: 'body_settlement',
          name: 'settlement',
          type,
          description,
        },
      },
      attachTo: document.body,
    })

    await open(wrapper)
    const typeElement = Array.from(panel()!.querySelectorAll('span'))
      .find(element => element.textContent === type)
    const descriptionElement = Array.from(panel()!.querySelectorAll('p'))
      .find(element => element.textContent === description)

    expect(typeElement).toBeDefined()
    expect([...typeElement!.classList]).toEqual(expect.arrayContaining(['wrap-anywhere', 'min-w-0']))
    expect([...typeElement!.classList]).not.toContain('shrink-0')
    expect(descriptionElement).toBeDefined()
    expect([...descriptionElement!.classList]).toContain('wrap-anywhere')
  })

  it('warns through the mounted component when a field ref is unresolved', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    wrapper = await mountSuspended(FieldAnnotation, {
      props: { fieldRef: 'missing' },
      slots: { default: () => 'Legacy field' },
    })

    expect(warn).toHaveBeenCalledOnce()
    expect(warn).toHaveBeenCalledWith(
      '[FieldAnnotation] no field source entry for field-ref "missing" — rendering plain text',
    )
  })

  it('resolves a field source entry and jumps to the same-page field', async () => {
    const Host = defineComponent({
      components: { FieldAnnotation },
      setup() {
        provideFieldSource({
          amount: {
            field: {
              path: 'body_amount',
              name: 'amount',
              type: 'integer',
              required: true,
              description: 'Payment amount in minor units.',
            },
          },
        })
      },
      template: `
        <FieldAnnotation field-ref="amount" />
        <div id="body_amount">Amount target</div>
      `,
    })
    wrapper = await mountSuspended(Host, { attachTo: document.body })
    const target = document.getElementById('body_amount')!
    target.getBoundingClientRect = () => ({
      x: 0, y: 100, top: 100, right: 200, bottom: 120,
      left: 0, width: 200, height: 20, toJSON: () => ({}),
    })
    target.scrollIntoView = vi.fn()

    await open(wrapper)
    expect(panel()!.textContent).toContain('Payment amount in minor units.')
    const action = Array.from(panel()!.querySelectorAll('button'))
      .find(button => button.textContent?.includes('View field details'))
    expect(action).toBeDefined()
    action!.click()

    await vi.waitFor(() => {
      expect(location.hash).toBe('#body_amount')
      expect(document.activeElement).toBe(target)
    })
  })

  it('renders a cross-page field action with its target hash', async () => {
    const Host = defineComponent({
      components: { FieldAnnotation },
      setup() {
        provideFieldSource({
          state: {
            page: '/reference',
            field: { path: 'res_state%25', name: 'state', type: 'enum' },
          },
        })
      },
      template: '<FieldAnnotation field-ref="state" />',
    })
    wrapper = await mountSuspended(Host, { attachTo: document.body })

    await open(wrapper)
    expect(panel()!.querySelector('a')?.getAttribute('href')).toBe('/reference#res_state%2525')
  })

  it('derives the requiredness marker so an orphan condition is tagged in the preview too', async () => {
    // Same fieldRequiredState derivation as the field row: the popover and the
    // row it links to must not disagree about whether a field is conditional.
    wrapper = await mountSuspended(FieldAnnotation, {
      props: {
        field: {
          path: 'body_teamId',
          name: 'teamId',
          type: 'string',
          condition: 'Required when the token is scoped to a team.',
        },
      },
      attachTo: document.body,
    })

    await open(wrapper)
    expect(panel()!.textContent).toContain('Conditional')
  })

  it('degrades an unresolved field ref to plain slot text', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    wrapper = await mountSuspended(FieldAnnotation, {
      props: { fieldRef: 'missing' },
      slots: { default: () => 'Legacy field' },
    })

    expect(wrapper.text()).toBe('Legacy field')
    expect(wrapper.find('button').exists()).toBe(false)
  })
})
