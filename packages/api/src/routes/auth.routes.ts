import { Router } from 'express'
import { z } from 'zod'
import { OAuth2Client } from 'google-auth-library'
import { db } from '@bedtime/core/db/client.js'
import { users } from '@bedtime/core/db/schema.js'
import { eq, or } from 'drizzle-orm'
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
  console.log('[auth.me] Request received. Auth token present:', !!token)
  console.log('[auth.me] All cookies:', Object.keys(req.cookies ?? {}))

  if (!token) {
    console.log('[auth.me] No auth_token cookie found. Returning 401')
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const payload = decodeToken(token)
    console.log(`[auth.me] Token decoded successfully. User: ${payload.username}`)
    res.json({ username: payload.username })
  } catch (error) {
    console.log('[auth.me] Token decode failed:', error instanceof Error ? error.message : error)
    res.status(401).json({ error: 'Unauthorized' })
  }
})

const GOOGLE_REDIRECT_URI = process.env['GOOGLE_REDIRECT_URI'] ?? 'http://localhost:8020/api/auth/google/callback'
const FRONTEND_URL = process.env['FRONTEND_URL'] ?? ''

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
    console.log('[auth] Google OAuth client not configured')
    res.redirect('/login?error=auth_failed')
    return
  }

  const code = req.query['code']

  if (typeof code !== 'string') {
    console.log('[auth] Missing or invalid code parameter')
    res.redirect('/login?error=auth_failed')
    return
  }

  try {
    console.log('[auth] Exchanging code for tokens')
    const { tokens } = await client.getToken(code)
    client.setCredentials(tokens)

    const idToken = tokens.id_token

    if (!idToken) {
      console.log('[auth] No id_token in response')
      res.redirect('/login?error=auth_failed')
      return
    }

    const clientId = process.env['GOOGLE_CLIENT_ID']

    if (!clientId) {
      console.log('[auth] GOOGLE_CLIENT_ID not set')
      res.redirect('/login?error=auth_failed')
      return
    }

    console.log('[auth] Verifying ID token')
    const loginTicket = await client.verifyIdToken({
      idToken,
      audience: clientId,
    })

    const payload = loginTicket.getPayload()

    if (!payload?.email) {
      console.log('[auth] No email in token payload')
      res.redirect('/login?error=auth_failed')
      return
    }

    const email = payload.email
    console.log(`[auth] User email: ${email}`)

    const [existingUser] = await db
      .select()
      .from(users)
      .where(or(eq(users.email, email), eq(users.username, email)))
      .limit(1)

    let userId: number
    let username: string

    if (existingUser) {
      console.log(`[auth] Found existing user: ${existingUser.username} (id: ${existingUser.id})`)
      if (!existingUser.email) {
        await db.update(users).set({ email }).where(eq(users.id, existingUser.id))
      }

      userId = existingUser.id
      username = existingUser.username
    } else {
      console.log(`[auth] Creating new user with email: ${email}`)
      const [newUser] = await db.insert(users).values({ username: email, passwordHash: '', email }).returning()

      if (!newUser) {
        console.log('[auth] Failed to create new user')
        res.redirect('/login?error=auth_failed')
        return
      }

      userId = newUser.id
      username = newUser.username
      console.log(`[auth] New user created: ${username} (id: ${userId})`)
    }

    const token = signToken({ sub: userId, username })
    console.log(`[auth] Signing token for user ${username}, setting auth_token cookie with options:`, COOKIE_OPTIONS)
    res.cookie('auth_token', token, COOKIE_OPTIONS)
    const redirectUrl = FRONTEND_URL ? `${FRONTEND_URL}/` : '/'
    console.log(`[auth] Redirecting to ${redirectUrl} after successful login`)
    res.redirect(redirectUrl)
  } catch (error) {
    console.log('[auth] Google callback error:', error instanceof Error ? error.message : error)
    res.redirect('/login?error=auth_failed')
  }
})

export default router
