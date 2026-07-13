import type { NavigationMenuItem } from '@nuxt/ui'

// Augment Nuxt's PageMeta so `definePageMeta({ nav })` is type-safe.
declare module '#app' {
  interface PageMeta {
    nav?: false | { label?: string; icon?: string; order?: number }
  }
}

type NavMeta = { label?: string; icon?: string; order?: number }

// kebab / path segment → Title Case fallback (e.g. "api-docs" → "Api Docs").
function titleCase(seg: string): string {
  return seg
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// order asc, then label asc — getRoutes() order is not guaranteed, so always tie-break.
function byOrderThenLabel(a: { order: number; label: string }, b: { order: number; label: string }) {
  return a.order - b.order || a.label.localeCompare(b.label)
}

interface NavLink {
  label: string
  icon?: string
  to: string
  order: number
}

/** One kit and the pages it owns (already sorted). */
export interface KitGroup {
  /** Kit display name, e.g. "Api Docs". */
  label: string
  /** Representative icon (first page's). */
  icon?: string
  /** Landing target = the kit's first page, so "Kits › <kit>" is clickable. */
  to: string
  pages: { label: string; icon?: string; to: string }[]
}

export interface GalleryNav {
  /** Top-level destinations rendered inline in the header ("Overview", …). */
  primary: NavigationMenuItem[]
  /** Kits, each a titled group — feeds the desktop "Kits" dropdown. */
  kits: KitGroup[]
  /** Full depth as a flat vertical list — feeds the mobile slideover menu. */
  tree: NavigationMenuItem[]
}

/**
 * Derive gallery navigation from the Nuxt route tree.
 * Adding a `pages/**` file = one more nav entry automatically;
 * hide a page with `definePageMeta({ nav: false })`.
 *
 * Returns three views of the same routes so each surface uses the shape it
 * renders best:
 * - `primary` + `kits` drive the desktop top-nav (inline links + a grouped
 *   "Kits" dropdown), sidestepping the two-level ceiling of the horizontal
 *   navigation menu by moving kit grouping into a dropdown.
 * - `tree` drives the mobile slideover, where a vertical navigation menu
 *   renders the full depth as accordions.
 */
export function useGalleryNav() {
  const router = useRouter()

  return computed<GalleryNav>(() => {
    const topLevel: NavLink[] = []
    const kitPages = new Map<string, NavLink[]>()

    for (const route of router.getRoutes()) {
      if (route.path.includes(':')) continue
      const meta = route.meta?.nav as false | NavMeta | undefined
      if (meta === false) continue

      const segs = route.path.replace(/^\/|\/$/g, '').split('/').filter(Boolean)
      const icon = meta?.icon
      const order = meta?.order ?? 99

      if (segs[0] === 'kits' && segs.length >= 2) {
        const kitName = segs[1]!
        const label = meta?.label ?? (segs.length === 2 ? 'Overview' : titleCase(segs[segs.length - 1]!))
        const pages = kitPages.get(kitName) ?? []
        pages.push({ label, icon, to: route.path, order })
        kitPages.set(kitName, pages)
        continue
      }

      if (segs.length <= 1) {
        const label = meta?.label ?? (segs.length === 0 ? 'Overview' : titleCase(segs[0]!))
        topLevel.push({ label, icon, to: route.path, order })
      }
    }

    const sortedTop = topLevel.sort(byOrderThenLabel)
    const primary: NavigationMenuItem[] = sortedTop.map(({ order: _o, ...link }) => link)

    const kits: KitGroup[] = [...kitPages.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([kitName, pages]) => {
        const sorted = pages.sort(byOrderThenLabel)
        return {
          label: titleCase(kitName),
          icon: sorted[0]?.icon,
          to: sorted[0]!.to,
          pages: sorted.map(({ order: _o, ...page }) => page),
        }
      })

    // Mobile tree: primary links, then a "Kits" heading, then one item per kit
    // (single-page → link; multi-page → accordion with its pages as children).
    const tree: NavigationMenuItem[] = [...primary]
    if (kits.length > 0) {
      tree.push({ label: 'Kits', type: 'label' })
      for (const kit of kits) {
        tree.push(
          kit.pages.length === 1
            ? { label: kit.label, icon: kit.icon, to: kit.pages[0]!.to }
            : { label: kit.label, icon: kit.icon, defaultOpen: true, children: kit.pages },
        )
      }
    }

    return { primary, kits, tree }
  })
}
