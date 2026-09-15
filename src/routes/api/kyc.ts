import { createFileRoute } from '@tanstack/react-router'
import {
  parseJson,
  kycRequestSchema,
  verificationResponse,
} from '../../server/onboarding-api'

export const Route = createFileRoute('/api/kyc')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = await parseJson(request, kycRequestSchema)
        if ('error' in parsed) return parsed.error

        return Response.json(verificationResponse('KYC'))
      },
    },
  },
})
