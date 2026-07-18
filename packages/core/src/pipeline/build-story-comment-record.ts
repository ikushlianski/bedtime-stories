export type StoryCommentSource = 'chat' | 'revision_reason'

export interface BuildStoryCommentRecordInput {
  storyId: number
  groupId: number | null
  commentText: string
  selectedText: string | null
  source?: StoryCommentSource
}

export interface StoryCommentInsert {
  storyId: number
  universeId: number | null
  commentText: string
  selectedText: string | null
  source: StoryCommentSource
}

export function buildStoryCommentRecord({ storyId, groupId, commentText, selectedText, source = 'chat' }: BuildStoryCommentRecordInput): StoryCommentInsert {
  return {
    storyId,
    universeId: groupId ?? null,
    commentText,
    selectedText,
    source,
  }
}
