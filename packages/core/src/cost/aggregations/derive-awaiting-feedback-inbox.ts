export interface AwaitingInboxStoryRow {
  storyId: number
  title: string
  status: 'ready' | 'read' | 'draft' | 'proofreading' | 'archived' | string
  readyAt: Date | null
  hasFeedback: boolean
}

export interface AwaitingInboxEntry {
  storyId: number
  title: string
  status: string
  readyAt: Date | null
}

export function deriveAwaitingFeedbackInbox(rows: AwaitingInboxStoryRow[]): AwaitingInboxEntry[] {
  return rows
    .filter((r) => (r.status === 'ready' || r.status === 'read') && !r.hasFeedback)
    .sort((a, b) => {
      const aT = a.readyAt?.getTime() ?? 0
      const bT = b.readyAt?.getTime() ?? 0
      return bT - aT
    })
    .map((r) => ({ storyId: r.storyId, title: r.title, status: r.status, readyAt: r.readyAt }))
}
