import type { Request, Response, NextFunction } from 'express'
import { decodeToken, type AuthTokenPayload } from '@bedtime/core/auth/auth.utils.js'

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.['auth_token'] as string | undefined

  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    req.user = decodeToken(token)
    next()
  } catch {
    res.status(401).json({ error: 'Unauthorized' })
  }
}
