import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  signalOnboardingWorkflow,
  TemporalError,
} from '../../../temporal/client'
import { bavRequestedSignal } from '../../../temporal/signals'

const bavRequestSchema = z.object({
  opportunityId: z.string().trim().min(1),
})

export default async function (fastify: FastifyInstance) {
  fastify.post('/bav', async (request, reply) => {
    const parsed = bavRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: 'Invalid request body.', issues: parsed.error.issues })
    }

    try {
      const { workflowId, signal } = await signalOnboardingWorkflow(
        parsed.data.opportunityId,
        bavRequestedSignal,
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
