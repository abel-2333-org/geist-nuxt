/**
 * OPINIONATED PRESET: fallback display label for a code language id.
 *
 * Mirrors `method-preset.ts` / `lifecycle-preset.ts` — the layer that "knows"
 * the language vocabulary, shared by CodeBlock (language select) and
 * ResponseExample (media select fallback) so the same id always renders the
 * same label. Used only when a variant doesn't carry its own `label`; caller
 * overrides (`languageLabels`) win over this preset.
 */
export const langPreset: Record<string, string> = {
  curl: 'cURL',
  json: 'JSON',
  node: 'Node',
  nodejs: 'Node',
  javascript: 'JavaScript',
  js: 'JavaScript',
  python: 'Python',
  py: 'Python',
  go: 'Go',
  http: 'HTTP',
  bash: 'Shell',
  shell: 'Shell',
}

/**
 * Resolve a language id to its display label: overrides → preset → capitalized id.
 *
 * Language ids are matched case-insensitively — `'JSON'`, `'Json'` and
 * `'json'` all resolve the same preset entry, and an override keyed
 * `{ Python: 'Python 3' }` applies to `'python'` just as `{ python: … }`
 * applies to `'Python'`. Callers never have to normalise their keys to hit
 * the override table; when several keys differ only by case, the exact
 * lowercase key wins.
 */
export function langLabel(id: string, overrides: Record<string, string> = {}): string {
  const key = id.toLowerCase()
  const override = overrides[key]
    ?? Object.entries(overrides).find(([candidate]) => candidate.toLowerCase() === key)?.[1]
  return override ?? langPreset[key] ?? id.charAt(0).toUpperCase() + id.slice(1)
}
