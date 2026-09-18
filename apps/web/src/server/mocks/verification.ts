// Simulated third-party verification vendor responses, selected by a magic
// input value so the happy path and each failure mode can be triggered on
// demand (from the UI, a script, or a Temporal activity) without a real vendor.

export type VerificationOutcome =
  | { status: 'VERIFIED' }
  | { status: 'REJECTED'; reason: string }
  | { status: 'ERROR'; message: string; httpStatus: number }

const BAV_MOCKS: Record<string, VerificationOutcome> = {
  '0000000000': {
    status: 'REJECTED',
    reason: 'Account number does not match the account holder name on file.',
  },
  '0000000001': {
    status: 'REJECTED',
    reason: 'Bank account is closed or dormant.',
  },
  '1111111111': {
    status: 'ERROR',
    message: 'Bank verification service is temporarily unavailable.',
    httpStatus: 503,
  },
  '2222222222': {
    status: 'ERROR',
    message: 'Bank verification request timed out.',
    httpStatus: 504,
  },
}

const KYC_MOCKS: Record<string, VerificationOutcome> = {
  '0000000000000': {
    status: 'REJECTED',
    reason: 'ID number could not be matched against Home Affairs records.',
  },
  '0000000000001': {
    status: 'REJECTED',
    reason: 'Applicant appears on a sanctions watchlist.',
  },
  '1111111111111': {
    status: 'ERROR',
    message: 'KYC verification service is temporarily unavailable.',
    httpStatus: 503,
  },
  '2222222222222': {
    status: 'ERROR',
    message: 'KYC verification request timed out.',
    httpStatus: 504,
  },
}

export function resolveBavOutcome(accountNumber: string): VerificationOutcome {
  return BAV_MOCKS[accountNumber] ?? { status: 'VERIFIED' }
}

export function resolveKycOutcome(idNumber: string): VerificationOutcome {
  return KYC_MOCKS[idNumber] ?? { status: 'VERIFIED' }
}
