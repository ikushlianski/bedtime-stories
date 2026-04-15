import { z } from 'zod'

export const createStorySchema = z
  .object({
    seed: z.string().min(1).max(5000).optional(),
    title: z.string().min(1).max(200).optional(),
    textFinal: z.string().min(1).optional(),
    groupId: z.number().int().positive().optional(),
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

export type CreateStoryMode =
  | { mode: 'agent'; seed: string; title: string; groupId?: number }
  | { mode: 'user'; title: string; textFinal: string; groupId?: number }

export function resolveCreateStoryMode(input: CreateStoryInput): CreateStoryMode {
  if (input.textFinal !== undefined) {
    const title = (input.title ?? input.textFinal).trim().slice(0, 60)
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

  return result
}
