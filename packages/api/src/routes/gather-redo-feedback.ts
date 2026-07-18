import { and, eq, isNull, or } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client'
import { annotations, storyComments } from '@bedtime/core/db/schema'
import { formatCommentsAsFeedback } from '@bedtime/core/pipeline/format-comments-as-feedback'
import { buildStoryCommentRecord } from '@bedtime/core/pipeline/build-story-comment-record'

export interface AnnotationFeedbackRow {
  id: number
  selectedText: string | null
  noteText: string | null
}

export interface GatherRedoFeedbackInput {
  storyId: number
  context: 'plan' | 'text'
  reason?: string | null | undefined
  universeId?: number | null
  activeTextVersionId?: number | null | undefined
}

export interface GatherRedoFeedbackResult {
  userFeedback: string
  annotationRows: AnnotationFeedbackRow[]
}

const CONTEXT_LABEL: Record<'plan' | 'text', string> = {
  plan: 'плану',
  text: 'тексту',
}

function buildAnnotationFilter(storyId: number, context: 'plan' | 'text', activeTextVersionId: number | null) {
  if (context === 'plan') {
    return and(eq(annotations.storyId, storyId), eq(annotations.context, 'plan'), isNull(annotations.resolvedAt))
  }

  const versionFilter = activeTextVersionId
    ? or(eq(annotations.textVersionId, activeTextVersionId), isNull(annotations.textVersionId))
    : isNull(annotations.textVersionId)

  return and(eq(annotations.storyId, storyId), eq(annotations.context, 'text'), versionFilter)
}

export async function gatherRedoFeedback({
  storyId,
  context,
  reason,
  universeId = null,
  activeTextVersionId = null,
}: GatherRedoFeedbackInput): Promise<GatherRedoFeedbackResult> {
  const trimmedReason = reason?.trim() ?? ''

  const [annotationRows] = await Promise.all([
    db
      .select({ id: annotations.id, selectedText: annotations.selectedText, noteText: annotations.noteText })
      .from(annotations)
      .where(buildAnnotationFilter(storyId, context, activeTextVersionId)),
    trimmedReason
      ? db.insert(storyComments).values(
          buildStoryCommentRecord({
            storyId,
            groupId: universeId,
            commentText: trimmedReason,
            selectedText: null,
            source: 'revision_reason',
          }),
        )
      : Promise.resolve(undefined),
  ])

  const reasonBlock = trimmedReason
    ? `Общие указания к доработке (примени ко всему ${CONTEXT_LABEL[context]}):\n${trimmedReason}`
    : ''

  const annotationsFeedback = formatCommentsAsFeedback(annotationRows)
  const userFeedback = [reasonBlock, annotationsFeedback].filter(Boolean).join('\n\n')

  return { userFeedback, annotationRows }
}
