import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runPlanPhase, runTextPhase, runPipeline } from './orchestrator'
import * as plotterStage from './stages/plotter'
import * as plotCriticStage from './stages/plot-critic'
import * as writerStage from './stages/writer'
import * as writerCriticStage from './stages/writer-critic'

vi.mock('@bedtime/observability', () => ({
  withPipelineTrace: vi.fn((_id: string, fn: (trace: unknown) => Promise<unknown>) => fn({})),
  addStoryContext: vi.fn(),
  langfuse: {
    generation: vi.fn(() => ({ end: vi.fn() })),
    trace: vi.fn(() => ({})),
    flushAsync: vi.fn(),
  },
}))

vi.mock('../env', () => ({
  env: {
    OPENROUTER_API_KEY: 'test-key',
    JWT_SECRET: 'test-secret-that-is-long-enough-32chars',
  },
}))

vi.mock('../db/client', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => []),
        })),
      })),
    })),
  },
}))

vi.mock('./stages/plotter', async () => {
  const actual = await vi.importActual<typeof import('./stages/plotter')>('./stages/plotter')
  return { ...actual, runPlotter: vi.fn() }
})
vi.mock('./stages/plot-critic')
vi.mock('./stages/title-generator', () => ({
  generateStoryTitle: vi.fn().mockResolvedValue('Mocked Title'),
}))
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
  plotCritic: 'claude-haiku-4-5-20251001',
  writer: 'claude-sonnet-4-6',
  writerCritic: 'claude-haiku-4-5-20251001',
}

const baseVersions = {
  plotter: 1,
  plotCritic: 1,
  writer: 1,
  writerCritic: 1,
}

describe('runPlanPhase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('runs plotter once and returns plan without critic loop', async () => {
    vi.mocked(plotterStage.runPlotter).mockResolvedValue('plan-v1')

    const result = await runPlanPhase({
      seed: 'seed',
      storyId: 1,
      models: baseModels,
      promptVersions: baseVersions,
    })

    expect(plotterStage.runPlotter).toHaveBeenCalledTimes(1)
    expect(plotCriticStage.runPlotCritic).not.toHaveBeenCalled()
    expect(result.planV1).toBe('plan-v1')
    expect(result.planFinal).toBe('plan-v1')
    expect(result.planIterationsCount).toBe(1)
  })

  it('never calls the writer during the plan phase', async () => {
    vi.mocked(plotterStage.runPlotter).mockResolvedValue('plan-v1')

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

describe('runTextPhase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('runs writer once and returns text without critic loop', async () => {
    vi.mocked(writerStage.runWriter).mockResolvedValue('text-v1')

    const result = await runTextPhase({
      seed: 'seed',
      planFinal: 'approved-plan',
      storyId: 1,
      models: baseModels,
      promptVersions: baseVersions,
    })

    expect(writerStage.runWriter).toHaveBeenCalledTimes(1)
    expect(writerCriticStage.runWriterCritic).not.toHaveBeenCalled()
    expect(result.textV1).toBe('text-v1')
    expect(result.textV2).toBe('text-v1')
  })

  it('never calls plotter or plot-critic during the text phase', async () => {
    vi.mocked(writerStage.runWriter).mockResolvedValue('text-v1')

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

describe('runPipeline (legacy one-shot, plan + text)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('composes runPlanPhase then runTextPhase and returns the merged result', async () => {
    vi.mocked(plotterStage.runPlotter).mockResolvedValue('plan-v1')
    vi.mocked(writerStage.runWriter).mockResolvedValue('text-v1')

    const result = await runPipeline({
      seed: 'seed',
      storyId: 1,
      models: baseModels,
      promptVersions: baseVersions,
    })

    expect(result.planV1).toBe('plan-v1')
    expect(result.planFinal).toBe('plan-v1')
    expect(result.textV1).toBe('text-v1')
    expect(result.textV2).toBe('text-v1')
  })
})
