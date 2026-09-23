import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { useCopy } from '../../foundation/composables/useCopy'

mockNuxtImport('useToast', () => () => ({ add: vi.fn() }))

const clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
const execCommand = Object.getOwnPropertyDescriptor(document, 'execCommand')
let scope: ReturnType<typeof effectScope>
let controls: HTMLDivElement

beforeEach(() => {
  scope = effectScope()
  controls = document.createElement('div')
  controls.innerHTML = '<button>Copy</button><button>Next action</button>'
  document.body.appendChild(controls)
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockRejectedValue(new Error('blocked')) },
  })
  // Chrome focuses a textarea when select() runs; happy-dom does not.
  vi.spyOn(HTMLTextAreaElement.prototype, 'select').mockImplementation(function () {
    this.focus()
  })
})

afterEach(() => {
  scope.stop()
  controls.remove()
  vi.restoreAllMocks()
  if (clipboard) Object.defineProperty(navigator, 'clipboard', clipboard)
  else Reflect.deleteProperty(navigator, 'clipboard')
  if (execCommand) Object.defineProperty(document, 'execCommand', execCommand)
  else Reflect.deleteProperty(document, 'execCommand')
})

function fallback(implementation: () => boolean) {
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    value: vi.fn(implementation),
  })
  return scope.run(() => useCopy())!
}

describe('useCopy fallback focus', () => {
  it.each(['success', 'failure', 'throw'] as const)('restores keyboard focus after %s', async (outcome) => {
    const button = controls.querySelector('button')!
    button.focus()
    const copy = fallback(() => {
      expect(document.activeElement?.tagName).toBe('TEXTAREA')
      expect((document.activeElement as HTMLTextAreaElement).value).toBe('raw value')
      if (outcome === 'throw') throw new Error('copy unavailable')
      return outcome === 'success'
    })
    expect(await copy.copy('raw value')).toBe(outcome === 'success')
    expect(document.activeElement).toBe(button)
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('preserves focus explicitly moved by a copy event handler', async () => {
    const [button, next] = controls.querySelectorAll('button')
    button!.focus()
    const copy = fallback(() => { next!.focus(); return true })
    expect(await copy.copy('value')).toBe(true)
    expect(document.activeElement).toBe(next)
  })

  it('does not focus an original control that was removed during copying', async () => {
    const button = controls.querySelector('button')!
    button.focus()
    const restore = vi.spyOn(button, 'focus')
    const copy = fallback(() => { button.remove(); return false })
    expect(await copy.copy('value')).toBe(false)
    expect(restore).not.toHaveBeenCalled()
    expect(document.querySelector('textarea')).toBeNull()
  })
})
