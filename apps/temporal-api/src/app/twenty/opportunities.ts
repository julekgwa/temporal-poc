import { twentyRequest } from './client'

export const ONBOARDING_STAGE = 'YOUR_DETAILS' as const
export const BAV_STAGE = 'BAV' as const
export const KYC_STAGE = 'KYC' as const
export const CLOSE_WON_STAGE = 'CLOSED_WON' as const
export const CLOSE_LOST_STAGE = 'CLOSED_LOST' as const

export type Opportunity = {
  id: string
  stage?: string
  name?: string
  bankName?: string
  accountHolder?: string
  accountNumber?: string
  branchCode?: string
  idNumber?: string
  bankAccountVerified?: boolean
}

type TwentyRecordResponse<T extends object> =
  T | { data: T | Record<string, T> }

function unwrap<T extends object>(
  response: TwentyRecordResponse<T>,
  operation: string,
): T {
  if (!('data' in response)) return response

  const data = response.data
  const envelope = data as Record<string, T>
  if (operation in envelope) {
    return envelope[operation]
  }

  return data as T
}

export async function createOpportunity(input: {
  accountId: string
  pointOfContactId: string
  name: string
  stage: typeof ONBOARDING_STAGE
}) {
  const response = await twentyRequest<TwentyRecordResponse<Opportunity>>(
    '/rest/opportunities',
    {
      method: 'POST',
      json: {
        name: input.name,
        position: 'last',
        stage: input.stage,
        companyId: input.accountId,
        pointOfContactId: input.pointOfContactId,
      },
    },
  )
  return unwrap(response, 'createOpportunity')
}

export async function getOpportunity(id: string): Promise<Opportunity> {
  const response = await twentyRequest<TwentyRecordResponse<Opportunity>>(
    `/rest/opportunities/${encodeURIComponent(id)}`,
    { method: 'GET' },
  )
  return unwrap(response, 'opportunity')
}

export async function updateOpportunity(
  id: string,
  input: Partial<
    Pick<
      Opportunity,
      | 'name'
      | 'stage'
      | 'bankName'
      | 'accountHolder'
      | 'accountNumber'
      | 'branchCode'
      | 'idNumber'
      | 'bankAccountVerified'
    >
  >,
) {
  const response = await twentyRequest<TwentyRecordResponse<Opportunity>>(
    `/rest/opportunities/${encodeURIComponent(id)}`,
    { method: 'PATCH', json: input },
  )
  return unwrap(response, 'updateOpportunity')
}

export async function updateOpportunityStage(
  id: string,
  stage: string,
  customData: Partial<
    Pick<
      Opportunity,
      'bankName' | 'accountHolder' | 'accountNumber' | 'branchCode' | 'idNumber'
    >
  > = {},
) {
  return updateOpportunity(id, { stage, ...customData })
}
