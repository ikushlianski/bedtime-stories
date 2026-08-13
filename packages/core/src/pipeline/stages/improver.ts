import { eq, desc } from 'drizzle-orm'
import { db } from '../../db/client'
import { feedback, prompts } from '../../db/schema'
import type { Feedback, Prompt } from '../../db/types'
import { aiRunner, AiValidationError, parseJsonWithSchema } from '../../ai'
import { ImproverOutputSchema, type ImproverOutput } from '../schemas'
import { resolveStageModel } from '../derivers/resolve-stage-model'

const RECENT_FEEDBACK_LIMIT = 10
const FREE_TEXT_FIELD_MAX_LENGTH = 200

type StructuredFeedbackShape = NonNullable<Feedback['structuredFeedback']>

export type PartialStructuredFeedback =
  | { [K in keyof StructuredFeedbackShape]?: StructuredFeedbackShape[K] | null }
  | null
  | undefined

export const PASS_1_PROMPT_PREFIX = `You are analyzing user feedback on AI-generated bedtime stories. Summarize recurring patterns from these older feedback entries, including both free-text comments and structured signals (e.g. repeated \`Too long: yes\` across rows counts as a pattern just like a repeated comment theme), into a short list of themes (max 5 bullet points). Only include themes that appear at least twice.

Older feedback entries:
`

export const PASS_2_PROMPT_PREFIX = `You are a prompt engineer analyzing user feedback to improve AI bedtime story generation. Based on the patterns below, propose specific, targeted edits to the agent prompts. For each proposed change, provide: which agent, the exact current text to replace, the exact proposed replacement text, rationale, and confidence (high/medium/low). Only propose changes supported by at least 2 feedback signals — a structured field repeated across rows (e.g. \`Too long: yes\` on 2+ entries) counts as a feedback signal on its own, not only explicit comment text. Return JSON only, no commentary.

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

function truncateFreeText(value: string): string {
  const trimmed = value.trim()

  if (trimmed.length <= FREE_TEXT_FIELD_MAX_LENGTH) {
    return trimmed
  }

  return `${trimmed.slice(0, FREE_TEXT_FIELD_MAX_LENGTH)}…`
}

export function formatStructuredFeedback(sf: PartialStructuredFeedback): string {
  if (!sf) {
    return ''
  }

  const parts: string[] = []

  if (sf.enjoyed != null) {
    parts.push(`Enjoyed: ${sf.enjoyed}/5`)
  }

  if (sf.was_funny != null) {
    parts.push(`Funny: ${sf.was_funny ? 'yes' : 'no'}`)
  }

  if (sf.was_scary != null) {
    parts.push(`Scary: ${sf.was_scary ? 'yes' : 'no'}`)
  }

  if (sf.too_long != null) {
    parts.push(`Too long: ${sf.too_long ? 'yes' : 'no'}`)
  }

  if (sf.favorite_moment != null && sf.favorite_moment.trim() !== '') {
    parts.push(`Favorite moment: ${truncateFreeText(sf.favorite_moment)}`)
  }

  if (sf.favorite_character != null && sf.favorite_character.trim() !== '') {
    parts.push(`Favorite character: ${truncateFreeText(sf.favorite_character)}`)
  }

  if (sf.understood_moral != null) {
    parts.push(`Understood moral: ${sf.understood_moral ? 'yes' : 'no'}`)
  }

  if (sf.want_again != null) {
    parts.push(`Wants again: ${sf.want_again ? 'yes' : 'no'}`)
  }

  if (sf.notes != null && sf.notes.trim() !== '') {
    parts.push(`Notes: ${truncateFreeText(sf.notes)}`)
  }

  if (parts.length === 0) {
    return ''
  }

  return ` [${parts.join(', ')}]`
}

export function formatHistoricalFeedbackLines(feedbacks: Feedback[]): string {
  return feedbacks
    .map(
      (f, idx) =>
        `${idx + 1}. Rating: ${f.rating ?? 'N/A'} — ${f.comment ?? '(no comment)'}${formatStructuredFeedback(f.structuredFeedback)}`,
    )
    .join('\n')
}

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

  const feedbackLines = formatHistoricalFeedbackLines(historicalFeedbacks)

  const prompt = PASS_1_PROMPT_PREFIX + feedbackLines

  const choice = await resolveStageModel(null, 'improver')

  return aiRunner.runText({ model: choice.model, fallback: choice.fallback, prompt, label: 'improver:pass1', stage: 'improver' })
}

export function buildPass2Prompt(
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
        `- id=${f.id} rating=${f.rating ?? 'N/A'}: ${f.comment ?? '(no comment)'}${formatStructuredFeedback(f.structuredFeedback)}`,
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
