import { createFileRoute } from '@tanstack/react-router'
import {
  parseJson,
  kycRequestSchema,
  verificationOutcomeResponse,
} from '../../server/onboarding-api'
import { resolveKycOutcome } from '../../server/mocks/verification'
import {
  CLOSE_LOST_STAGE,
  CLOSE_WON_STAGE,
  getOpportunity,
  updateOpportunityStage,
} from '../../server/twenty/opportunities'
import { TwentyApiError } from '../../server/twenty/client'

export const Route = createFileRoute('/api/kyc')({
  server: {
    handlers: {
      GET: async () => new Response('test'),
      POST: async ({ request }) => {
        const parsed = await parseJson(request, kycRequestSchema)
        if ('error' in parsed) return parsed.error

        let opportunity
        try {
          opportunity = await getOpportunity(parsed.data.opportunityId)
        } catch (error) {
          if (error instanceof TwentyApiError) {
            return Response.json(
              { error: error.message },
              { status: error.status },
            )
          }
          throw error
        }

        if (!opportunity.idNumber) {
          return Response.json(
            { error: 'Opportunity has no ID number on file yet.' },
            { status: 409 },
          )
        }

        const outcome = resolveKycOutcome(opportunity.idNumber)

        if (outcome.status !== 'ERROR') {
          try {
            await updateOpportunityStage(
              opportunity.id,
              outcome.status === 'VERIFIED' ? CLOSE_WON_STAGE : CLOSE_LOST_STAGE,
            )
          } catch (error) {
            if (error instanceof TwentyApiError) {
              return Response.json(
                { error: error.message },
                { status: error.status },
              )
            }
            throw error
          }
        }

        return verificationOutcomeResponse('KYC', outcome)
      },
    },
  },
})
