import { inArray } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client'
import { storyGroups, universeCharacters } from '@bedtime/core/db/schema'
import type { CharacterBibleEntry } from '@bedtime/core/pipeline/stages/character-bible-block'

interface UniverseContext {
  universeSystemPrompt: string | undefined
  universeContext: string | undefined
  styleGuide: string | undefined
  bibleCharacters: CharacterBibleEntry[]
}

const EMPTY_CONTEXT: UniverseContext = {
  universeSystemPrompt: undefined,
  universeContext: undefined,
  styleGuide: undefined,
  bibleCharacters: [],
}

function compileCharacters(chars: Array<{ name: string; description: string; importance: number }>): string {
  if (chars.length === 0) return ''

  const sorted = [...chars].sort((a, b) => b.importance - a.importance)
  const lines = sorted.map((c) =>
    c.description.trim() ? `- **${c.name}** (важность ${c.importance}/5): ${c.description.trim()}` : `- **${c.name}** (важность ${c.importance}/5)`,
  )

  return `## Персонажи вселенной (отсортировано по важности)\n${lines.join('\n')}`
}

export async function loadUniverseContext(universeIds: number[]): Promise<UniverseContext> {
  const ids = Array.from(new Set(universeIds))

  if (ids.length === 0) return EMPTY_CONTEXT

  const [groups, chars] = await Promise.all([
    db.select().from(storyGroups).where(inArray(storyGroups.id, ids)),
    db.select().from(universeCharacters).where(inArray(universeCharacters.universeId, ids)),
  ])

  if (groups.length === 0) return EMPTY_CONTEXT

  const isBlend = groups.length > 1
  const charsByUniverse = new Map<number, typeof chars>()

  for (const c of chars) {
    const bucket = charsByUniverse.get(c.universeId) ?? []
    bucket.push(c)
    charsByUniverse.set(c.universeId, bucket)
  }

  const bibleCharacters: CharacterBibleEntry[] = chars.map((c) => ({
    name: c.name,
    age: c.age,
    setting: c.setting,
    traits: c.traits,
    relationships: c.relationships,
    coOccurrenceNote: c.coOccurrenceNote,
    description: c.description,
    importance: c.importance,
  }))

  if (!isBlend) {
    const [group] = groups
    const group1Chars = charsByUniverse.get(group!.id) ?? []
    const characterBlock = compileCharacters(group1Chars)
    const baseContext = group!.universeContext?.trim() ?? ''
    const universeContext = [baseContext, characterBlock].filter(Boolean).join('\n\n') || undefined

    return {
      universeSystemPrompt: group!.systemPrompt,
      universeContext,
      styleGuide: group!.styleGuide ?? undefined,
      bibleCharacters,
    }
  }

  const systemPromptBlocks: string[] = []
  const contextBlocks: string[] = []
  const styleGuideBlocks: string[] = []

  groups.forEach((group, index) => {
    const label = `Вселенная ${index + 1}: ${group.name}`

    systemPromptBlocks.push(`## ${label}\n${group.systemPrompt}`)

    const characterBlock = compileCharacters(charsByUniverse.get(group.id) ?? [])
    const baseContext = group.universeContext?.trim() ?? ''
    const combined = [baseContext, characterBlock].filter(Boolean).join('\n\n')

    if (combined) {
      contextBlocks.push(`## ${label}\n${combined}`)
    }

    if (group.styleGuide) {
      styleGuideBlocks.push(`## ${label}\n${group.styleGuide}`)
    }
  })

  const blendPreamble = 'СМЕШЕНИЕ ВСЕЛЕННЫХ: эта история намеренно объединяет несколько вселенных, перечисленных ниже. Продумай, как их персонажи, тон и правила мира переплетаются между собой — не выбирай только одну вселенную и не игнорируй остальные.'

  return {
    universeSystemPrompt: `${blendPreamble}\n\n${systemPromptBlocks.join('\n\n')}`,
    universeContext: contextBlocks.length > 0 ? contextBlocks.join('\n\n') : undefined,
    styleGuide: styleGuideBlocks.length > 0 ? styleGuideBlocks.join('\n\n') : undefined,
    bibleCharacters,
  }
}
