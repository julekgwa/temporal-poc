const DEFAULT_TEMPORAL_API_URL = 'http://localhost:3000'

export class TemporalApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'TemporalApiError'
  }
}

function getTemporalApiUrl() {
  return (process.env.TEMPORAL_API_URL || DEFAULT_TEMPORAL_API_URL).replace(
    /\/$/,
    '',
  )
}

export async function startOnboardingWorkflow(input: {
  opportunityId: string
  companyId?: string
  personId?: string
}): Promise<{ workflowId: string; started: boolean }> {
  let response: Response
  try {
    response = await fetch(
      `${getTemporalApiUrl()}/temporal/onboarding/start`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      },
    )
  } catch (error) {
    throw new TemporalApiError(
      'Could not reach the Temporal API.',
      502,
      error,
    )
  }

  if (!response.ok) {
    const details = await response.json().catch(() => undefined)
    throw new TemporalApiError(
      `Temporal API request failed (${response.status}).`,
      response.status,
      details,
    )
  }

  const body = (await response.json()) as {
    workflowId: string
    status: 'STARTED' | 'ALREADY_RUNNING'
  }
  return { workflowId: body.workflowId, started: body.status === 'STARTED' }
}
