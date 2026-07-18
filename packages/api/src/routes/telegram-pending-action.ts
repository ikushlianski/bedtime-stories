import { eq } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client.js'
import { telegramPendingActions } from '@bedtime/core/db/schema.js'
import type { NewTelegramPendingAction } from '@bedtime/core/db/types.js'

export const PENDING_ACTION_TTL_MS = 30 * 60 * 1000

export function buildPendingActionUpsert(
  chatId: number,
  universeId: number,
  now: Date,
): NewTelegramPendingAction {
  return {
    chatId,
    universeId,
    createdAt: now,
  }
}

export function isPendingActionExpired(createdAt: Date, now: Date, ttlMs: number): boolean {
  return now.getTime() - createdAt.getTime() > ttlMs
}

export async function setPendingUniverseChoice(chatId: number, universeId: number): Promise<void> {
  const values = buildPendingActionUpsert(chatId, universeId, new Date())

  await db
    .insert(telegramPendingActions)
    .values(values)
    .onConflictDoUpdate({
      target: telegramPendingActions.chatId,
      set: { universeId: values.universeId, createdAt: values.createdAt },
    })
}

export async function consumePendingUniverseChoice(chatId: number): Promise<number | null> {
  const [row] = await db
    .delete(telegramPendingActions)
    .where(eq(telegramPendingActions.chatId, chatId))
    .returning()

  if (!row) {
    return null
  }

  if (isPendingActionExpired(row.createdAt, new Date(), PENDING_ACTION_TTL_MS)) {
    return null
  }

  return row.universeId
}
