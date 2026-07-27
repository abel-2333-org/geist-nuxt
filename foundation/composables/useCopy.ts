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
// A write counts as successful only when the selected browser API confirms it.
// Clipboard API rejection falls back to execCommand for insecure contexts and
// cross-origin preview frames; its boolean result remains authoritative.
async function writeClipboardText(text: string): Promise<boolean> {
  if (globalThis.navigator?.clipboard?.writeText) {
    try {
      await globalThis.navigator.clipboard.writeText(text)
      return true
    } catch {
      // Continue to the explicit-result fallback.
    }
  }

  if (!globalThis.document?.body || typeof globalThis.document.execCommand !== 'function') {
    return false
  }

  const textarea = globalThis.document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  textarea.setAttribute('readonly', '')
  globalThis.document.body.appendChild(textarea)
  textarea.select()

  try {
    return globalThis.document.execCommand('copy')
  } catch {
    return false
  } finally {
    textarea.remove()
  }
}

export function useCopy(options: UseCopyOptions = {}) {
  const {
    timeout = 2000,
    successMessage = 'Copied to clipboard',
    failureMessage = 'Copy failed. Select the text and copy manually',
  } = options
  const copied = shallowRef(false)
  const toast = useToast()
  let timer: ReturnType<typeof setTimeout> | undefined

  async function copy(
    text: string,
    copyOptions: CopyTextOptions = {},
  ): Promise<boolean> {
    const ok = await writeClipboardText(text)

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

    return ok
  }

  onScopeDispose(() => clearTimeout(timer))

  return { copied, copy }
}
