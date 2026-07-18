export interface BuildStoryCommentRecordInput {
  storyId: number
  groupId: number | null
  commentText: string
  selectedText: string | null
}

export interface StoryCommentInsert {
  storyId: number
  universeId: number | null
  commentText: string
  selectedText: string | null
}

export function buildStoryCommentRecord({ storyId, groupId, commentText, selectedText }: BuildStoryCommentRecordInput): StoryCommentInsert {
  return {
    storyId,
    universeId: groupId ?? null,
    commentText,
    selectedText,
  }
}
