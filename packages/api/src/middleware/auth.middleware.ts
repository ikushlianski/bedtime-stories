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
  console.log(`[requireAuth] ${req.method} ${req.path} - Auth token present:`, !!token)

  if (!token) {
    console.log(`[requireAuth] No token for ${req.method} ${req.path}. Returning 401`)
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    req.user = decodeToken(token)
    console.log(`[requireAuth] Token decoded for user ${req.user?.username} on ${req.method} ${req.path}`)
    next()
  } catch (error) {
    console.log(`[requireAuth] Token decode failed on ${req.method} ${req.path}:`, error instanceof Error ? error.message : error)
    res.status(401).json({ error: 'Unauthorized' })
  }
}
