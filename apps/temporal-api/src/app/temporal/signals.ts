import { defineSignal } from '@temporalio/workflow'

export type BavSignal = { opportunityId: string }
export type KycSignal = { opportunityId: string }
export type OutcomeSignal = {
  opportunityId: string
  outcome: 'CLOSED_WON' | 'CLOSED_LOST'
}

export const bavRequestedSignal = defineSignal<[BavSignal]>('bavRequested')
export const kycRequestedSignal = defineSignal<[KycSignal]>('kycRequested')
export const outcomeChangedSignal = defineSignal<[OutcomeSignal]>(
  'outcomeChanged',
)
