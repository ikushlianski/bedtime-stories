export const UNREAD_STATUSES = ['proofreading', 'ready'] as const

export const READ_STATUSES = ['read'] as const

export type StoryListStatus = 'draft' | 'proofreading' | 'ready' | 'read' | 'archived'

export function statusEmoji(status: string | null | undefined): string {
  switch (status) {
    case 'ready':
      return '✅'
    case 'proofreading':
      return '📝'
    case 'read':
      return '📖'
    case 'archived':
      return '🗂️'
    default:
      return '⏳'
  }
}

export function parseStoryIdMessage(text: string): number | null {
  const trimmed = text.trim()

  if (!/^\d+$/.test(trimmed)) {
    return null
  }

  const id = Number.parseInt(trimmed, 10)

  return Number.isSafeInteger(id) && id > 0 ? id : null
}

export interface StoryListItem {
  id: number
  title: string | null
  status: string | null
}

export function storyLabel(item: StoryListItem): string {
  const title = item.title && item.title.trim().length > 0 ? item.title.trim() : `История №${item.id}`

  return `№${item.id} — ${title}`
}

export function formatStoriesList(items: StoryListItem[], heading: string): string {
  if (items.length === 0) {
    return `${heading}\n\nПока пусто.`
  }

  const lines = items.map((item) => `${statusEmoji(item.status)} ${storyLabel(item)}`)

  return `${heading}\n\n${lines.join('\n')}\n\nОтправь номер истории, чтобы прочитать её.`
}

export function chunkText(text: string, size = 4096): string[] {
  if (text.length === 0) {
    return []
  }

  const chunks: string[] = []

  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size))
  }

  return chunks
}

export function pickReadableText(story: {
  textFinal: string | null
  textV2: string | null
  textV1: string | null
}): string | null {
  return story.textFinal ?? story.textV2 ?? story.textV1 ?? null
}
