export function deriveIsAuthorizedUser(fromId: number | undefined, allowedId: number): boolean {
  return fromId !== undefined && fromId === allowedId
}

export function parseCommandArgument(rawMatch: string | undefined): string | null {
  const trimmed = (rawMatch ?? '').trim()

  return trimmed.length > 0 ? trimmed : null
}

export function deriveIdeaFromMessage(
  messageText: string,
  universeId: number,
): { seedText: string; topic: string; rationale: string; universeId: number } {
  return {
    seedText: messageText.trim(),
    topic: 'Telegram',
    rationale: 'Submitted via Telegram bot',
    universeId,
  }
}
