import { postVerificationRequest } from './verification-request'
import type { VerificationActivityResult } from './types'

export async function verifyKyc(
  opportunityId: string,
): Promise<VerificationActivityResult> {
  return postVerificationRequest(
    '/external/kyc-check',
    opportunityId,
    'KYC verification',
  )
}
