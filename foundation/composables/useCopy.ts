import { useClipboard } from '@vueuse/core'

export interface UseCopyOptions {
  /** How long the copied state remains active. */
  timeout?: number
  /** Complete fallback success sentence; callers may override it per copy. */
  successMessage?: string
  /** Complete fallback failure sentence; callers may override it per copy. */
  failureMessage?: string
}

export interface CopyTextOptions {
  /** Complete success sentence. Prefer this for localized UI. */
  successMessage?: string
  /** Complete failure sentence. Prefer this for localized UI. */
  failureMessage?: string
}

// Copy-to-clipboard with a brief "copied" state + a Geist-voice toast
// (points at the object, no trailing period, never "successfully").
//
// The actual clipboard write is delegated to VueUse's `useClipboard`, so we
// don't hand-maintain the async-API-vs-execCommand fallback. `legacy: true`
// keeps the hidden-textarea + execCommand path for insecure contexts and
// cross-origin iframes (e.g. the preview frame), where the async Clipboard API
// is blocked. We still own the `copied` state, timing, and toast wording so the
// message contract and Geist voice stay consistent for every caller.
export function useCopy(options: UseCopyOptions = {}) {
  const {
    timeout = 2000,
    successMessage = 'Copied to clipboard',
    failureMessage = 'Copy failed. Select the text and copy manually',
  } = options
  const copied = shallowRef(false)
  const toast = useToast()
  const clipboard = useClipboard({ legacy: true })
  let timer: ReturnType<typeof setTimeout> | undefined

  async function copy(
    text: string,
    copyOptions: CopyTextOptions = {},
  ) {
    let ok = false
    try {
      // With `legacy: true`, `isSupported` is only false in truly capability-less
      // environments (e.g. SSR / no document). Guard so we can show the manual
      // fallback toast instead of silently doing nothing.
      if (clipboard.isSupported.value) {
        await clipboard.copy(text)
        ok = true
      }
    } catch {
      ok = false
    }

    if (ok) {
      copied.value = true
      toast.add({
        title: copyOptions.successMessage ?? successMessage,
        color: 'success',
        icon: 'i-lucide-check',
      })
      clearTimeout(timer)
      timer = setTimeout(() => (copied.value = false), timeout)
    } else {
      toast.add({
        title: copyOptions.failureMessage ?? failureMessage,
        color: 'error',
        icon: 'i-lucide-triangle-alert',
      })
    }
  }

  onScopeDispose(() => clearTimeout(timer))

  return { copied, copy }
}
