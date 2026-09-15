import { createFileRoute } from '@tanstack/react-router'
import {
  parseJson,
  bavRequestSchema,
  verificationResponse,
} from '../../server/onboarding-api'

export const Route = createFileRoute('/api/bav')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = await parseJson(request, bavRequestSchema)
        if ('error' in parsed) return parsed.error

        return Response.json(verificationResponse('BAV'))
      },
    },
  },
})
