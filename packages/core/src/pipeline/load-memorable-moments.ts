import { and, desc, eq, inArray, isNotNull, ne } from 'drizzle-orm'
import { db } from '../db/client'
import { annotations, stories } from '../db/schema'
import { MAX_MEMORABLE_MOMENTS, selectMemorableMoments, type MemorableMomentRow } from './stages/memorable-moments'

export * from './stages/memorable-moments'

const MEMORABLE_ANNOTATION_TYPES = ['sasha_laughed', 'sasha_loved'] as const
const CANDIDATE_QUERY_LIMIT = MAX_MEMORABLE_MOMENTS * 4

export async function loadMemorableMoments(
  universeIds: number[],
  excludeStoryId?: number,
): Promise<MemorableMomentRow[]> {
  if (universeIds.length === 0) {
    return []
  }

  const conditions = [
    inArray(stories.groupId, universeIds),
    inArray(annotations.type, MEMORABLE_ANNOTATION_TYPES),
    isNotNull(annotations.selectedText),
    ...(excludeStoryId !== undefined ? [ne(annotations.storyId, excludeStoryId)] : []),
  ]

  const rows = await db
    .select({
      type: annotations.type,
      selectedText: annotations.selectedText,
      noteText: annotations.noteText,
      storyTitle: stories.title,
    })
    .from(annotations)
    .innerJoin(stories, eq(annotations.storyId, stories.id))
    .where(and(...conditions))
    .orderBy(desc(annotations.createdAt))
    .limit(CANDIDATE_QUERY_LIMIT)

  const candidates: MemorableMomentRow[] = rows
    .filter((row): row is typeof row & { selectedText: string; type: 'sasha_laughed' | 'sasha_loved' } =>
      row.selectedText !== null && (row.type === 'sasha_laughed' || row.type === 'sasha_loved'),
    )
    .map((row) => ({
      type: row.type,
      selectedText: row.selectedText,
      noteText: row.noteText,
      storyTitle: row.storyTitle,
    }))

  return selectMemorableMoments(candidates)
}
