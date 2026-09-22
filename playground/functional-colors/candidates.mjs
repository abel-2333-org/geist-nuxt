// Isolated preview only. The baseline always uses unmodified production CSS.
export const roles = ['primary', 'secondary', 'success', 'info', 'warning', 'error']
export const mapping = {
  light: { primary: '#6b30cf', secondary: '#06695e', success: '#246a32', info: '#0058bd', warning: '#7b4207', error: '#b52329' },
  dark: { primary: '#bb8cff', secondary: '#45dec5', success: '#6cda75', info: '#52aeff', warning: '#f4b740', error: '#ff8588' },
}
export function candidateCSS(mode = 'recommended') {
  if (mode === 'baseline') return ''
  const css = []
  for (const [theme, values] of Object.entries(mapping)) {
    const scope = `html.${theme}[data-functional-preview="${mode}"]`
    css.push(`${scope} { ${Object.entries(values).map(([role, value]) => `--ui-${role}:${value};`).join('')} }`)
    for (const role of roles) {
      // Match existing Nuxt UI utility consumers; no normal gallery CSS is changed.
      const solid = `${scope} :is(button,a):not(:disabled):not([aria-disabled="true"])[class~="hover:bg-${role}/75"]`
      const link = `${scope} :is(button,a):not(:disabled):not([aria-disabled="true"])[class~="hover:text-${role}/75"]`
      const toward = theme === 'light' ? 'black' : 'white'
      css.push(`${solid}:hover {background-color:color-mix(in srgb,var(--ui-${role}) 90%,${toward});}`)
      css.push(`${solid}:active {background-color:color-mix(in srgb,var(--ui-${role}) 80%,${toward});}`)
      css.push(`${link}:hover,${link}:active {color:var(--ui-${role});text-decoration-line:underline;}`)
      // Only colored Alert roots. Neutral Alert opacity remains untouched.
      for (const colorClass of [`bg-${role}`, `text-${role}`]) {
        css.push(`${scope} [data-slot="root"][data-orientation][class~="${colorClass}"] > [data-slot="wrapper"] > [data-slot="description"] {opacity:1;}`)
      }
    }
  }
  if (mode === 'amber-solid') {
    const scope = 'html.light[data-functional-preview="amber-solid"]'
    css.push(`${scope} [class~="bg-warning"][class~="text-inverted"] {background-color:var(--ui-color-warning-500);color:var(--ui-text);}`)
    css.push(`${scope} :is(button,a):not(:disabled):not([aria-disabled="true"])[class~="hover:bg-warning/75"]:hover {background-color:var(--ui-color-warning-400);color:var(--ui-text);}`)
    css.push(`${scope} :is(button,a):not(:disabled):not([aria-disabled="true"])[class~="hover:bg-warning/75"]:active {background-color:var(--ui-color-warning-300);color:var(--ui-text);}`)
  }
  return css.join('\n')
}
