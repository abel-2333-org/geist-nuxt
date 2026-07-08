// Copy-to-clipboard with a brief "copied" state + a Geist-voice toast
// (points at the object, no trailing period, never "successfully").
export function useCopy(timeout = 2000) {
  const copied = ref(false)
  const toast = useToast()
  let timer: ReturnType<typeof setTimeout> | undefined

  // The async Clipboard API is unavailable in insecure contexts and is blocked
  // by permissions policy inside cross-origin iframes (e.g. the preview frame).
  // Fall back to a hidden-textarea + execCommand('copy'), which works from a
  // user gesture in those environments. Returns whether the write succeeded.
  function legacyCopy(text: string): boolean {
    if (!import.meta.client) return false
    const ta = document.createElement('textarea')
    ta.value = text
    // Keep it off-screen but selectable; avoid scroll jumps and mobile zoom.
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '-9999px'
    ta.style.left = '0'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    ta.setSelectionRange(0, text.length)
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    document.body.removeChild(ta)
    return ok
  }

  async function copy(text: string, label = 'Code') {
    let ok = false
    try {
      if (import.meta.client && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        ok = true
      }
    } catch {
      ok = false
    }

    // Async API missing or rejected (iframe/insecure context) — try the
    // execCommand path before giving up.
    if (!ok) ok = legacyCopy(text)

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
