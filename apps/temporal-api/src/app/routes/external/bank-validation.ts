import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { resolveBavOutcome } from '../../mocks/verification'
import { TwentyApiError } from '../../twenty/client'
import { getOpportunity, updateOpportunity } from '../../twenty/opportunities'
import { sendVerificationOutcome } from '../../verification/respond'

const bankValidationRequestSchema = z.object({
  opportunityId: z.string().trim().min(1),
})

export default async function (fastify: FastifyInstance) {
  fastify.post('/bank-validation', async (request, reply) => {
    console.log('Handling BAV request...')
    const parsed = bankValidationRequestSchema.safeParse(request.body)
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

    if (!opportunity.accountNumber) {
      return reply.code(409).send({
        error: 'Opportunity has no bank account details on file yet.',
      })
    }

    const outcome = resolveBavOutcome(opportunity.accountNumber)

    if (outcome.status !== 'ERROR') {
      try {
        await updateOpportunity(opportunity.id, {
          bankAccountVerified: outcome.status === 'VERIFIED',
        })
      } catch (error) {
        if (error instanceof TwentyApiError) {
          return reply.code(error.status).send({ error: error.message })
        }
        throw error
      }
    }

    return sendVerificationOutcome(reply, 'BAV', outcome)
  })
}
