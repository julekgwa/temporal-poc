import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  startOnboardingWorkflow,
  TemporalError,
} from '../../../temporal/client'

const startRequestSchema = z.object({
  opportunityId: z.string().trim().min(1),
  companyId: z.string().trim().min(1).optional(),
  personId: z.string().trim().min(1).optional(),
})

export default async function (fastify: FastifyInstance) {
  fastify.post('/start', async (request, reply) => {
    const parsed = startRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: 'Invalid request body.', issues: parsed.error.issues })
    }

    try {
      const { workflowId, started } = await startOnboardingWorkflow(
        parsed.data,
      )
      return { status: started ? 'STARTED' : 'ALREADY_RUNNING', workflowId }
    } catch (error) {
      if (error instanceof TemporalError) {
        return reply.code(error.status).send({ error: error.message })
      }
      throw error
    }
  })
}
