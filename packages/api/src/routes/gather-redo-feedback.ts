import { and, eq, isNull, or, asc, desc } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client'
import { annotations, storyComments, planConversations } from '@bedtime/core/db/schema'
import { formatCommentsAsFeedback } from '@bedtime/core/pipeline/format-comments-as-feedback'
import { formatPlanConversationAsFeedback } from '@bedtime/core/pipeline/format-plan-conversation-as-feedback'
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
  bankedCommentIds: number[]
}

const CONTEXT_LABEL: Record<'plan' | 'text', string> = {
  plan: 'плану',
  text: 'тексту',
}

const BANKED_COMMENTS_LIMIT = 20

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

  const [annotationRows, bankedComments, conversationMessages] = await Promise.all([
    db
      .select({ id: annotations.id, selectedText: annotations.selectedText, noteText: annotations.noteText })
      .from(annotations)
      .where(buildAnnotationFilter(storyId, context, activeTextVersionId)),
    db
      .select({ id: storyComments.id, commentText: storyComments.commentText })
      .from(storyComments)
      .where(and(eq(storyComments.storyId, storyId), eq(storyComments.source, 'chat'), isNull(storyComments.appliedAt)))
      .orderBy(desc(storyComments.createdAt))
      .limit(BANKED_COMMENTS_LIMIT),
    db
      .select({ role: planConversations.role, content: planConversations.content })
      .from(planConversations)
      .where(and(eq(planConversations.storyId, storyId), eq(planConversations.context, context)))
      .orderBy(asc(planConversations.createdAt)),
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
  const bankedCommentsFeedback =
    bankedComments.length > 0
      ? `Комментарии из чата, ожидающие применения:\n${[...bankedComments].reverse().map((c) => `— ${c.commentText}`).join('\n')}`
      : ''
  const conversationFeedback = formatPlanConversationAsFeedback(conversationMessages)
  const userFeedback = [reasonBlock, annotationsFeedback, bankedCommentsFeedback, conversationFeedback]
    .filter(Boolean)
    .join('\n\n')

  return { userFeedback, annotationRows, bankedCommentIds: bankedComments.map((c) => c.id) }
}
