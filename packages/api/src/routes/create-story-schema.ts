import { z } from 'zod'
import { PIPELINE_STAGES, PipelineStage } from '@bedtime/core/pipeline/pipeline-stages'
import { getStoryStructureByKey } from '@bedtime/core/pipeline/stages/story-structures'
import { getCharacterLensByKey } from '@bedtime/core/pipeline/stages/character-lenses'
import { MAX_UNIVERSES_PER_STORY } from './story-universe-limits'

const stageOverrideSchema = z.object({
  model: z.string().min(1),
  fallback: z.string().min(1).optional(),
})

export const perStageOverridesSchema = z.record(
  z.nativeEnum(PipelineStage),
  stageOverrideSchema,
).refine(
  (stages) => {
    return PIPELINE_STAGES.every((stage) => stage in stages && stages[stage as keyof typeof stages]?.model)
  },
  {
    message: 'Model selection is required for all stages: plotter, writer, and plotterQuestions',
  },
)

export const createStorySchema = z
  .object({
    seed: z.string().min(1).max(5000).optional(),
    title: z.string().min(1).max(200).optional(),
    textFinal: z.string().min(1).optional(),
    groupId: z.number().int().positive().optional(),
    groupIds: z.array(z.number().int().positive()).min(1).max(MAX_UNIVERSES_PER_STORY).optional(),
    pipelineMode: z.enum(['auto', 'manual']).optional(),
    source: z.enum(['user', 'legacy']).optional(),
    addToReadingList: z.boolean().optional(),
    perStageOverrides: perStageOverridesSchema.optional(),
    structureKey: z.string().min(1).optional(),
    lensKey: z.string().min(1).optional(),
  })
  .refine(
    (value) => {
      const hasSeed = value.seed !== undefined
      const hasUserStory = value.textFinal !== undefined

      return hasSeed !== hasUserStory
    },
    {
      message:
        'Provide either seed (for pipeline generation) or textFinal (for user-authored story), not both',
    },
  )
  .refine(
    (value) => value.structureKey === undefined || getStoryStructureByKey(value.structureKey) !== undefined,
    { message: 'Unknown structureKey', path: ['structureKey'] },
  )
  .refine(
    (value) => value.lensKey === undefined || getCharacterLensByKey(value.lensKey) !== undefined,
    { message: 'Unknown lensKey', path: ['lensKey'] },
  )

export type CreateStoryInput = z.infer<typeof createStorySchema>

export type PerStageOverrides = z.infer<typeof perStageOverridesSchema>

export type CreateStoryMode =
  | {
      mode: 'agent'
      seed: string
      title: string
      groupId?: number
      groupIds?: number[]
      pipelineMode?: 'auto' | 'manual'
      perStageOverrides?: PerStageOverrides
      structureKey?: string
      lensKey?: string
    }
  | { mode: 'user'; title: string; textFinal: string; groupId?: number }
  | { mode: 'legacy'; title: string; textFinal: string; groupId?: number; addToReadingList?: boolean }

export function resolveCreateStoryMode(input: CreateStoryInput): CreateStoryMode {
  if (input.textFinal !== undefined) {
    const title = (input.title ?? input.textFinal).trim().slice(0, 60)

    if (input.source === 'legacy') {
      const result: CreateStoryMode = {
        mode: 'legacy',
        title,
        textFinal: input.textFinal,
        ...(input.groupId !== undefined ? { groupId: input.groupId } : {}),
        ...(input.addToReadingList !== undefined ? { addToReadingList: input.addToReadingList } : {}),
      }

      return result
    }

    const result: CreateStoryMode = { mode: 'user', title, textFinal: input.textFinal }

    if (input.groupId !== undefined) {
      result.groupId = input.groupId
    }

    return result
  }

  const seed = input.seed as string
  const title = seed.trim().slice(0, 60)
  const result: CreateStoryMode = { mode: 'agent', seed, title }

  const groupIds = input.groupIds !== undefined
    ? Array.from(new Set(input.groupIds))
    : input.groupId !== undefined ? [input.groupId] : undefined

  const [primaryGroupId] = groupIds ?? []

  if (groupIds !== undefined && primaryGroupId !== undefined) {
    result.groupIds = groupIds
    result.groupId = primaryGroupId
  }

  if (input.pipelineMode !== undefined) {
    result.pipelineMode = input.pipelineMode
  }

  if (input.perStageOverrides !== undefined && Object.keys(input.perStageOverrides).length > 0) {
    result.perStageOverrides = input.perStageOverrides
  }

  if (input.structureKey !== undefined) {
    result.structureKey = input.structureKey
  }

  if (input.lensKey !== undefined) {
    result.lensKey = input.lensKey
  }

  return result
}
