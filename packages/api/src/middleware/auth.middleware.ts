import type { Request, Response, NextFunction } from 'express'
import { decodeToken, type AuthTokenPayload } from '@bedtime/core/auth/auth.utils.js'

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload
    }
  }
}

const DEV_API_KEY = process.env['DEV_API_KEY']

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (
    process.env['NODE_ENV'] !== 'production' &&
    DEV_API_KEY !== undefined &&
    DEV_API_KEY !== '' &&
    req.headers['x-dev-api-key'] === DEV_API_KEY
  ) {
    req.user = { sub: 1, username: 'dev' }
    next()
    return
  }

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
