import { and, eq, or } from 'drizzle-orm'
import { db } from '../db/client'
import { storyIdeas, storyGroups, stories } from '../db/schema'
import { runIdeaSuggester } from './stages/idea-suggester'
import { DEFAULT_STAGE_MODELS } from './derivers/stage-defaults'

export interface GenerateStoryIdeasResult {
  ideaCount: number
  createdIds: number[]
}

export class UniverseNotFoundError extends Error {
  constructor(readonly universeId: number) {
    super(`Universe ${universeId} not found`)
  }
}

export async function generateStoryIdeasForUniverse(
  universeId: number,
  model?: string,
): Promise<GenerateStoryIdeasResult> {
  const [universe] = await db.select().from(storyGroups).where(eq(storyGroups.id, universeId))

  if (!universe) {
    throw new UniverseNotFoundError(universeId)
  }

  const resolvedModel = model || DEFAULT_STAGE_MODELS.ideaSuggester.model

  const previousStories = await db
    .select({ title: stories.title, seed: stories.seed, planFinal: stories.planFinal })
    .from(stories)
    .where(and(eq(stories.groupId, universeId), or(eq(stories.status, 'read'), eq(stories.status, 'ready'))))

  const approvedIdeas = await db
    .select()
    .from(storyIdeas)
    .where(and(eq(storyIdeas.universeId, universeId), eq(storyIdeas.status, 'approved')))

  const rejectedIdeas = await db
    .select()
    .from(storyIdeas)
    .where(and(eq(storyIdeas.universeId, universeId), eq(storyIdeas.status, 'rejected')))

  const approvedIdeasSummary =
    approvedIdeas.length > 0
      ? approvedIdeas.map((idea) => `- ${idea.topic}: ${idea.seedText}`).join('\n')
      : undefined

  const rejectedIdeasSummary =
    rejectedIdeas.length > 0
      ? rejectedIdeas
          .map((idea) => `- ${idea.topic}: ${idea.seedText}${idea.rejectionReason ? ` (причина: ${idea.rejectionReason})` : ''}`)
          .join('\n')
      : undefined

  const output = await runIdeaSuggester({
    universeContext: universe.universeContext || '',
    universeStyleGuide: universe.styleGuide ? universe.styleGuide : undefined,
    previousStories: previousStories.map((s) => ({
      title: s.title || '(без названия)',
      seed: s.seed || '',
      ...(s.planFinal ? { planFinal: s.planFinal } : {}),
    })),
    approvedIdeasSummary,
    rejectedIdeasSummary,
    universeId,
    model: resolvedModel,
  })

  const createdIds: number[] = []
  for (const topicGroup of output.topics) {
    for (const idea of topicGroup.ideas) {
      const [created] = await db
        .insert(storyIdeas)
        .values({
          universeId,
          topic: topicGroup.topic,
          seedText: idea.seed,
          rationale: idea.rationale,
          status: 'pending',
          ideaSuggesterModel: resolvedModel,
        })
        .returning({ id: storyIdeas.id })

      if (created) {
        createdIds.push(created.id)
      }
    }
  }

  return { ideaCount: createdIds.length, createdIds }
}
