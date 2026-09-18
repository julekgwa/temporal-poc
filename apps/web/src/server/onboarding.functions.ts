import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  BAV_STAGE,
  createOpportunity,
  KYC_STAGE,
  ONBOARDING_STAGE,
  updateOpportunityStage,
} from './twenty/opportunities'
import { verificationRequestSchema } from './onboarding-api'
import { createAccount } from './twenty/accounts'
import { createPerson } from './twenty/people'
import { startOnboardingWorkflow } from './temporal-api'

const bavStageRequestSchema = verificationRequestSchema.extend({
  accountId: z.string().trim().min(1).optional(),
  bankName: z.string().trim().min(1),
  accountHolder: z.string().trim().min(1),
  accountNumber: z.string().trim().min(1),
  branchCode: z.string().trim().min(1),
})

const kycStageRequestSchema = verificationRequestSchema.extend({
  idNumber: z.string().trim().min(1),
})

export const onboardingDetailsSchema = z.object({
  companyName: z.string().trim().min(2, 'Enter the company name.'),
  name: z.string().trim().min(2, 'Enter your full name.'),
  email: z.string().trim().email('Enter a valid email address.'),
  phone: z.string().trim().min(7, 'Enter a valid phone number.'),
  companyType: z.string().min(1, 'Select a company type.'),
  jobTitle: z.string().min(1, 'Select your role or title.'),
})

export type OnboardingDetails = z.infer<typeof onboardingDetailsSchema>

export const createOnboardingFn = createServerFn({ method: 'POST' })
  .validator(onboardingDetailsSchema)
  .handler(async ({ data }) => {
    let account
    try {
      account = await createAccount({
        name: data.companyName,
      })
    } catch (error) {
      throw new Error(
        `Could not create the Twenty account: ${error instanceof Error ? error.message : 'unknown error'}`,
      )
    }

    let person
    try {
      person = await createPerson({ ...data, companyId: account.id })
    } catch (error) {
      throw new Error(
        `Could not create the Twenty person: ${error instanceof Error ? error.message : 'unknown error'}`,
      )
    }

    let opportunity
    try {
      opportunity = await createOpportunity({
        accountId: account.id,
        pointOfContactId: person.id,
        name: `Onboarding — ${data.name}`,
        stage: ONBOARDING_STAGE,
      })
    } catch (error) {
      throw new Error(
        `Could not create the Twenty opportunity: ${error instanceof Error ? error.message : 'unknown error'}`,
      )
    }

    try {
      await startOnboardingWorkflow({
        opportunityId: opportunity.id,
        companyId: account.id,
        personId: person.id,
      })
    } catch (error) {
      throw new Error(
        `Could not start the onboarding workflow: ${error instanceof Error ? error.message : 'unknown error'}`,
      )
    }

    return {
      accountId: account.id,
      opportunityId: opportunity.id,
      stage: opportunity.stage || ONBOARDING_STAGE,
    }
  })

export const updateBavStageFn = createServerFn({ method: 'POST' })
  .validator(bavStageRequestSchema)
  .handler(async ({ data }) => {
    await updateOpportunityStage(data.opportunityId, BAV_STAGE, {
      bankName: data.bankName,
      accountHolder: data.accountHolder,
      accountNumber: data.accountNumber,
      branchCode: data.branchCode,
    })
    return { stage: BAV_STAGE }
  })

export const updateKycStageFn = createServerFn({ method: 'POST' })
  .validator(kycStageRequestSchema)
  .handler(async ({ data }) => {
    await updateOpportunityStage(data.opportunityId, KYC_STAGE, {
      idNumber: data.idNumber,
    })
    return { stage: KYC_STAGE }
  })
