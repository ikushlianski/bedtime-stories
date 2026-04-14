import { desc, eq } from 'drizzle-orm'
import { db } from '../db/client'
import { prompts } from '../db/schema'

export type PromptAgent = 'plotter' | 'plot_critic' | 'writer' | 'writer_critic' | 'improver'

export interface ResolvedPrompt {
  text: string
  version: number
}

export async function resolvePrompt(
  agent: PromptAgent,
  fallbackText: string,
  fallbackVersion = 1,
): Promise<ResolvedPrompt> {
  try {
    const [row] = await db
      .select()
      .from(prompts)
      .where(eq(prompts.agent, agent))
      .orderBy(desc(prompts.version))
      .limit(1)

    if (row !== undefined && row.text.length > 0) {
      return { text: row.text, version: row.version }
    }
  } catch (err) {
    console.warn(`[prompt-resolver] DB lookup failed for agent=${agent}, falling back to default:`, err)
  }

  return { text: fallbackText, version: fallbackVersion }
}
