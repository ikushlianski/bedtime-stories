import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { storyGroups } from '../db/schema'
import { aiRunner } from '../ai'
import { resolveStageModel } from './derivers/resolve-stage-model'

export async function updateUniverseContext(
  groupId: number,
  qaArray: Array<{ question: string; answer: string }>,
  seed: string,
): Promise<void> {
  const [group] = await db.select().from(storyGroups).where(eq(storyGroups.id, groupId))

  if (!group) return

  const existing = group.universeContext ?? ''

  const qaBlock = qaArray
    .map((qa) => `Q: ${qa.question}\nA: ${qa.answer}`)
    .join('\n\n')

  const prompt = [
    'You maintain a structured living knowledge base for a bedtime story universe about a child named Gosha (Sasha).',
    'Merge the existing context with the new Q&A answers. Produce an updated knowledge base in this exact format:',
    '',
    '## Персонажи',
    '- Name — 1-2 sentence trait description (keep only recurring/important characters, max 8)',
    '',
    '## События',
    '- Recent or recurring life events relevant to story themes (max 6 bullets)',
    '',
    '## Чувства и темы',
    '- Emotional landscape and thematic territory — what Gosha is working through (max 5 bullets)',
    '',
    '## Уже раскрыто',
    '- Themes/situations already explored in stories — avoid repeating too soon (max 6 bullets)',
    '',
    '## Элементы мира',
    '- Recurring places, objects, motifs, phrases that belong to this universe (max 5 bullets)',
    '',
    'Rules:',
    '- Write in Russian',
    '- Be specific and concrete — "Gosha anxious about school transition, starts September" not "child has anxieties"',
    '- Drop outdated bullets as new ones arrive; keep the total concise',
    '- Return only the formatted sections, nothing else',
    '',
    existing.length > 0 ? `EXISTING CONTEXT:\n${existing}` : 'EXISTING CONTEXT: (none yet)',
    '',
    `NEW Q&A (from story seed: "${seed.slice(0, 120)}"):`,
    qaBlock,
  ].join('\n')

  const choice = await resolveStageModel(groupId, 'universeContextUpdater')

  const updated = await aiRunner.runText({
    model: choice.model,
    fallback: choice.fallback,
    prompt,
    label: 'universe-context-updater',
    stage: 'universeContextUpdater',
  })

  await db
    .update(storyGroups)
    .set({ universeContext: updated.trim() })
    .where(eq(storyGroups.id, groupId))
}
