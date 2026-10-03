import { ApiError } from './api'

const NETWORK_MESSAGE = "Can't reach the server. Check your connection and try again."

/** First message per field from a 400 response, e.g. { job_title: 'This field is required.' }. */
export function fieldErrorsOf(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {}
  return Object.fromEntries(
    Object.entries(error.details).map(([field, value]) => [
      field,
      Array.isArray(value) ? value[0] : value,
    ]),
  )
}

/** A message for errors not shown next to a field (blocked deletes, network failures, ...). */
export function formMessageOf(error: unknown): string | null {
  if (!error) return null
  if (!(error instanceof ApiError)) return NETWORK_MESSAGE
  return Object.keys(error.details).length > 0 ? null : error.message
}
