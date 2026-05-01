export function deriveIsAuthorizedUser(fromId: number | undefined, allowedId: number): boolean {
  return fromId !== undefined && fromId === allowedId
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
