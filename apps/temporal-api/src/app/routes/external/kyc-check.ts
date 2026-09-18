import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { resolveKycOutcome } from '../../mocks/verification'
import { TwentyApiError } from '../../twenty/client'
import {
  CLOSE_LOST_STAGE,
  CLOSE_WON_STAGE,
  getOpportunity,
  updateOpportunityStage,
} from '../../twenty/opportunities'
import { sendVerificationOutcome } from '../../verification/respond'

const kycCheckRequestSchema = z.object({
  opportunityId: z.string().trim().min(1),
})

export default async function (fastify: FastifyInstance) {
  fastify.get('/kyc-check', async () => 'test')

  fastify.post('/kyc-check', async (request, reply) => {
    const parsed = kycCheckRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: 'Invalid request body.', issues: parsed.error.issues })
    }

    let opportunity
    try {
      opportunity = await getOpportunity(parsed.data.opportunityId)
    } catch (error) {
      if (error instanceof TwentyApiError) {
        return reply.code(error.status).send({ error: error.message })
      }
      throw error
    }

    if (!opportunity.idNumber) {
      return reply
        .code(409)
        .send({ error: 'Opportunity has no ID number on file yet.' })
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
          return reply.code(error.status).send({ error: error.message })
        }
        throw error
      }
    }

    return sendVerificationOutcome(reply, 'KYC', outcome)
  })
}
