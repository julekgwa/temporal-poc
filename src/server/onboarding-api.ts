import { z } from 'zod'

export const verificationRequestSchema = z.object({
  opportunityId: z.string().trim().min(1),
  accountId: z.string().trim().min(1).optional(),
})

export const bavRequestSchema = verificationRequestSchema.extend({
  bankName: z.string().trim().min(1),
  accountHolder: z.string().trim().min(1),
  accountNumber: z.string().trim().min(1),
  branchCode: z.string().trim().min(1),
})

export const kycRequestSchema = verificationRequestSchema.extend({
  identityDocument: z.string().trim().min(1),
  proofOfAddress: z.string().trim().min(1),
})

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
