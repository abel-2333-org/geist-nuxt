import { onScopeDispose } from 'vue'

export interface UseRafTaskReturn<Args extends unknown[]> {
  /** Coalesce into the next frame: drop the pending run, keep only these args. */
  schedule: (...args: Args) => void
  /** Drop the pending run, if any. Idempotent; safe after the task has fired. */
  cancel: () => void
}

/**
 * Frame-coalesced task scheduling — the single owner of the "defer to the next
 * animation frame" boilerplate previously copied (with drift) by SplitPane,
 * CodeRail, EnumTable and SidebarScenarioTags.
 *
 * Why deferral at all: ResizeObserver (and MutationObserver) callbacks run
 * synchronously. Recomputing layout state inside one mutates the DOM and can
 * resize the observed node again within the same delivery cycle, which the
 * browser reports as "ResizeObserver loop completed with undelivered
 * notifications". Scheduling the work on the next animation frame breaks that
 * synchronous feedback loop (the standard fix) and coalesces bursts of
 * notifications into a single run.
 *
 * Contract:
 * - `schedule(...args)` cancels a still-pending frame first, so only the most
 *   recent call's args reach the task — bursts collapse to one run;
 * - the frame id is cleared BEFORE the task runs, so the task may schedule a
 *   follow-up frame for itself without it being treated as still-pending;
 * - `cancel()` is idempotent and safe to call after the task has fired;
 * - the pending frame is cancelled automatically on scope dispose (component
 *   unmount), so consumers need no manual `onBeforeUnmount` cleanup;
 * - without `requestAnimationFrame` (SSR, bare test environments) the task
 *   runs synchronously — no observer fires there, so the loop the deferral
 *   guards against cannot occur.
 */
export function useRafTask<Args extends unknown[] = []>(
  task: (...args: Args) => void,
): UseRafTaskReturn<Args> {
  let frame: number | undefined

  function cancel() {
    if (frame === undefined) return
    cancelAnimationFrame(frame)
    frame = undefined
  }

  function schedule(...args: Args) {
    if (typeof requestAnimationFrame === 'undefined') {
      task(...args)
      return
    }
    cancel()
    frame = requestAnimationFrame(() => {
      frame = undefined
      task(...args)
    })
  }

  onScopeDispose(cancel)

  return { schedule, cancel }
}
