const GENERIC_FAILURE_MESSAGE = 'Что-то пошло не так. Попробуй ещё раз через пару минут.'

export function formatApiError(body: unknown): string {
  const bodyMessage = extractBodyMessage(body)

  return bodyMessage ?? GENERIC_FAILURE_MESSAGE
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
