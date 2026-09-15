import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { createAccount } from './twenty/accounts'
import { createOpportunity, ONBOARDING_STAGE } from './twenty/opportunities'
import { createPerson } from './twenty/people'

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

    return {
      accountId: account.id,
      opportunityId: opportunity.id,
      stage: opportunity.stage || ONBOARDING_STAGE,
    }
  })
