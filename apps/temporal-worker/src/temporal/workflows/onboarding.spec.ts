import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { TestWorkflowEnvironment } from '@temporalio/testing'
import { Worker } from '@temporalio/worker'
import type { WorkflowHandle } from '@temporalio/client'
import { bindIdempotencyKey, onboardingWorkflow } from './onboarding'
import type { OnboardingWorkflowResult } from './onboarding'
import type { VerificationActivityResult } from '../activities/types'
import type { BindResult } from '../activities/bind'

const VERIFIED = (reference: string): VerificationActivityResult => ({
  status: 'VERIFIED',
  reference,
})
const REJECTED = (reason: string): VerificationActivityResult => ({
  status: 'REJECTED',
  reason,
})

let testEnv: TestWorkflowEnvironment
let seq = 0

function uniqueId(prefix: string) {
  seq += 1
  return `${prefix}-${Date.now()}-${seq}`
}

async function waitFor(
  predicate: () => boolean,
  { timeoutMs = 5_000, intervalMs = 50 } = {},
) {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('waitFor: timed out waiting for condition')
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}

type Activities = {
  verifyBav: ReturnType<typeof vi.fn<(opportunityId: string) => Promise<VerificationActivityResult>>>
  verifyKyc: ReturnType<typeof vi.fn<(opportunityId: string) => Promise<VerificationActivityResult>>>
  bind: ReturnType<typeof vi.fn<(opportunityId: string, idempotencyKey: string) => Promise<BindResult>>>
}

function createActivityMocks(): Activities {
  return {
    verifyBav: vi.fn(),
    verifyKyc: vi.fn(),
    bind: vi.fn(async (_opportunityId: string, idempotencyKey: string) => ({
      status: 'BOUND' as const,
      reference: `BIND-${idempotencyKey}`,
    })),
  }
}

async function withWorkflow(
  activities: Activities,
  run: (context: {
    handle: WorkflowHandle<typeof onboardingWorkflow>
    opportunityId: string
  }) => Promise<void>,
) {
  const taskQueue = uniqueId('task-queue')
  const opportunityId = uniqueId('opp')

  const worker = await Worker.create({
    connection: testEnv.nativeConnection,
    taskQueue,
    workflowsPath: fileURLToPath(new URL('./onboarding.ts', import.meta.url)),
    activities,
  })

  await worker.runUntil(async () => {
    const handle = await testEnv.client.workflow.start(onboardingWorkflow, {
      workflowId: `onboarding:${opportunityId}`,
      taskQueue,
      args: [{ opportunityId }],
    })

    await run({ handle, opportunityId })
  })
}

beforeAll(async () => {
  testEnv = await TestWorkflowEnvironment.createLocal()
}, 120_000)

afterAll(async () => {
  await testEnv.teardown()
})

describe('onboardingWorkflow', () => {
  it('proceeds to KYC once BAV is VERIFIED', async () => {
    const activities = createActivityMocks()
    activities.verifyBav.mockResolvedValue(VERIFIED('BAV-1'))
    activities.verifyKyc.mockResolvedValue(VERIFIED('KYC-1'))

    await withWorkflow(activities, async ({ handle, opportunityId }) => {
      await handle.signal('bavRequested', { opportunityId: '' })
      await waitFor(() => activities.verifyBav.mock.calls.length === 1)

      await handle.signal('kycRequested', { opportunityId: '' })
      await waitFor(() => activities.verifyKyc.mock.calls.length === 1)

      await handle.signal('outcomeChanged', { outcome: 'CLOSED_WON' })
      const result: OnboardingWorkflowResult = await handle.result()

      expect(result.bavStatus).toBe('VERIFIED')
      expect(result.kycStatus).toBe('VERIFIED')
      expect(result.outcome).toBe('CLOSED_WON')
      expect(result.bind).toEqual({
        status: 'BOUND',
        reference: `BIND-${bindIdempotencyKey(opportunityId)}`,
      })
    })
  })

  it('waits when BAV is REJECTED, and does not call KYC', async () => {
    const activities = createActivityMocks()
    activities.verifyBav.mockResolvedValue(REJECTED('bad account number'))

    await withWorkflow(activities, async ({ handle }) => {
      await handle.signal('bavRequested', { opportunityId: '' })
      await waitFor(() => activities.verifyBav.mock.calls.length === 1)

      // Give the workflow a beat to (incorrectly) proceed, if it were going to.
      await new Promise((resolve) => setTimeout(resolve, 300))

      expect(activities.verifyKyc).not.toHaveBeenCalled()
      const description = await handle.describe()
      expect(description.status.name).toBe('RUNNING')
    })
  })

  it('re-attempts BAV on a second bavRequested and proceeds once VERIFIED', async () => {
    const activities = createActivityMocks()
    activities.verifyBav
      .mockResolvedValueOnce(REJECTED('bad account number'))
      .mockResolvedValueOnce(VERIFIED('BAV-2'))
    activities.verifyKyc.mockResolvedValue(VERIFIED('KYC-2'))

    await withWorkflow(activities, async ({ handle }) => {
      await handle.signal('bavRequested', { opportunityId: '' })
      await waitFor(() => activities.verifyBav.mock.calls.length === 1)
      expect(activities.verifyKyc).not.toHaveBeenCalled()

      await handle.signal('bavRequested', { opportunityId: '' })
      await waitFor(() => activities.verifyBav.mock.calls.length === 2)

      await handle.signal('kycRequested', { opportunityId: '' })
      await waitFor(() => activities.verifyKyc.mock.calls.length === 1)

      await handle.signal('outcomeChanged', { outcome: 'CLOSED_LOST' })
      const result = await handle.result()

      expect(result.bavStatus).toBe('VERIFIED')
      expect(result.outcome).toBe('CLOSED_LOST')
      expect(activities.bind).not.toHaveBeenCalled()
    })
  })

  it('waits when KYC is REJECTED, then proceeds once retried and VERIFIED', async () => {
    const activities = createActivityMocks()
    activities.verifyBav.mockResolvedValue(VERIFIED('BAV-3'))
    activities.verifyKyc
      .mockResolvedValueOnce(REJECTED('id mismatch'))
      .mockResolvedValueOnce(VERIFIED('KYC-3'))

    await withWorkflow(activities, async ({ handle }) => {
      await handle.signal('bavRequested', { opportunityId: '' })
      await waitFor(() => activities.verifyBav.mock.calls.length === 1)

      await handle.signal('kycRequested', { opportunityId: '' })
      await waitFor(() => activities.verifyKyc.mock.calls.length === 1)

      await new Promise((resolve) => setTimeout(resolve, 300))
      const description = await handle.describe()
      expect(description.status.name).toBe('RUNNING')
      expect(activities.bind).not.toHaveBeenCalled()

      await handle.signal('kycRequested', { opportunityId: '' })
      await waitFor(() => activities.verifyKyc.mock.calls.length === 2)

      await handle.signal('outcomeChanged', { outcome: 'CLOSED_WON' })
      const result = await handle.result()

      expect(result.kycStatus).toBe('VERIFIED')
      expect(result.outcome).toBe('CLOSED_WON')
      expect(activities.bind).toHaveBeenCalledTimes(1)
    })
  })

  it('does not BIND on CLOSED_WON while BAV is REJECTED', async () => {
    const activities = createActivityMocks()
    activities.verifyBav.mockResolvedValue(REJECTED('bad account number'))

    await withWorkflow(activities, async ({ handle }) => {
      await handle.signal('bavRequested', { opportunityId: '' })
      await waitFor(() => activities.verifyBav.mock.calls.length === 1)

      await handle.signal('outcomeChanged', { outcome: 'CLOSED_WON' })
      await new Promise((resolve) => setTimeout(resolve, 300))

      expect(activities.bind).not.toHaveBeenCalled()
      const description = await handle.describe()
      expect(description.status.name).toBe('RUNNING')
    })
  })

  it('does not BIND on CLOSED_WON while KYC is REJECTED', async () => {
    const activities = createActivityMocks()
    activities.verifyBav.mockResolvedValue(VERIFIED('BAV-4'))
    activities.verifyKyc.mockResolvedValue(REJECTED('id mismatch'))

    await withWorkflow(activities, async ({ handle }) => {
      await handle.signal('bavRequested', { opportunityId: '' })
      await waitFor(() => activities.verifyBav.mock.calls.length === 1)

      await handle.signal('kycRequested', { opportunityId: '' })
      await waitFor(() => activities.verifyKyc.mock.calls.length === 1)

      await handle.signal('outcomeChanged', { outcome: 'CLOSED_WON' })
      await new Promise((resolve) => setTimeout(resolve, 300))

      expect(activities.bind).not.toHaveBeenCalled()
      const description = await handle.describe()
      expect(description.status.name).toBe('RUNNING')
    })
  })

  it('executes BIND when CLOSED_WON with BAV and KYC both VERIFIED', async () => {
    const activities = createActivityMocks()
    activities.verifyBav.mockResolvedValue(VERIFIED('BAV-5'))
    activities.verifyKyc.mockResolvedValue(VERIFIED('KYC-5'))

    await withWorkflow(activities, async ({ handle, opportunityId }) => {
      await handle.signal('bavRequested', { opportunityId: '' })
      await waitFor(() => activities.verifyBav.mock.calls.length === 1)

      await handle.signal('kycRequested', { opportunityId: '' })
      await waitFor(() => activities.verifyKyc.mock.calls.length === 1)

      await handle.signal('outcomeChanged', { outcome: 'CLOSED_WON' })
      const result = await handle.result()

      expect(activities.bind).toHaveBeenCalledTimes(1)
      expect(activities.bind).toHaveBeenCalledWith(
        opportunityId,
        bindIdempotencyKey(opportunityId),
      )
      expect(result.bind?.reference).toBe(
        `BIND-${bindIdempotencyKey(opportunityId)}`,
      )
    })
  })

  it('completes on CLOSED_LOST without executing BIND', async () => {
    const activities = createActivityMocks()
    activities.verifyBav.mockResolvedValue(VERIFIED('BAV-6'))
    activities.verifyKyc.mockResolvedValue(VERIFIED('KYC-6'))

    await withWorkflow(activities, async ({ handle }) => {
      await handle.signal('bavRequested', { opportunityId: '' })
      await waitFor(() => activities.verifyBav.mock.calls.length === 1)

      await handle.signal('kycRequested', { opportunityId: '' })
      await waitFor(() => activities.verifyKyc.mock.calls.length === 1)

      await handle.signal('outcomeChanged', { outcome: 'CLOSED_LOST' })
      const result = await handle.result()

      expect(result.outcome).toBe('CLOSED_LOST')
      expect(result.bind).toBeUndefined()
      expect(activities.bind).not.toHaveBeenCalled()
    })
  })

  it('completes on CLOSED_LOST even while stuck waiting on a rejected BAV', async () => {
    const activities = createActivityMocks()
    activities.verifyBav.mockResolvedValue(REJECTED('bad account number'))

    await withWorkflow(activities, async ({ handle }) => {
      await handle.signal('bavRequested', { opportunityId: '' })
      await waitFor(() => activities.verifyBav.mock.calls.length === 1)

      await handle.signal('outcomeChanged', { outcome: 'CLOSED_LOST' })
      const result = await handle.result()

      expect(result.bavStatus).toBe('REJECTED')
      expect(result.outcome).toBe('CLOSED_LOST')
      expect(activities.verifyKyc).not.toHaveBeenCalled()
      expect(activities.bind).not.toHaveBeenCalled()
    })
  })
})

describe('bind idempotency', () => {
  it('produces the same reference for the same idempotency key on repeat calls', async () => {
    const { bind } = await import('../activities/bind')
    const key = bindIdempotencyKey('opp-idempotency-test')

    const first = await bind('opp-idempotency-test', key)
    const second = await bind('opp-idempotency-test', key)

    expect(first.reference).toBe(second.reference)
    expect(first.reference).toBe(`BIND-${key}`)
  })
})
