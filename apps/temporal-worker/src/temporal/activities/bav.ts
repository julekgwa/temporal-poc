import { postVerificationRequest } from './verification-request'
import type { VerificationActivityResult } from './types'

export async function verifyBav(
  opportunityId: string,
): Promise<VerificationActivityResult> {
  return postVerificationRequest(
    '/external/bank-validation',
    opportunityId,
    'BAV verification',
  )
}
