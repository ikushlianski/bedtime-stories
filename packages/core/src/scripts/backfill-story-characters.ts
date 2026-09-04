import { inArray, isNotNull } from 'drizzle-orm'
import { db } from '../db/client.js'
import { stories, storyCharacters, universeCharacters } from '../db/schema.js'

const finishedStories = await db
  .select({ id: stories.id, groupId: stories.groupId, textFinal: stories.textFinal })
  .from(stories)
  .where(inArray(stories.status, ['proofreading', 'ready', 'read']))

const characters = await db
  .select({ id: universeCharacters.id, universeId: universeCharacters.universeId, name: universeCharacters.name })
  .from(universeCharacters)

const charactersByUniverse = new Map<number, typeof characters>()
for (const character of characters) {
  const list = charactersByUniverse.get(character.universeId) ?? []
  list.push(character)
  charactersByUniverse.set(character.universeId, list)
}

let inserted = 0
let skippedNoText = 0

for (const story of finishedStories) {
  if (!story.groupId || !story.textFinal) {
    skippedNoText++
    continue
  }

  const roster = charactersByUniverse.get(story.groupId) ?? []
  const matchedIds = roster.filter((c) => story.textFinal!.includes(c.name)).map((c) => c.id)

  if (matchedIds.length === 0) continue

  await db
    .insert(storyCharacters)
    .values(matchedIds.map((characterId) => ({ storyId: story.id, characterId })))
    .onConflictDoNothing()

  inserted += matchedIds.length
}

console.log(`Backfilled ${inserted} story_characters rows from ${finishedStories.length} finished stories (${skippedNoText} skipped: no groupId/textFinal).`)
process.exit(0)
