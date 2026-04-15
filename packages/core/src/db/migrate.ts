import 'dotenv/config'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { migrate } from 'drizzle-orm/neon-http/migrator'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const url = process.env['DATABASE_URL']

if (!url) {
  throw new Error('DATABASE_URL is not set')
}

const sql = neon(url)
const db = drizzle(sql)

await migrate(db, {
  migrationsFolder: resolve(__dirname, './migrations'),
})

console.log('Migrations applied successfully')
