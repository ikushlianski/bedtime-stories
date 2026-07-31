import { eq, sql } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client.js'
import { telegramPendingActions } from '@bedtime/core/db/schema.js'
import type { NewTelegramPendingAction } from '@bedtime/core/db/types.js'

export const PENDING_ACTION_TTL_MS = 30 * 60 * 1000

export interface PendingActionState {
  universeId: number
  accumulatedSeed: string | null
}

export function buildPendingActionUpsert(
  chatId: number,
  universeId: number,
  now: Date,
  accumulatedSeed: string | null = null,
): NewTelegramPendingAction {
  return {
    chatId,
    universeId,
    accumulatedSeed,
    createdAt: now,
  }
}

export function isPendingActionExpired(createdAt: Date, now: Date, ttlMs: number): boolean {
  return now.getTime() - createdAt.getTime() > ttlMs
}

export function isReadyToFinalize(accumulatedSeed: string | null): boolean {
  return accumulatedSeed !== null && accumulatedSeed.trim().length > 0
}

export async function setPendingUniverseChoice(
  chatId: number,
  universeId: number,
  accumulatedSeed: string | null = null,
): Promise<void> {
  const values = buildPendingActionUpsert(chatId, universeId, new Date(), accumulatedSeed)

  await db
    .insert(telegramPendingActions)
    .values(values)
    .onConflictDoUpdate({
      target: telegramPendingActions.chatId,
      set: { universeId: values.universeId, accumulatedSeed: values.accumulatedSeed, createdAt: values.createdAt },
    })
}

export async function peekPendingAction(chatId: number): Promise<PendingActionState | null> {
  const [row] = await db.select().from(telegramPendingActions).where(eq(telegramPendingActions.chatId, chatId))

  if (!row) {
    return null
  }

  if (isPendingActionExpired(row.createdAt, new Date(), PENDING_ACTION_TTL_MS)) {
    await db.delete(telegramPendingActions).where(eq(telegramPendingActions.chatId, chatId))
    return null
  }

  return { universeId: row.universeId, accumulatedSeed: row.accumulatedSeed }
}

export async function appendPendingSeedText(chatId: number, text: string): Promise<string> {
  const trimmedText = text.trim()

  const [row] = await db
    .update(telegramPendingActions)
    .set({
      accumulatedSeed: sql<string>`CASE
        WHEN ${telegramPendingActions.accumulatedSeed} IS NULL OR trim(${telegramPendingActions.accumulatedSeed}) = ''
        THEN ${trimmedText}
        ELSE ${telegramPendingActions.accumulatedSeed} || E'\n' || ${trimmedText}
      END`,
      createdAt: new Date(),
    })
    .where(eq(telegramPendingActions.chatId, chatId))
    .returning({ accumulatedSeed: telegramPendingActions.accumulatedSeed })

  return row?.accumulatedSeed ?? trimmedText
}

export async function consumePendingAction(chatId: number): Promise<PendingActionState | null> {
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

  return { universeId: row.universeId, accumulatedSeed: row.accumulatedSeed }
}
