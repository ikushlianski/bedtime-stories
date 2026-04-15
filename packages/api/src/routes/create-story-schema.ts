import { z } from 'zod'

export const createStorySchema = z
  .object({
    seed: z.string().min(1).max(5000).optional(),
    title: z.string().min(1).max(200).optional(),
    textFinal: z.string().min(1).optional(),
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
  | { mode: 'agent'; seed: string; title: string }
  | { mode: 'user'; title: string; textFinal: string }

export function resolveCreateStoryMode(input: CreateStoryInput): CreateStoryMode {
  if (input.textFinal !== undefined) {
    const title = (input.title ?? input.textFinal).trim().slice(0, 60)

    return { mode: 'user', title, textFinal: input.textFinal }
  }

  const seed = input.seed as string
  const title = seed.trim().slice(0, 60)

  return { mode: 'agent', seed, title }
}
