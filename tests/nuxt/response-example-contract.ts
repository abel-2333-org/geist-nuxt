import type { ResponseStatus } from '../../kits/api-docs/components/ResponseExample.vue'

const legacyStatus = {
  status: 200,
  variants: [{ language: 'json', code: '{ "ok": true }' }],
} as const

// @ts-expect-error status-level variants cannot replace the required explicit bodies contract.
const rejectedLegacyStatus: ResponseStatus = legacyStatus

const explicitStatus: ResponseStatus = {
  status: 200,
  bodies: [{
    id: 'json',
    kind: 'code',
    variants: [{ language: 'json', code: '{ "ok": true }' }],
  }],
}

void rejectedLegacyStatus
void explicitStatus
