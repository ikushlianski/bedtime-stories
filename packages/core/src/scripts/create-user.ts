import { db } from '../db/client.js'
import { users } from '../db/schema.js'
import { hashPassword } from '../auth/auth.utils.js'
import { eq } from 'drizzle-orm'

const [, , username, password] = process.argv

if (!username || !password) {
  console.error('Usage: tsx packages/core/src/scripts/create-user.ts <username> <password>')
  process.exit(1)
}

const existing = await db.select().from(users).where(eq(users.username, username)).limit(1)

if (existing.length > 0) {
  console.error(`User "${username}" already exists`)
  process.exit(1)
}

const passwordHash = await hashPassword(password)
await db.insert(users).values({ username, passwordHash })
console.log(`User "${username}" created successfully`)
process.exit(0)
