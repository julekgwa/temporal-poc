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
  init: { method?: string; json?: unknown } = {},
): Promise<T> {
  const { baseUrl, apiKey } = getTwentyConfig()

  let response: Response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(init.json !== undefined
          ? { 'content-type': 'application/json' }
          : {}),
      },
      body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
    })
  } catch (error) {
    throw new TwentyApiError(
      'Twenty API request could not be completed.',
      502,
      error,
    )
  }

  if (response.status === 204) return {} as T

  if (!response.ok) {
    const details = await response.json().catch(() => undefined)
    console.error('[Twenty API]', { path, status: response.status, details })
    throw new TwentyApiError(
      `Twenty API request failed (${response.status}).${describeDetails(details)}`,
      response.status,
      details,
    )
  }

  return (await response.json()) as T
}
