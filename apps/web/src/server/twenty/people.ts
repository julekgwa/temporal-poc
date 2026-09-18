import { twentyRequest } from './client'

export type Person = { id: string; companyId?: string }

type TwentyRecordResponse<T extends object> =
  T | { data: T | Record<string, T> }

function unwrap<T extends object>(
  response: TwentyRecordResponse<T>,
  operation: string,
): T {
  if (!('data' in response)) return response

  const data = response.data
  const envelope = data as Record<string, T>
  if (operation in envelope) return envelope[operation]
  return data as T
}

function splitName(name: string) {
  const [firstName, ...lastNameParts] = name.trim().split(/\s+/)
  return { firstName, lastName: lastNameParts.join(' ') || firstName }
}

function splitPhone(phone: string) {
  const defaultCallingCode =
    process.env.TWENTY_DEFAULT_PHONE_CALLING_CODE || '+27'
  const digits = phone.trim().replace(/[\s()-]/g, '')
  const nationalNumber = digits.startsWith(defaultCallingCode)
    ? digits.slice(defaultCallingCode.length)
    : digits.replace(/^0/, '')
  const primaryPhoneNumber = `${defaultCallingCode}${nationalNumber}`

  return {
    primaryPhoneCountryCode:
      process.env.TWENTY_DEFAULT_PHONE_COUNTRY_CODE || 'ZA',
    primaryPhoneCallingCode: defaultCallingCode,
    primaryPhoneNumber,
  }
}

export async function createPerson(input: {
  name: string
  email: string
  phone: string
  companyId: string
  jobTitle: string
}) {
  const response = await twentyRequest<TwentyRecordResponse<Person>>(
    '/rest/people',
    {
      method: 'POST',
      json: {
        name: splitName(input.name),
        emails: { primaryEmail: input.email },
        phones: splitPhone(input.phone),
        companyId: input.companyId,
        jobTitle: input.jobTitle,
        position: 'last',
      },
    },
  )

  return unwrap(response, 'createPerson')
}
