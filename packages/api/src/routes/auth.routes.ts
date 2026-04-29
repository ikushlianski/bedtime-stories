import { Router } from 'express'
import { z } from 'zod'
import { OAuth2Client } from 'google-auth-library'
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
  maxAge: 30 * 24 * 60 * 60 * 1000,
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

const GOOGLE_REDIRECT_URI = process.env['GOOGLE_REDIRECT_URI'] ?? 'http://localhost:8020/api/auth/google/callback'

function getOAuthClient(): OAuth2Client | null {
  const clientId = process.env['GOOGLE_CLIENT_ID']
  const clientSecret = process.env['GOOGLE_CLIENT_SECRET']

  if (!clientId || !clientSecret) {
    return null
  }

  return new OAuth2Client(clientId, clientSecret, GOOGLE_REDIRECT_URI)
}

router.get('/google', (req: Request, res: Response): void => {
  const client = getOAuthClient()

  if (!client) {
    res.status(503).json({ error: 'Google OAuth is not configured on this server.' })
    return
  }

  const url = client.generateAuthUrl({
    access_type: 'online',
    scope: ['openid', 'email', 'profile'],
  })

  res.redirect(url)
})

router.get('/google/callback', async (req: Request, res: Response): Promise<void> => {
  const client = getOAuthClient()

  if (!client) {
    res.redirect('/login?error=auth_failed')
    return
  }

  const code = req.query['code']

  if (typeof code !== 'string') {
    res.redirect('/login?error=auth_failed')
    return
  }

  try {
    const { tokens } = await client.getToken(code)
    client.setCredentials(tokens)

    const idToken = tokens.id_token

    if (!idToken) {
      res.redirect('/login?error=auth_failed')
      return
    }

    const clientId = process.env['GOOGLE_CLIENT_ID']

    if (!clientId) {
      res.redirect('/login?error=auth_failed')
      return
    }

    const loginTicket = await client.verifyIdToken({
      idToken,
      audience: clientId,
    })

    const payload = loginTicket.getPayload()

    if (!payload?.email) {
      res.redirect('/login?error=auth_failed')
      return
    }

    const email = payload.email

    const [existingUser] = await db.select().from(users).where(eq(users.username, email)).limit(1)

    let userId: number
    let username: string

    if (existingUser) {
      userId = existingUser.id
      username = existingUser.username
    } else {
      const [newUser] = await db.insert(users).values({ username: email, passwordHash: '' }).returning()

      if (!newUser) {
        res.redirect('/login?error=auth_failed')
        return
      }

      userId = newUser.id
      username = newUser.username
    }

    const token = signToken({ sub: userId, username })
    res.cookie('auth_token', token, COOKIE_OPTIONS)
    res.redirect('/')
  } catch {
    res.redirect('/login?error=auth_failed')
  }
})

export default router
