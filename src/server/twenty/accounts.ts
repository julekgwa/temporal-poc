import { TwentyApiError, twentyRequest } from './client'

export type Account = {
  id: string
  name?: string
  domainName?: { primaryLinkUrl?: string }
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

export async function findAccount(id: string) {
  const response = await twentyRequest<TwentyRecordResponse<Account>>(
    `/rest/companies/${encodeURIComponent(id)}`,
  )
  return unwrap(response, 'company')
}

export async function findAccountByName(name: string) {
  const response = await twentyRequest<{
    data: { companies: Account[] }
  }>('/rest/companies?limit=60')
  const companies = response.data.companies
  const normalizedName = name.trim().toLowerCase()

  return companies.find(
    (company) => company.name?.trim().toLowerCase() === normalizedName,
  )
}

export async function createAccount(input: { name: string }) {
  const existingAccount = await findAccountByName(input.name)
  if (existingAccount) return existingAccount

  try {
    const response = await twentyRequest<TwentyRecordResponse<Account>>(
      '/rest/companies',
      {
        method: 'POST',
        json: {
          name: input.name,
          position: 'last',
        },
      },
    )
    return unwrap(response, 'createCompany')
  } catch (error) {
    const isDuplicate =
      error instanceof TwentyApiError &&
      error.status === 400 &&
      String(JSON.stringify(error.details)).toLowerCase().includes('duplicate')

    if (isDuplicate) {
      const duplicateAccount = await findAccountByName(input.name)
      if (duplicateAccount) return duplicateAccount
    }

    throw error
  }
}
