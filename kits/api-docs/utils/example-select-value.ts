/**
 * Reka reserves '' for clearing a select. These document controls have string
 * identities and no native form name, so numeric 0 can represent an empty id
 * without colliding with the literal string '0'. Keep undefined unselected.
 */
export function toExampleSelectValue(id: string | undefined): string | 0 | undefined {
  return id === '' ? 0 : id
}

export function fromExampleSelectValue(value: string | 0 | undefined): string | undefined {
  return value === 0 ? '' : value
}
