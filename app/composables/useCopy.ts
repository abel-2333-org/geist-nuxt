import { useClipboard } from '@vueuse/core'

// Copy-to-clipboard with a brief "copied" state + a Geist-voice toast
// (points at the object, no trailing period, never "successfully").
//
// The actual clipboard write is delegated to VueUse's `useClipboard`, so we
// don't hand-maintain the async-API-vs-execCommand fallback. `legacy: true`
// keeps the hidden-textarea + execCommand path for insecure contexts and
// cross-origin iframes (e.g. the preview frame), where the async Clipboard API
// is blocked. We still own the `copied` state, timing, and toast wording so the
// public API and Geist voice stay exactly the same for every caller.
export function useCopy(timeout = 2000) {
  const copied = ref(false)
  const toast = useToast()
  const clipboard = useClipboard({ legacy: true })
  let timer: ReturnType<typeof setTimeout> | undefined

  async function copy(text: string, label = 'Code') {
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
        title: `${label} copied to clipboard`,
        color: 'success',
        icon: 'i-lucide-check',
      })
      clearTimeout(timer)
      timer = setTimeout(() => (copied.value = false), timeout)
    } else {
      toast.add({
        title: 'Copy failed. Select the text and copy manually',
        color: 'error',
        icon: 'i-lucide-triangle-alert',
      })
    }
  }

  return { copied, copy }
}
