import { getTemporalApiUrl } from './config'
import type { VerificationActivityResult } from './types'

export async function postVerificationRequest(
  path: string,
  opportunityId: string,
  failureLabel: string,
): Promise<VerificationActivityResult> {
  const response = await fetch(`${getTemporalApiUrl()}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ opportunityId }),
  })

  if (response.status === 422) {
    const body = (await response.json()) as { reason: string }
    return { status: 'REJECTED', reason: body.reason }
  }

  if (!response.ok) {
    const body = (await response
      .json()
      .catch(() => ({}))) as { error?: string }
    throw new Error(
      `${failureLabel} failed (${response.status}): ${body.error ?? response.statusText}`,
    )
  }

  return (await response.json()) as VerificationActivityResult
}
