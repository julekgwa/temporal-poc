import * as path from 'node:path'
import { NativeConnection, Worker } from '@temporalio/worker'
import * as activities from './temporal/activities'

const DEFAULT_TEMPORAL_ADDRESS = 'localhost:7233'
const DEFAULT_TEMPORAL_NAMESPACE = 'default'
const DEFAULT_TASK_QUEUE = 'onboarding'

export async function runWorker(): Promise<void> {
  const address = process.env.TEMPORAL_ADDRESS || DEFAULT_TEMPORAL_ADDRESS
  const namespace =
    process.env.TEMPORAL_NAMESPACE || DEFAULT_TEMPORAL_NAMESPACE
  const taskQueue = process.env.TEMPORAL_TASK_QUEUE || DEFAULT_TASK_QUEUE

  const connection = await NativeConnection.connect({ address })

  try {
    const worker = await Worker.create({
      connection,
      namespace,
      taskQueue,
      workflowsPath: path.join(
        __dirname,
        'temporal/workflows/onboarding.js',
      ),
      activities,
    })

    console.log(
      `[ ready ] worker polling task queue "${taskQueue}" at ${address}`,
    )
    await worker.run()
  } finally {
    await connection.close()
  }
}
