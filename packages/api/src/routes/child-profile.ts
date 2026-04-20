import { Router } from 'express'
import { z } from 'zod'
import { db } from '@bedtime/core/db/client'
import { childProfiles } from '@bedtime/core/db/schema'
import { validate } from '../middleware/validate'

const router = Router()

const updateProfileSchema = z.object({
  name: z.string().optional(),
  age: z.number().int().nullable().optional(),
  activities: z.string().nullable().optional(),
  interests: z.string().nullable().optional(),
  dislikes: z.string().nullable().optional(),
  favourites: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

router.get('/', async (_req, res) => {
  try {
    const [profile] = await db.select().from(childProfiles).limit(1)

    res.json(profile ?? null)
  } catch (err) {
    console.error('GET /api/child-profile failed:', err)
    res.status(500).json({ error: 'Failed to fetch child profile' })
  }
})

router.put('/', validate(updateProfileSchema), async (req, res) => {
  try {
    const data = req.body as z.infer<typeof updateProfileSchema>
    const [existing] = await db.select().from(childProfiles).limit(1)

    if (existing) {
      const [updated] = await db
        .update(childProfiles)
        .set({ ...data, updatedAt: new Date() })
        .returning()

      res.json(updated)
    } else {
      const [created] = await db
        .insert(childProfiles)
        .values({ name: data.name ?? '', ...data })
        .returning()

      res.status(201).json(created)
    }
  } catch (err) {
    console.error('PUT /api/child-profile failed:', err)
    res.status(500).json({ error: 'Failed to update child profile' })
  }
})

export default router
