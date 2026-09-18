import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  signalOnboardingWorkflow,
  TemporalError,
} from '../../../temporal/client'
import { outcomeChangedSignal } from '../../../temporal/signals'

const outcomeRequestSchema = z.object({
  opportunityId: z.string().trim().min(1),
  outcome: z.enum(['CLOSED_WON', 'CLOSED_LOST']),
})

export default async function (fastify: FastifyInstance) {
  fastify.post('/outcome', async (request, reply) => {
    const parsed = outcomeRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: 'Invalid request body.', issues: parsed.error.issues })
    }

    try {
      const { workflowId, signal } = await signalOnboardingWorkflow(
        parsed.data.opportunityId,
        outcomeChangedSignal,
        {
          opportunityId: parsed.data.opportunityId,
          outcome: parsed.data.outcome,
        },
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
