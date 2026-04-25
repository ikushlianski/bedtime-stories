import { z } from 'zod'

const stageOverrideSchema = z.object({
  model: z.string().min(1).optional(),
  fallback: z.string().min(1).optional(),
}).partial()

export const perStageOverridesSchema = z.record(z.string(), stageOverrideSchema)

export const createStorySchema = z
  .object({
    seed: z.string().min(1).max(5000).optional(),
    title: z.string().min(1).max(200).optional(),
    textFinal: z.string().min(1).optional(),
    groupId: z.number().int().positive().optional(),
    pipelineMode: z.enum(['auto', 'manual']).optional(),
    source: z.enum(['user', 'legacy']).optional(),
    addToReadingList: z.boolean().optional(),
    perStageOverrides: perStageOverridesSchema.optional(),
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

export type CreateStoryInput = z.infer<typeof createStorySchema>

export type PerStageOverrides = z.infer<typeof perStageOverridesSchema>

export type CreateStoryMode =
  | { mode: 'agent'; seed: string; title: string; groupId?: number; pipelineMode?: 'auto' | 'manual'; perStageOverrides?: PerStageOverrides }
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

  if (input.groupId !== undefined) {
    result.groupId = input.groupId
  }

  if (input.pipelineMode !== undefined) {
    result.pipelineMode = input.pipelineMode
  }

  if (input.perStageOverrides !== undefined && Object.keys(input.perStageOverrides).length > 0) {
    result.perStageOverrides = input.perStageOverrides
  }

  return result
}
