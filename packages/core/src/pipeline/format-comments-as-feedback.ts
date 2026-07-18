export interface CommentFeedbackInput {
  selectedText: string | null
  noteText: string | null
}

export function formatCommentsAsFeedback(items: CommentFeedbackInput[]): string {
  return items
    .filter((item) => !!item.noteText)
    .map((item) => (item.selectedText ? `К фрагменту «${item.selectedText}»: ${item.noteText}` : `Общий комментарий: ${item.noteText}`))
    .join('\n\n')
}
