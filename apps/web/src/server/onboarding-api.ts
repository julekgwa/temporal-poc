import { z } from 'zod'
import type { VerificationOutcome } from './mocks/verification'

export const verificationRequestSchema = z.object({
  opportunityId: z.string().trim().min(1),
})

export const bavRequestSchema = verificationRequestSchema
export const kycRequestSchema = verificationRequestSchema

export type VerificationResponse = {
  status: 'VERIFIED'
  reference: string
}

export async function parseJson<T>(request: Request, schema: z.ZodType<T>) {
  try {
    const body: unknown = await request.json()
    const result = schema.safeParse(body)
    if (!result.success) {
      return {
        error: Response.json(
          { error: 'Invalid request body.', issues: result.error.issues },
          { status: 400 },
        ),
      } as const
    }
    return { data: result.data } as const
  } catch {
    return {
      error: Response.json(
        { error: 'Request body must be valid JSON.' },
        { status: 400 },
      ),
    } as const
  }
}

export function verificationResponse(
  prefix: 'BAV' | 'KYC',
): VerificationResponse {
  return { status: 'VERIFIED', reference: `${prefix}-${crypto.randomUUID()}` }
}

export function verificationOutcomeResponse(
  prefix: 'BAV' | 'KYC',
  outcome: VerificationOutcome,
): Response {
  switch (outcome.status) {
    case 'VERIFIED':
      return Response.json(verificationResponse(prefix))
    case 'REJECTED':
      return Response.json(
        { status: 'REJECTED', reason: outcome.reason },
        { status: 422 },
      )
    case 'ERROR':
      return Response.json(
        { error: outcome.message },
        { status: outcome.httpStatus },
      )
  }
}
