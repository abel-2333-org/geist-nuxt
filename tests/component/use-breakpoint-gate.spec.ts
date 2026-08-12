// useBreakpointGate — the shared SSR-safe breakpoint gate extracted from
// SplitPane / CodeRail. Covers the render-agreement contract (starts false,
// flips only after mount), the 'always' opt-out, runtime breakpoint changes
// re-subscribing to a fresh media query list, and unmount cleanup.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, shallowRef, type ShallowRef } from 'vue'
import type { VueWrapper } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { useBreakpointGate } from '../../foundation/composables/useBreakpointGate'
import type { GeistBreakpoint } from '../../foundation/utils/breakpoints'

interface StubMql {
  query: string
  matches: boolean
  listeners: Set<(event: { matches: boolean }) => void>
  addEventListener: (type: string, listener: (event: { matches: boolean }) => void) => void
  removeEventListener: (type: string, listener: (event: { matches: boolean }) => void) => void
}

let mqls: StubMql[] = []

function stubMatchMedia(matches: boolean) {
  mqls = []
  vi.stubGlobal('matchMedia', vi.fn((query: string) => {
    const mql: StubMql = {
      query,
      matches,
      listeners: new Set(),
      addEventListener: (_type, listener) => mql.listeners.add(listener),
      removeEventListener: (_type, listener) => mql.listeners.delete(listener),
    }
    mqls.push(mql)
    return mql
  }))
}

let wrapper: VueWrapper | undefined

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

async function mountGate(breakpoint: ShallowRef<GeistBreakpoint | 'always'>) {
  let gate: ShallowRef<boolean> | undefined
  const Host = defineComponent({
    setup() {
      gate = useBreakpointGate(() => breakpoint.value)
      return () => h('div')
    },
  })
  wrapper = await mountSuspended(Host)
  if (!gate) throw new Error('useBreakpointGate did not initialize')
  return gate
}

describe('useBreakpointGate', () => {
  it('starts false, flips on mount, and follows media query changes', async () => {
    stubMatchMedia(true)
    const breakpoint = shallowRef<GeistBreakpoint | 'always'>('lg')
    const gate = await mountGate(breakpoint)

    expect(gate.value).toBe(true)
    expect(mqls).toHaveLength(1)
    expect(mqls[0]!.query).toBe('(min-width: 961px)')

    for (const listener of mqls[0]!.listeners) listener({ matches: false })
    expect(gate.value).toBe(false)
  })

  it("is true from the first render for 'always' and never subscribes", async () => {
    stubMatchMedia(false)
    const breakpoint = shallowRef<GeistBreakpoint | 'always'>('always')
    const gate = await mountGate(breakpoint)

    expect(gate.value).toBe(true)
    expect(mqls).toHaveLength(0)
  })

  it('re-subscribes when the breakpoint changes at runtime and cleans up on unmount', async () => {
    stubMatchMedia(false)
    const breakpoint = shallowRef<GeistBreakpoint | 'always'>('lg')
    const gate = await mountGate(breakpoint)

    expect(gate.value).toBe(false)
    const first = mqls[0]!
    expect(first.listeners.size).toBe(1)

    breakpoint.value = 'xl'
    await nextTick()
    expect(mqls).toHaveLength(2)
    expect(first.listeners.size).toBe(0)
    const second = mqls[1]!
    expect(second.query).not.toBe(first.query)
    expect(second.listeners.size).toBe(1)

    // A stale listener from the old media query must not flip the gate.
    for (const listener of first.listeners) listener({ matches: true })
    expect(gate.value).toBe(false)

    breakpoint.value = 'always'
    await nextTick()
    expect(gate.value).toBe(true)
    expect(second.listeners.size).toBe(0)

    breakpoint.value = 'sm'
    await nextTick()
    expect(mqls).toHaveLength(3)
    wrapper!.unmount()
    wrapper = undefined
    expect(mqls[2]!.listeners.size).toBe(0)
  })
})
