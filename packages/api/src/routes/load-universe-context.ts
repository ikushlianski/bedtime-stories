import { eq } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client'
import { storyGroups, universeCharacters } from '@bedtime/core/db/schema'

interface UniverseContext {
  universeSystemPrompt: string | undefined
  universeContext: string | undefined
  styleGuide: string | undefined
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
    return { universeSystemPrompt: undefined, universeContext: undefined, styleGuide: undefined }
  }

  const characterBlock = compileCharacters(chars)
  const baseContext = group.universeContext?.trim() ?? ''
  const universeContext = [baseContext, characterBlock].filter(Boolean).join('\n\n') || undefined

  return {
    universeSystemPrompt: group.systemPrompt,
    universeContext,
    styleGuide: group.styleGuide ?? undefined,
  }
}
