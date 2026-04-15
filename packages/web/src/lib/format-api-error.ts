export function formatApiError(status: number, statusText: string, body: unknown): string {
  const bodyMessage = extractBodyMessage(body)

  if (bodyMessage !== null) {
    return `API error ${status}: ${bodyMessage}`
  }

  if (statusText.length > 0) {
    return `API error ${status}: ${statusText}`
  }

  return `API error ${status}`
}

function extractBodyMessage(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null

  const candidate = body as { error?: unknown; message?: unknown }

  if (typeof candidate.error === 'string' && candidate.error.length > 0) {
    return candidate.error
  }

  if (typeof candidate.message === 'string' && candidate.message.length > 0) {
    return candidate.message
  }

  return null
}
