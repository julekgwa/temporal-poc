import { createFileRoute } from '@tanstack/react-router'
import {
  parseJson,
  bavRequestSchema,
  verificationOutcomeResponse,
} from '../../server/onboarding-api'
import { resolveBavOutcome } from '../../server/mocks/verification'
import {
  getOpportunity,
  updateOpportunity,
} from '../../server/twenty/opportunities'
import { TwentyApiError } from '../../server/twenty/client'

export const Route = createFileRoute('/api/bav')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        console.log('Handling BAV request...')
        const parsed = await parseJson(request, bavRequestSchema)
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

        if (!opportunity.accountNumber) {
          return Response.json(
            { error: 'Opportunity has no bank account details on file yet.' },
            { status: 409 },
          )
        }

        const outcome = resolveBavOutcome(opportunity.accountNumber)

        if (outcome.status !== 'ERROR') {
          try {
            await updateOpportunity(opportunity.id, {
              bankAccountVerified: outcome.status === 'VERIFIED',
            })
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

        return verificationOutcomeResponse('BAV', outcome)
      },
    },
  },
})
