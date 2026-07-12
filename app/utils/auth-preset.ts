import type { AuthRequirement, AuthScheme } from '~/types/domain'

// ---------------------------------------------------------------------------
// Auth preset: the opinionated, OVERRIDABLE mapping from an auth scheme to its
// presentation. Same pattern as `lifecycle-preset.ts` — the AuthMethod
// component stays scheme-agnostic (renders icon + title + summary + params),
// and all "what does body-sign look like / how do we word it" decisions live
// here where a consuming project can override or extend them (add oauth2, etc.)
// without touching the component. Copy lives here too (the i18n seam).
// ---------------------------------------------------------------------------

/** A labelled parameter chip rendered in a method's detail grid. */
export interface AuthParam {
  /** Short caption, e.g. 'Field', 'Algorithm', 'Header'. */
  label: string
  /** The value, rendered as an inline code token (identifier / algorithm id). */
  value: string
  /** Render the value as monospace code (identifiers) vs plain text. */
  code?: boolean
}

export interface AuthPresetEntry {
  /** Lucide icon id for the leading marker. */
  icon: string
  /** Human title for the method, e.g. 'Request signing'. */
  title: string
  /** One-line plain-language summary of what the caller must do. */
  summary: (req: AuthRequirement) => string
  /** Structured at-a-glance parameters shown as labelled code chips (may be empty). */
  params: (req: AuthRequirement) => AuthParam[]
}

/**
 * Default presentation for each scheme. Override by spreading:
 *   const preset = { ...authPreset, 'oauth2': { … } }
 */
export const authPreset: Record<AuthScheme, AuthPresetEntry> = {
  'body-sign': {
    icon: 'i-lucide-file-signature',
    title: 'Request signing',
    summary: () =>
      'Every request must carry a signature. Onerway recomputes it on arrival and rejects the request if it does not match.',
    params: () => [],
  },
  'header-api-key': {
    icon: 'i-lucide-key-round',
    title: 'API key',
    summary: () =>
      'Send your account API key on every request in the header below. Use the key that matches the environment of your base URL.',
    params: (req) => {
      if (req.scheme !== 'header-api-key') return []
      return [{ label: 'Header', value: req.header, code: true }]
    },
  },
  'ip-allowlist': {
    icon: 'i-lucide-shield-check',
    title: 'IP allowlist',
    summary: () =>
      'Requests are accepted only from server IP addresses you have allowlisted. Calls from any other origin are rejected before processing.',
    params: () => [],
  },
}
