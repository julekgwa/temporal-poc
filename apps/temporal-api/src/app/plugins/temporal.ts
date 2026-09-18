import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import { closeTemporalConnection } from '../temporal/client'

/**
 * Closes the cached Temporal SDK connection when the server shuts down, so
 * the gRPC channel doesn't keep the process alive or leak on reload.
 */
export default fp(async function (fastify: FastifyInstance) {
  fastify.addHook('onClose', async () => {
    await closeTemporalConnection()
  })
})
