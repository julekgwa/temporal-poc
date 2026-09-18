import type { FastifyReply } from 'fastify'
import type { VerificationOutcome } from '../mocks/verification'

export function sendVerificationOutcome(
  reply: FastifyReply,
  prefix: 'BAV' | 'KYC',
  outcome: VerificationOutcome,
) {
  switch (outcome.status) {
    case 'VERIFIED':
      return reply.send({
        status: 'VERIFIED',
        reference: `${prefix}-${crypto.randomUUID()}`,
      })
    case 'REJECTED':
      return reply
        .code(422)
        .send({ status: 'REJECTED', reason: outcome.reason })
    case 'ERROR':
      return reply.code(outcome.httpStatus).send({ error: outcome.message })
  }
}
