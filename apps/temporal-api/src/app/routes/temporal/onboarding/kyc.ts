import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  signalOnboardingWorkflow,
  TemporalError,
} from '../../../temporal/client'
import { kycRequestedSignal } from '../../../temporal/signals'

const kycRequestSchema = z.object({
  opportunityId: z.string().trim().min(1),
})

export default async function (fastify: FastifyInstance) {
  fastify.post('/kyc', async (request, reply) => {
    const parsed = kycRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: 'Invalid request body.', issues: parsed.error.issues })
    }

    try {
      const { workflowId, signal } = await signalOnboardingWorkflow(
        parsed.data.opportunityId,
        kycRequestedSignal,
        { opportunityId: parsed.data.opportunityId },
      )
      return { status: 'SIGNALED', workflowId, signal }
    } catch (error) {
      if (error instanceof TemporalError) {
        return reply.code(error.status).send({ error: error.message })
      }
      throw error
    }
  })
}
