/**
 * Geist viewport breakpoints shared by Tailwind CSS and JavaScript behavior.
 * Keep these values aligned with the `--breakpoint-*` tokens in geist.css.
 */
export const GEIST_BREAKPOINTS = {
  sm: 401,
  md: 601,
  lg: 961,
  xl: 1200,
  '2xl': 1400,
} as const

export type GeistBreakpoint = keyof typeof GEIST_BREAKPOINTS

export function geistMinWidthQuery(breakpoint: GeistBreakpoint): string {
  return `(min-width: ${GEIST_BREAKPOINTS[breakpoint]}px)`
}
