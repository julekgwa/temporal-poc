const DEFAULT_TEMPORAL_API_URL = 'http://localhost:3000'

export function getTemporalApiUrl() {
  return (process.env.TEMPORAL_API_URL || DEFAULT_TEMPORAL_API_URL).replace(
    /\/$/,
    '',
  )
}
