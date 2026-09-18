export type VerificationActivityResult =
  | { status: 'VERIFIED'; reference: string }
  | { status: 'REJECTED'; reason: string }
