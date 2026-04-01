import { z } from 'zod'
import { Request, Response, NextFunction } from 'express'

export function validate<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)

    if (!result.success) {
      res.status(400).json({ error: result.error.issues[0]?.message ?? 'Invalid input' })
      return
    }

    req.body = result.data
    next()
  }
}
