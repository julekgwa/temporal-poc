import {
  Client,
  Connection,
  WorkflowExecutionAlreadyStartedError,
  WorkflowNotFoundError,
} from '@temporalio/client'
import type { SignalDefinition } from '@temporalio/workflow'

const DEFAULT_TEMPORAL_ADDRESS = 'localhost:7233'
const DEFAULT_TEMPORAL_NAMESPACE = 'default'
const DEFAULT_TASK_QUEUE = 'onboarding'
const ONBOARDING_WORKFLOW_TYPE = 'onboardingWorkflow'

export class TemporalError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'TemporalError'
  }
}

let clientPromise: Promise<Client> | undefined

function getTemporalConfig() {
  return {
    address: process.env.TEMPORAL_ADDRESS || DEFAULT_TEMPORAL_ADDRESS,
    namespace: process.env.TEMPORAL_NAMESPACE || DEFAULT_TEMPORAL_NAMESPACE,
    taskQueue: process.env.TEMPORAL_TASK_QUEUE || DEFAULT_TASK_QUEUE,
  }
}

async function getTemporalClient(): Promise<Client> {
  clientPromise ??= (async () => {
    const { address, namespace } = getTemporalConfig()
    const connection = await Connection.connect({ address })
    return new Client({ connection, namespace })
  })().catch((error: unknown) => {
    clientPromise = undefined
    throw error
  })

  return clientPromise
}

export async function closeTemporalConnection(): Promise<void> {
  const current = clientPromise
  if (!current) return
  clientPromise = undefined
  const client = await current.catch(() => undefined)
  await client?.connection.close()
}

export function onboardingWorkflowId(opportunityId: string) {
  return `onboarding:${opportunityId}`
}

export async function signalOnboardingWorkflow<TArgs extends unknown[]>(
  opportunityId: string,
  signal: SignalDefinition<TArgs>,
  ...args: TArgs
): Promise<{ workflowId: string; signal: string }> {
  const workflowId = onboardingWorkflowId(opportunityId)

  try {
    const client = await getTemporalClient()
    await client.workflow.getHandle(workflowId).signal(signal, ...args)
  } catch (error) {
    console.error('[Temporal]', { workflowId, signal: signal.name, error })

    if (error instanceof WorkflowNotFoundError) {
      throw new TemporalError(
        `No onboarding workflow is running for this opportunity.`,
        404,
        error,
      )
    }

    throw new TemporalError(
      `Could not signal the onboarding workflow (${signal.name}).`,
      502,
      error,
    )
  }

  return { workflowId, signal: signal.name }
}

export type OnboardingWorkflowInput = {
  opportunityId: string
  companyId?: string
  personId?: string
}

export async function startOnboardingWorkflow(
  input: OnboardingWorkflowInput,
): Promise<{ workflowId: string; started: boolean }> {
  const workflowId = onboardingWorkflowId(input.opportunityId)

  try {
    const client = await getTemporalClient()
    const { taskQueue } = getTemporalConfig()
    await client.workflow.start(ONBOARDING_WORKFLOW_TYPE, {
      workflowId,
      taskQueue,
      args: [input],
    })
  } catch (error) {
    if (error instanceof WorkflowExecutionAlreadyStartedError) {
      return { workflowId, started: false }
    }

    console.error('[Temporal]', { workflowId, action: 'start', error })
    throw new TemporalError(
      'Could not start the onboarding workflow.',
      502,
      error,
    )
  }

  return { workflowId, started: true }
}
