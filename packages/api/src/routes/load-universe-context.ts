import { eq } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client'
import { storyGroups, universeCharacters } from '@bedtime/core/db/schema'
import type { CharacterBibleEntry } from '@bedtime/core/pipeline/stages/character-bible-block'

interface UniverseContext {
  universeSystemPrompt: string | undefined
  universeContext: string | undefined
  styleGuide: string | undefined
  bibleCharacters: CharacterBibleEntry[]
}

function compileCharacters(chars: Array<{ name: string; description: string }>): string {
  if (chars.length === 0) return ''

  const lines = chars.map((c) =>
    c.description.trim() ? `- **${c.name}**: ${c.description.trim()}` : `- **${c.name}**`,
  )

  return `## Персонажи вселенной\n${lines.join('\n')}`
}

export async function loadUniverseContext(groupId: number): Promise<UniverseContext> {
  const [[group], chars] = await Promise.all([
    db.select().from(storyGroups).where(eq(storyGroups.id, groupId)),
    db.select().from(universeCharacters).where(eq(universeCharacters.universeId, groupId)),
  ])

  if (!group) {
    return { universeSystemPrompt: undefined, universeContext: undefined, styleGuide: undefined, bibleCharacters: [] }
  }

  const characterBlock = compileCharacters(chars)
  const baseContext = group.universeContext?.trim() ?? ''
  const universeContext = [baseContext, characterBlock].filter(Boolean).join('\n\n') || undefined

  const bibleCharacters: CharacterBibleEntry[] = chars.map((c) => ({
    name: c.name,
    age: c.age,
    setting: c.setting,
    traits: c.traits,
    relationships: c.relationships,
    coOccurrenceNote: c.coOccurrenceNote,
    description: c.description,
  }))

  return {
    universeSystemPrompt: group.systemPrompt,
    universeContext,
    styleGuide: group.styleGuide ?? undefined,
    bibleCharacters,
  }
}
