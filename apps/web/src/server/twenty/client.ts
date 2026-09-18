import ky, { HTTPError } from 'ky'
import type { Options } from 'ky'

const DEFAULT_TWENTY_API_URL = 'https://api.twenty.com'

export class TwentyApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'TwentyApiError'
  }
}

function describeDetails(details: unknown) {
  if (!details) return ''
  if (typeof details === 'string') return ` ${details}`

  try {
    return ` ${JSON.stringify(details)}`
  } catch {
    return ''
  }
}

function getTwentyConfig() {
  const baseUrl = process.env.TWENTY_API_URL || DEFAULT_TWENTY_API_URL
  const apiKey = process.env.TWENTY_API_KEY

  if (!apiKey) {
    throw new TwentyApiError('Twenty is not configured on the server.', 503)
  }

  return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey }
}

export async function twentyRequest<T>(
  path: string,
  init: Options = {},
): Promise<T> {
  const { baseUrl, apiKey } = getTwentyConfig()

  try {
    const response = await ky(`${baseUrl}${path}`, {
      ...init,
      retry: 0,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...init.headers,
      },
    })

    if (response.status === 204) return {} as T
    return await response.json<T>()
  } catch (error) {
    if (error instanceof HTTPError) {
      const details = error.data
      console.error('[Twenty API]', {
        path,
        status: error.response.status,
        details,
      })
      throw new TwentyApiError(
        `Twenty API request failed (${error.response.status}).${describeDetails(details)}`,
        error.response.status,
        details,
      )
    }

    throw new TwentyApiError(
      'Twenty API request could not be completed.',
      502,
      error,
    )
  }
}
