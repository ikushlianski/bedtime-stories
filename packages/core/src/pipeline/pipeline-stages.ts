export enum PipelineStage {
  PLOTTER = 'plotter',
  WRITER = 'writer',
  PLOTTER_QUESTIONS = 'plotterQuestions',
}

export const PIPELINE_STAGES = [
  PipelineStage.PLOTTER,
  PipelineStage.WRITER,
  PipelineStage.PLOTTER_QUESTIONS,
] as const

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  [PipelineStage.PLOTTER]: 'Сюжетник',
  [PipelineStage.WRITER]: 'Писатель',
  [PipelineStage.PLOTTER_QUESTIONS]: 'Вопросы к сиду',
}

export function getPipelineStageLabel(stage: PipelineStage): string {
  return PIPELINE_STAGE_LABELS[stage]
}
