import { z } from 'zod'
import { aiRunner } from '../ai'

const AnnotationResolutionsSchema = z.object({
  resolutions: z.array(
    z.object({
      annotation_id: z.number().int(),
      summary: z.string(),
    }),
  ),
})

export interface AnnotationInput {
  id: number
  selectedText: string
  noteText: string
}

export async function resolveAnnotations(options: {
  previousVersion: string
  newVersion: string
  annotations: AnnotationInput[]
  model: string
  versionLabel?: string
}): Promise<Map<number, string>> {
  const { previousVersion, newVersion, annotations, model, versionLabel = 'план' } = options

  if (annotations.length === 0) return new Map()

  const annotationBlock = annotations
    .map((a) => `ID ${a.id}: к фрагменту «${a.selectedText}» — ${a.noteText}`)
    .join('\n')

  const prompt = [
    `Ты получаешь список комментариев родителя к ${versionLabel}у, старую версию и новую версию.`,
    `Для каждого комментария напиши 1-2 предложения на русском: что именно было изменено в новой версии в ответ на этот комментарий.`,
    `Если комментарий не был учтён — честно скажи об этом.`,
    `Будь конкретным. Не хвали. Не используй markdown.`,
    '',
    'КОММЕНТАРИИ РОДИТЕЛЯ:',
    annotationBlock,
    '',
    `СТАРЫЙ ${versionLabel.toUpperCase()}:`,
    previousVersion,
    '',
    `НОВЫЙ ${versionLabel.toUpperCase()}:`,
    newVersion,
  ].join('\n')

  const result = await aiRunner.runStructured({
    skill: 'annotation-resolver',
    model,
    prompt,
    outputSchema: AnnotationResolutionsSchema,
  })

  return new Map(result.resolutions.map((r) => [r.annotation_id, r.summary]))
}
