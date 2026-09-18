import { condition, proxyActivities, setHandler } from '@temporalio/workflow'
import type * as activities from '../activities'
import {
  bavRequestedSignal,
  kycRequestedSignal,
  outcomeChangedSignal,
} from '../signals'

const { verifyBav, verifyKyc, bind } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
})

export type OnboardingWorkflowInput = {
  opportunityId: string
  companyId?: string
  personId?: string
}

export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED'

export type OnboardingState = {
  bavStatus?: VerificationStatus
  bavReason?: string
  kycStatus?: VerificationStatus
  kycReason?: string
  outcome?: 'CLOSED_WON' | 'CLOSED_LOST'
}

export type OnboardingWorkflowResult = OnboardingState & {
  bind?: Awaited<ReturnType<typeof bind>>
}

export function bindIdempotencyKey(opportunityId: string) {
  return `onboarding:${opportunityId}:bind`
}

export async function onboardingWorkflow(
  input: OnboardingWorkflowInput,
): Promise<OnboardingWorkflowResult> {
  const { opportunityId } = input

  const state: OnboardingState = {}
  let bavRequestCount = 0
  let kycRequestCount = 0

  setHandler(bavRequestedSignal, () => {
    bavRequestCount += 1
  })
  setHandler(kycRequestedSignal, () => {
    kycRequestCount += 1
  })
  setHandler(outcomeChangedSignal, (signal) => {
    state.outcome = signal.outcome
  })

  // Indirection so TypeScript doesn't (incorrectly) narrow state.outcome's
  // type based on an earlier check: the signal handler above can reassign
  // it at any `await` point, including ones control-flow analysis can't
  // see through.
  const isClosedLost = () => state.outcome === 'CLOSED_LOST'

  // BAV is a hard gate: every bavRequested signal is a fresh attempt, and
  // the workflow will not move on to KYC until one comes back VERIFIED.
  // A CLOSED_LOST outcome can still short-circuit out of this wait (e.g.
  // the deal is abandoned while the applicant is stuck on a rejected
  // attempt) so the workflow doesn't stay parked here forever.
  let bavAttempts = 0
  while (state.bavStatus !== 'VERIFIED' && !isClosedLost()) {
    await condition(() => bavRequestCount > bavAttempts || isClosedLost())
    if (isClosedLost()) break

    bavAttempts = bavRequestCount
    state.bavStatus = 'PENDING'
    const result = await verifyBav(opportunityId)
    state.bavStatus = result.status
    state.bavReason = result.status === 'REJECTED' ? result.reason : undefined
  }

  // KYC follows the same retry-until-verified pattern, and only starts
  // once BAV is VERIFIED (unreachable loop condition otherwise, since a
  // CLOSED_LOST outcome would already have broken out above).
  let kycAttempts = 0
  while (state.kycStatus !== 'VERIFIED' && !isClosedLost()) {
    await condition(() => kycRequestCount > kycAttempts || isClosedLost())
    if (isClosedLost()) break

    kycAttempts = kycRequestCount
    state.kycStatus = 'PENDING'
    const result = await verifyKyc(opportunityId)
    state.kycStatus = result.status
    state.kycReason = result.status === 'REJECTED' ? result.reason : undefined
  }

  // Wait for an explicit outcome decision if one hasn't arrived yet.
  await condition(() => state.outcome !== undefined)

  const canBind =
    state.outcome === 'CLOSED_WON' &&
    state.bavStatus === 'VERIFIED' &&
    state.kycStatus === 'VERIFIED'

  if (canBind) {
    const bindResult = await bind(
      opportunityId,
      bindIdempotencyKey(opportunityId),
    )
    return { ...state, bind: bindResult }
  }

  return { ...state }
}
