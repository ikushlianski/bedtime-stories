export interface Idea {
  id: string
  text: string
  createdAt: string
  status: 'open' | 'promoted' | 'discarded'
}

export interface IdeasState {
  items: Idea[]
}

export const EMPTY_STATE: IdeasState = { items: [] }

export function addIdea(state: IdeasState, input: { text: string; id: string; createdAt: string }): IdeasState {
  const trimmed = input.text.trim()

  if (trimmed.length === 0) return state

  const idea: Idea = {
    id: input.id,
    text: trimmed,
    createdAt: input.createdAt,
    status: 'open',
  }

  return { items: [idea, ...state.items] }
}

export function updateIdeaText(state: IdeasState, id: string, text: string): IdeasState {
  const trimmed = text.trim()

  if (trimmed.length === 0) return state

  return {
    items: state.items.map((item) => (item.id === id ? { ...item, text: trimmed } : item)),
  }
}

export function setIdeaStatus(state: IdeasState, id: string, status: Idea['status']): IdeasState {
  return {
    items: state.items.map((item) => (item.id === id ? { ...item, status } : item)),
  }
}

export function removeIdea(state: IdeasState, id: string): IdeasState {
  return { items: state.items.filter((item) => item.id !== id) }
}

export function openIdeas(state: IdeasState): Idea[] {
  return state.items.filter((item) => item.status === 'open')
}

export function serialize(state: IdeasState): string {
  return JSON.stringify(state)
}

export function deserialize(raw: string | null): IdeasState {
  if (raw === null || raw.length === 0) return EMPTY_STATE

  try {
    const parsed: unknown = JSON.parse(raw)

    if (typeof parsed !== 'object' || parsed === null) return EMPTY_STATE

    const maybeItems = (parsed as { items?: unknown }).items

    if (!Array.isArray(maybeItems)) return EMPTY_STATE

    const items = maybeItems.filter(isIdea)

    return { items }
  } catch {
    return EMPTY_STATE
  }
}

function isIdea(value: unknown): value is Idea {
  if (typeof value !== 'object' || value === null) return false

  const v = value as Record<string, unknown>

  return (
    typeof v['id'] === 'string' &&
    typeof v['text'] === 'string' &&
    typeof v['createdAt'] === 'string' &&
    (v['status'] === 'open' || v['status'] === 'promoted' || v['status'] === 'discarded')
  )
}
