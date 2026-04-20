import { claudeCliRunner } from '../ai'

export async function generateTextChangeSummary(options: {
  previousText: string
  newText: string
  annotationFeedback: string
  model: string
}): Promise<string> {
  const { previousText, newText, annotationFeedback, model } = options

  const prompt = [
    'You are summarising what changed between two versions of a children\'s bedtime story.',
    'Write 1-2 short paragraphs in Russian explaining what was changed and why, based on the annotations.',
    'Be specific about narrative or character changes. Do not praise the story. Do not use markdown.',
    '',
    'ANNOTATION FEEDBACK / NOTES:',
    annotationFeedback || '(no explicit notes)',
    '',
    'PREVIOUS TEXT:',
    previousText,
    '',
    'NEW TEXT:',
    newText,
  ].join('\n')

  return claudeCliRunner.runText({
    model,
    prompt,
    label: 'text-change-summarizer',
  })
}
