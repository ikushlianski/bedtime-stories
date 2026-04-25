import { eq, desc } from 'drizzle-orm'
import { db } from '../../db/client'
import { feedback, prompts } from '../../db/schema'
import type { Feedback, Prompt } from '../../db/types'
import { aiRunner, AiValidationError, parseJsonWithSchema } from '../../ai'
import { ImproverOutputSchema, type ImproverOutput } from '../schemas'
import { resolveStageModel } from '../derivers/resolve-stage-model'

const RECENT_FEEDBACK_LIMIT = 10

const PASS_1_PROMPT_PREFIX = `You are analyzing user feedback on AI-generated bedtime stories. Summarize recurring patterns from these older feedback comments into a short list of themes (max 5 bullet points). Only include themes that appear at least twice.

Older feedback comments:
`

const PASS_2_PROMPT_PREFIX = `You are a prompt engineer analyzing user feedback to improve AI bedtime story generation. Based on the patterns below, propose specific, targeted edits to the agent prompts. For each proposed change, provide: which agent, the exact current text to replace, the exact proposed replacement text, rationale, and confidence (high/medium/low). Only propose changes supported by at least 2 feedback signals. Return JSON only, no commentary.

Return this exact JSON structure:
{
  "patterns": [{ "description": string, "evidence_count": number }],
  "proposed_changes": [{
    "agent": "plotter" | "plot_critic" | "writer" | "writer_critic",
    "current_text": string,
    "proposed_text": string,
    "rationale": string,
    "confidence": "high" | "medium" | "low"
  }]
}
`

async function fetchAgentRunFeedbacks(): Promise<Feedback[]> {
  return db
    .select()
    .from(feedback)
    .where(eq(feedback.feedbackType, 'agent_run'))
    .orderBy(desc(feedback.createdAt))
}

async function fetchCurrentPrompts(): Promise<Prompt[]> {
  const agentNames = ['plotter', 'plot_critic', 'writer', 'writer_critic'] as const

  const results: Prompt[] = []

  for (const agent of agentNames) {
    const [promptRow] = await db
      .select()
      .from(prompts)
      .where(eq(prompts.agent, agent))
      .orderBy(desc(prompts.version))
      .limit(1)

    if (promptRow) {
      results.push(promptRow)
    }
  }

  return results
}

async function runPass1(historicalFeedbacks: Feedback[]): Promise<string> {
  if (historicalFeedbacks.length === 0) {
    return ''
  }

  const feedbackLines = historicalFeedbacks
    .map((f, idx) => `${idx + 1}. Rating: ${f.rating ?? 'N/A'} — ${f.comment ?? '(no comment)'}`)
    .join('\n')

  const prompt = PASS_1_PROMPT_PREFIX + feedbackLines

  const choice = await resolveStageModel(null, 'improver')

  return aiRunner.runText({ model: choice.model, fallback: choice.fallback, prompt, label: 'improver:pass1', stage: 'improver' })
}

function buildPass2Prompt(
  historicalSummary: string,
  recentFeedbacks: Feedback[],
  currentPrompts: Prompt[],
): string {
  const parts: string[] = [PASS_2_PROMPT_PREFIX]

  if (historicalSummary) {
    parts.push(`HISTORICAL PATTERNS (compressed from older feedbacks):\n${historicalSummary}`)
  }

  const recentLines = recentFeedbacks
    .map(
      (f) =>
        `- id=${f.id} rating=${f.rating ?? 'N/A'}: ${f.comment ?? '(no comment)'}`,
    )
    .join('\n')

  parts.push(`LAST ${recentFeedbacks.length} FEEDBACKS (full):\n${recentLines}`)

  const promptLines = currentPrompts
    .map((p) => `Agent: ${p.agent ?? 'unknown'} (v${p.version})\n${p.text}`)
    .join('\n\n---\n\n')

  parts.push(`CURRENT AGENT PROMPTS:\n${promptLines}`)

  return parts.join('\n\n')
}

export async function runImprover(): Promise<ImproverOutput> {
  const allFeedbacks = await fetchAgentRunFeedbacks()

  const recentFeedbacks = allFeedbacks.slice(0, RECENT_FEEDBACK_LIMIT)
  const historicalFeedbacks = allFeedbacks.slice(RECENT_FEEDBACK_LIMIT)

  const historicalSummary = await runPass1(historicalFeedbacks)

  const currentPrompts = await fetchCurrentPrompts()

  const pass2Prompt = buildPass2Prompt(historicalSummary, recentFeedbacks, currentPrompts)

  const choice = await resolveStageModel(null, 'improver')

  const rawOutput = await aiRunner.runText({ model: choice.model, fallback: choice.fallback, prompt: pass2Prompt, label: 'improver:pass2', stage: 'improver' })

  const parsed = parseJsonWithSchema(rawOutput, ImproverOutputSchema)

  if (!parsed.ok) {
    throw new AiValidationError(rawOutput, parsed.error)
  }

  return parsed.value
}
