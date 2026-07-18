import { useClipboard } from '@vueuse/core'

export interface UseCopyOptions {
  /** How long the copied state remains active. */
  timeout?: number
  /** Complete fallback failure sentence; callers may override it per copy. */
  failureMessage?: string
}

export interface CopyTextOptions {
  /** Object name used by the default success sentence, e.g. `Code`. */
  label?: string
  /** Complete success sentence. Prefer this for localized UI. */
  successMessage?: string
  /** Complete failure sentence. Prefer this for localized UI. */
  failureMessage?: string
}

export type LegacyCopyTextOptions = Omit<CopyTextOptions, 'label'>

// Copy-to-clipboard with a brief "copied" state + a Geist-voice toast
// (points at the object, no trailing period, never "successfully").
//
// The actual clipboard write is delegated to VueUse's `useClipboard`, so we
// don't hand-maintain the async-API-vs-execCommand fallback. `legacy: true`
// keeps the hidden-textarea + execCommand path for insecure contexts and
// cross-origin iframes (e.g. the preview frame), where the async Clipboard API
// is blocked. We still own the `copied` state, timing, and toast wording so the
// public API and Geist voice stay exactly the same for every caller.
export function useCopy(options: UseCopyOptions | number = {}) {
  const resolvedOptions = typeof options === 'number' ? { timeout: options } : options
  const {
    timeout = 2000,
    failureMessage = 'Copy failed. Select the text and copy manually',
  } = resolvedOptions
  const copied = shallowRef(false)
  const toast = useToast()
  const clipboard = useClipboard({ legacy: true })
  let timer: ReturnType<typeof setTimeout> | undefined

  // `label` names *what* was copied and fills the default "<label> copied to
  // clipboard" sentence — the English Geist voice every caller shares. Callers
  // that need to own the *whole* sentence (e.g. to localize it through their
  // own labels/i18n) pass success/failure messages instead, so no caller has to
  // string-concatenate half a sentence onto our hardcoded other half.
  async function copy(
    text: string,
    copyOptionsOrLabel: CopyTextOptions | string | undefined = {},
    legacyOptions: LegacyCopyTextOptions = {},
  ) {
    const copyOptions: CopyTextOptions = typeof copyOptionsOrLabel === 'string'
      ? { ...legacyOptions, label: copyOptionsOrLabel }
      : (copyOptionsOrLabel ?? legacyOptions)
    const label = copyOptions.label ?? 'Code'
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
        title: copyOptions.successMessage ?? `${label} copied to clipboard`,
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
