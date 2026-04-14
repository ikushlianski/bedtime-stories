import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runPlanPhase, runTextPhase, runPipeline } from './orchestrator'
import * as plotterStage from './stages/plotter'
import * as psychologistStage from './stages/psychologist'
import * as plotCriticStage from './stages/plot-critic'
import * as writerStage from './stages/writer'
import * as writerCriticStage from './stages/writer-critic'
import type { PsychologistOutput, CriticOutput } from './schemas'

vi.mock('./stages/plotter', async () => {
  const actual = await vi.importActual<typeof import('./stages/plotter')>('./stages/plotter')
  return { ...actual, runPlotter: vi.fn() }
})
vi.mock('./stages/psychologist')
vi.mock('./stages/plot-critic')
vi.mock('./stages/writer', async () => {
  const actual = await vi.importActual<typeof import('./stages/writer')>('./stages/writer')
  return { ...actual, runWriter: vi.fn() }
})
vi.mock('./stages/writer-critic')
vi.mock('./prompt-resolver', () => ({
  resolvePrompt: vi.fn().mockResolvedValue({ text: 'mocked prompt', version: 1 }),
}))

const baseModels = {
  plotter: 'claude-sonnet-4-6',
  psychologist: 'claude-sonnet-4-6',
  plotCritic: 'claude-haiku-4-5-20251001',
  writer: 'claude-sonnet-4-6',
  writerCritic: 'claude-haiku-4-5-20251001',
}

const baseVersions = {
  plotter: 1,
  psychologistPlan: 1,
  psychologistText: 1,
  plotCritic: 1,
  writer: 1,
  writerCritic: 1,
}

const safePsychologistOutput: PsychologistOutput = {
  safety: { verdict: 'safe', issues: [] },
  therapeutic: { score: 4, strengths: ['warmth'], gaps: [] },
  recommended_changes: [],
}

const acceptedCriticOutput: CriticOutput = {
  issues: [],
  improvement_needed: false,
}

const needsRevisionCriticOutput: CriticOutput = {
  issues: [{ prio: 'must', description: 'weak humor' }],
  improvement_needed: true,
}

describe('runPlanPhase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('when the first plan is already accepted by the critic', () => {
    it('runs plotter once, psychologist once, critic once, and returns immediately', async () => {
      vi.mocked(plotterStage.runPlotter).mockResolvedValue('plan-v1')
      vi.mocked(psychologistStage.runPsychologist).mockResolvedValue(safePsychologistOutput)
      vi.mocked(plotCriticStage.runPlotCritic).mockResolvedValue(acceptedCriticOutput)

      const result = await runPlanPhase({
        seed: 'seed',
        storyId: 1,
        models: baseModels,
        promptVersions: baseVersions,
      })

      expect(plotterStage.runPlotter).toHaveBeenCalledTimes(1)
      expect(psychologistStage.runPsychologist).toHaveBeenCalledTimes(1)
      expect(plotCriticStage.runPlotCritic).toHaveBeenCalledTimes(1)
      expect(result.planV1).toBe('plan-v1')
      expect(result.planFinal).toBe('plan-v1')
      expect(result.planIterationsCount).toBe(1)
    })
  })

  describe('when the critic requests revisions twice before accepting', () => {
    it('runs up to 3 plotter calls, psychologist only on iterations 1 and 3', async () => {
      vi.mocked(plotterStage.runPlotter)
        .mockResolvedValueOnce('plan-v1')
        .mockResolvedValueOnce('plan-v2')
        .mockResolvedValueOnce('plan-v3')
      vi.mocked(psychologistStage.runPsychologist).mockResolvedValue(safePsychologistOutput)
      vi.mocked(plotCriticStage.runPlotCritic)
        .mockResolvedValueOnce(needsRevisionCriticOutput)
        .mockResolvedValueOnce(needsRevisionCriticOutput)
        .mockResolvedValueOnce(acceptedCriticOutput)

      const result = await runPlanPhase({
        seed: 'seed',
        storyId: 1,
        models: baseModels,
        promptVersions: baseVersions,
      })

      expect(plotterStage.runPlotter).toHaveBeenCalledTimes(3)
      expect(psychologistStage.runPsychologist).toHaveBeenCalledTimes(2)
      expect(plotCriticStage.runPlotCritic).toHaveBeenCalledTimes(3)
      expect(result.planIterationsCount).toBe(3)
      expect(result.planFinal).toBe('plan-v3')
    })
  })

  describe('when every iteration requires revision', () => {
    it('stops after MAX_PLAN_ITERATIONS (3) and returns the last plan', async () => {
      vi.mocked(plotterStage.runPlotter)
        .mockResolvedValueOnce('plan-v1')
        .mockResolvedValueOnce('plan-v2')
        .mockResolvedValueOnce('plan-v3')
      vi.mocked(psychologistStage.runPsychologist).mockResolvedValue(safePsychologistOutput)
      vi.mocked(plotCriticStage.runPlotCritic).mockResolvedValue(needsRevisionCriticOutput)

      const result = await runPlanPhase({
        seed: 'seed',
        storyId: 1,
        models: baseModels,
        promptVersions: baseVersions,
      })

      expect(result.planIterationsCount).toBe(3)
      expect(result.planFinal).toBe('plan-v3')
    })
  })

  describe('psychologist invocation pattern', () => {
    it('calls psychologist only on first and final iteration, not intermediate ones', async () => {
      vi.mocked(plotterStage.runPlotter)
        .mockResolvedValue('plan')
      vi.mocked(psychologistStage.runPsychologist).mockResolvedValue(safePsychologistOutput)
      vi.mocked(plotCriticStage.runPlotCritic).mockResolvedValue(needsRevisionCriticOutput)

      await runPlanPhase({
        seed: 'seed',
        storyId: 1,
        models: baseModels,
        promptVersions: baseVersions,
      })

      expect(psychologistStage.runPsychologist).toHaveBeenCalledTimes(2)
    })

    it('always passes contentType "plan" during plan phase', async () => {
      vi.mocked(plotterStage.runPlotter).mockResolvedValue('plan-v1')
      vi.mocked(psychologistStage.runPsychologist).mockResolvedValue(safePsychologistOutput)
      vi.mocked(plotCriticStage.runPlotCritic).mockResolvedValue(acceptedCriticOutput)

      await runPlanPhase({
        seed: 'seed',
        storyId: 1,
        models: baseModels,
        promptVersions: baseVersions,
      })

      expect(psychologistStage.runPsychologist).toHaveBeenCalledWith(
        expect.objectContaining({ contentType: 'plan' }),
      )
    })
  })

  describe('text phase separation', () => {
    it('never calls the writer during the plan phase', async () => {
      vi.mocked(plotterStage.runPlotter).mockResolvedValue('plan-v1')
      vi.mocked(psychologistStage.runPsychologist).mockResolvedValue(safePsychologistOutput)
      vi.mocked(plotCriticStage.runPlotCritic).mockResolvedValue(acceptedCriticOutput)

      await runPlanPhase({
        seed: 'seed',
        storyId: 1,
        models: baseModels,
        promptVersions: baseVersions,
      })

      expect(writerStage.runWriter).not.toHaveBeenCalled()
      expect(writerCriticStage.runWriterCritic).not.toHaveBeenCalled()
    })
  })
})

describe('runTextPhase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('when given an already-approved plan', () => {
    it('runs writer twice, critic once, psychologist once on text content', async () => {
      vi.mocked(writerStage.runWriter)
        .mockResolvedValueOnce('text-v1')
        .mockResolvedValueOnce('text-v2')
      vi.mocked(psychologistStage.runPsychologist).mockResolvedValue(safePsychologistOutput)
      vi.mocked(writerCriticStage.runWriterCritic).mockResolvedValue(acceptedCriticOutput)

      const result = await runTextPhase({
        seed: 'seed',
        planFinal: 'approved-plan',
        storyId: 1,
        models: baseModels,
        promptVersions: baseVersions,
      })

      expect(writerStage.runWriter).toHaveBeenCalledTimes(2)
      expect(psychologistStage.runPsychologist).toHaveBeenCalledTimes(1)
      expect(writerCriticStage.runWriterCritic).toHaveBeenCalledTimes(1)
      expect(result.textV1).toBe('text-v1')
      expect(result.textV2).toBe('text-v2')
    })

    it('passes contentType "text" to the psychologist during text phase', async () => {
      vi.mocked(writerStage.runWriter)
        .mockResolvedValueOnce('text-v1')
        .mockResolvedValueOnce('text-v2')
      vi.mocked(psychologistStage.runPsychologist).mockResolvedValue(safePsychologistOutput)
      vi.mocked(writerCriticStage.runWriterCritic).mockResolvedValue(acceptedCriticOutput)

      await runTextPhase({
        seed: 'seed',
        planFinal: 'approved-plan',
        storyId: 1,
        models: baseModels,
        promptVersions: baseVersions,
      })

      expect(psychologistStage.runPsychologist).toHaveBeenCalledWith(
        expect.objectContaining({ contentType: 'text' }),
      )
    })

    it('never calls plotter or plot-critic during the text phase', async () => {
      vi.mocked(writerStage.runWriter)
        .mockResolvedValueOnce('text-v1')
        .mockResolvedValueOnce('text-v2')
      vi.mocked(psychologistStage.runPsychologist).mockResolvedValue(safePsychologistOutput)
      vi.mocked(writerCriticStage.runWriterCritic).mockResolvedValue(acceptedCriticOutput)

      await runTextPhase({
        seed: 'seed',
        planFinal: 'approved-plan',
        storyId: 1,
        models: baseModels,
        promptVersions: baseVersions,
      })

      expect(plotterStage.runPlotter).not.toHaveBeenCalled()
      expect(plotCriticStage.runPlotCritic).not.toHaveBeenCalled()
    })
  })
})

describe('runPipeline (legacy one-shot, plan + text)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('composes runPlanPhase then runTextPhase and returns the merged result', async () => {
    vi.mocked(plotterStage.runPlotter).mockResolvedValue('plan-v1')
    vi.mocked(psychologistStage.runPsychologist).mockResolvedValue(safePsychologistOutput)
    vi.mocked(plotCriticStage.runPlotCritic).mockResolvedValue(acceptedCriticOutput)
    vi.mocked(writerStage.runWriter)
      .mockResolvedValueOnce('text-v1')
      .mockResolvedValueOnce('text-v2')
    vi.mocked(writerCriticStage.runWriterCritic).mockResolvedValue(acceptedCriticOutput)

    const result = await runPipeline({
      seed: 'seed',
      storyId: 1,
      models: baseModels,
      promptVersions: baseVersions,
    })

    expect(result.planV1).toBe('plan-v1')
    expect(result.planFinal).toBe('plan-v1')
    expect(result.textV1).toBe('text-v1')
    expect(result.textV2).toBe('text-v2')
  })
})
