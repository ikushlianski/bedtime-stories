import argon2 from 'argon2'
import jwt from 'jsonwebtoken'
import { env } from '../env.js'

export interface AuthTokenPayload {
  sub: number
  username: string
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id })
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password)
}

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '8h', algorithm: 'HS256' })
}

export function decodeToken(token: string): AuthTokenPayload {
  return jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as unknown as AuthTokenPayload
}
