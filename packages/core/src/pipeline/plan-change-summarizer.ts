import { aiRunner } from '../ai'

export async function generatePlanChangeSummary(options: {
  previousPlan: string
  newPlan: string
  userFeedback: string
  model: string
}): Promise<string> {
  const { previousPlan, newPlan, userFeedback, model } = options

  const prompt = [
    'You are summarising what changed between two versions of a children\'s bedtime story plan.',
    'Write 1-2 short paragraphs in Russian explaining what was changed and why, based on the user\'s notes.',
    'Be specific about plot or character changes. Do not praise the plan. Do not use markdown.',
    '',
    'USER FEEDBACK / NOTES:',
    userFeedback || '(no explicit notes)',
    '',
    'PREVIOUS PLAN:',
    previousPlan,
    '',
    'NEW PLAN:',
    newPlan,
  ].join('\n')

  return aiRunner.runText({
    model,
    prompt,
    label: 'plan-change-summarizer',
  })
}
