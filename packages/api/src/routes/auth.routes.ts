import { Router } from 'express'
import { z } from 'zod'
import { db } from '@bedtime/core/db/client.js'
import { users } from '@bedtime/core/db/schema.js'
import { eq } from 'drizzle-orm'
import { verifyPassword, signToken, decodeToken } from '@bedtime/core/auth/auth.utils.js'
import type { Request, Response } from 'express'

const router = Router()

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env['NODE_ENV'] === 'production',
  sameSite: 'strict' as const,
  maxAge: 8 * 60 * 60 * 1000,
  path: '/',
}

const loginAttempts = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = loginAttempts.get(ip)

  if (!entry || entry.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 })
    return false
  }

  if (entry.count >= 10) {
    return true
  }

  entry.count++
  return false
}

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const ip = req.ip ?? 'unknown'

  if (isRateLimited(ip)) {
    res.status(429).json({ error: 'Too many attempts. Try again later.' })
    return
  }

  const parsed = loginSchema.safeParse(req.body)

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid credentials' })
    return
  }

  const { username, password } = parsed.data

  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1)

  const dummyHash = '$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

  const hashToCheck = user?.passwordHash ?? dummyHash
  const valid = await verifyPassword(hashToCheck, password)

  if (!user || !valid) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }

  const token = signToken({ sub: user.id, username: user.username })
  res.cookie('auth_token', token, COOKIE_OPTIONS)
  res.json({ username: user.username })
})

router.post('/logout', (_req: Request, res: Response): void => {
  res.clearCookie('auth_token', { path: '/' })
  res.json({ ok: true })
})

router.get('/me', (req: Request, res: Response): void => {
  const token = req.cookies?.['auth_token'] as string | undefined

  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const payload = decodeToken(token)
    res.json({ username: payload.username })
  } catch {
    res.status(401).json({ error: 'Unauthorized' })
  }
})

export default router
