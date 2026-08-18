import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runPlanPhase, runPlotterOnly, runTextPhase, runPipeline } from './orchestrator'
import * as loadTopicsModule from './load-topics'
import * as plotterStage from './stages/plotter'
import * as plotCriticStage from './stages/plot-critic'
import * as writerStage from './stages/writer'
import * as writerCriticStage from './stages/writer-critic'
import * as loadMemorableMomentsModule from './load-memorable-moments'
import type { MemorableMomentRow } from './stages/memorable-moments'
import { selectStoryStructure } from './stages/story-structures'
import { selectCharacterLens } from './stages/character-lenses'

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
vi.mock('./load-memorable-moments', async () => {
  const actual = await vi.importActual<typeof import('./load-memorable-moments')>('./load-memorable-moments')
  return { ...actual, loadMemorableMoments: vi.fn().mockResolvedValue([]) }
})
vi.mock('./load-reaction-preferences', async () => {
  const actual = await vi.importActual<typeof import('./load-reaction-preferences')>('./load-reaction-preferences')
  return { ...actual, loadReactionPreferences: vi.fn().mockResolvedValue(null) }
})
vi.mock('./load-recent-titles', async () => {
  const actual = await vi.importActual<typeof import('./load-recent-titles')>('./load-recent-titles')
  return { ...actual, loadRecentTitles: vi.fn().mockResolvedValue([]) }
})
vi.mock('./load-topics', async () => {
  const actual = await vi.importActual<typeof import('./load-topics')>('./load-topics')
  return { ...actual, loadEligibleTopics: vi.fn().mockResolvedValue([]), loadTopicsByIds: vi.fn().mockResolvedValue([]) }
})
vi.mock('./load-reference-story', async () => {
  const actual = await vi.importActual<typeof import('./load-reference-story')>('./load-reference-story')
  return { ...actual, loadReferenceStory: vi.fn().mockResolvedValue(null) }
})

const baseModels = {
  plotter: 'claude-sonnet-4-6',
  plotCritic: 'claude-haiku-4-5-20251001',
  writer: 'claude-sonnet-4-6',
  writerCritic: 'claude-haiku-4-5-20251001',
  plotterQuestions: 'claude-haiku-4-5-20251001',
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

describe('memorable moments propagation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(loadMemorableMomentsModule.loadMemorableMoments).mockResolvedValue([])
  })

  const moment: MemorableMomentRow = {
    type: 'sasha_loved',
    selectedText: 'Гоша нашёл говорящую рыбку под мостом',
    noteText: null,
    storyTitle: 'Рыбка под мостом',
  }

  it('passes a qualifying memorable moment from the loader into runPlotter', async () => {
    vi.mocked(loadMemorableMomentsModule.loadMemorableMoments).mockResolvedValue([moment])
    vi.mocked(plotterStage.runPlotter).mockResolvedValue('plan-v1')

    await runPlanPhase({
      seed: 'seed',
      storyId: 1,
      models: baseModels,
      promptVersions: baseVersions,
      universeIds: [42],
    })

    expect(loadMemorableMomentsModule.loadMemorableMoments).toHaveBeenCalledWith([42], 1)
    const callArgs = vi.mocked(plotterStage.runPlotter).mock.calls[0]?.[0]
    expect(callArgs?.memorableMoments).toEqual([moment])
  })

  it('omits memorableMoments from the runPlotter call when the loader finds nothing', async () => {
    vi.mocked(loadMemorableMomentsModule.loadMemorableMoments).mockResolvedValue([])
    vi.mocked(plotterStage.runPlotter).mockResolvedValue('plan-v1')

    await runPlanPhase({
      seed: 'seed',
      storyId: 1,
      models: baseModels,
      promptVersions: baseVersions,
      universeIds: [42],
    })

    const callArgs = vi.mocked(plotterStage.runPlotter).mock.calls[0]?.[0]
    expect(callArgs?.memorableMoments).toBeUndefined()
  })

  it('passes a qualifying memorable moment from the loader into runWriter', async () => {
    vi.mocked(loadMemorableMomentsModule.loadMemorableMoments).mockResolvedValue([moment])
    vi.mocked(writerStage.runWriter).mockResolvedValue('text-v1')

    await runTextPhase({
      seed: 'seed',
      planFinal: 'approved-plan',
      storyId: 1,
      models: baseModels,
      promptVersions: baseVersions,
      universeIds: [42],
    })

    expect(loadMemorableMomentsModule.loadMemorableMoments).toHaveBeenCalledWith([42], 1)
    const callArgs = vi.mocked(writerStage.runWriter).mock.calls[0]?.[0]
    expect(callArgs?.memorableMoments).toEqual([moment])
  })

  it('omits memorableMoments from the runWriter call when the loader finds nothing', async () => {
    vi.mocked(loadMemorableMomentsModule.loadMemorableMoments).mockResolvedValue([])
    vi.mocked(writerStage.runWriter).mockResolvedValue('text-v1')

    await runTextPhase({
      seed: 'seed',
      planFinal: 'approved-plan',
      storyId: 1,
      models: baseModels,
      promptVersions: baseVersions,
      universeIds: [42],
    })

    const callArgs = vi.mocked(writerStage.runWriter).mock.calls[0]?.[0]
    expect(callArgs?.memorableMoments).toBeUndefined()
  })
})

describe('story structure/lens propagation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes the storyId-resolved structure and lens into runPlotter', async () => {
    vi.mocked(plotterStage.runPlotter).mockResolvedValue('plan-v1')

    await runPlanPhase({
      seed: 'seed',
      storyId: 5,
      models: baseModels,
      promptVersions: baseVersions,
    })

    const callArgs = vi.mocked(plotterStage.runPlotter).mock.calls[0]?.[0]
    expect(callArgs?.structure).toEqual(selectStoryStructure(5))
    expect(callArgs?.characterLens).toEqual(selectCharacterLens(5))
  })

  it('passes the storyId-resolved structure and lens into runWriter', async () => {
    vi.mocked(writerStage.runWriter).mockResolvedValue('text-v1')

    await runTextPhase({
      seed: 'seed',
      planFinal: 'approved-plan',
      storyId: 5,
      models: baseModels,
      promptVersions: baseVersions,
    })

    const callArgs = vi.mocked(writerStage.runWriter).mock.calls[0]?.[0]
    expect(callArgs?.structure).toEqual(selectStoryStructure(5))
    expect(callArgs?.characterLens).toEqual(selectCharacterLens(5))
  })

  it('resolves the plotter and writer to the exact same structure and lens for a given storyId', async () => {
    vi.mocked(plotterStage.runPlotter).mockResolvedValue('plan-v1')
    vi.mocked(writerStage.runWriter).mockResolvedValue('text-v1')

    await runPlanPhase({ seed: 'seed', storyId: 11, models: baseModels, promptVersions: baseVersions })
    await runTextPhase({ seed: 'seed', planFinal: 'approved-plan', storyId: 11, models: baseModels, promptVersions: baseVersions })

    const plotterArgs = vi.mocked(plotterStage.runPlotter).mock.calls[0]?.[0]
    const writerArgs = vi.mocked(writerStage.runWriter).mock.calls[0]?.[0]

    expect(plotterArgs?.structure).toEqual(writerArgs?.structure)
    expect(plotterArgs?.characterLens).toEqual(writerArgs?.characterLens)
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

describe('model fallback propagation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes the resolved plotter fallback into runPlotter for runPlanPhase', async () => {
    vi.mocked(plotterStage.runPlotter).mockResolvedValue('plan-v1')

    await runPlanPhase({
      seed: 'seed',
      storyId: 1,
      models: baseModels,
      fallbacks: { plotter: 'deepseek/deepseek-v4-flash' },
      promptVersions: baseVersions,
    })

    const callArgs = vi.mocked(plotterStage.runPlotter).mock.calls[0]?.[0]
    expect(callArgs?.fallback).toBe('deepseek/deepseek-v4-flash')
  })

  it('omits fallback from the runPlotter call when none was resolved', async () => {
    vi.mocked(plotterStage.runPlotter).mockResolvedValue('plan-v1')

    await runPlanPhase({
      seed: 'seed',
      storyId: 1,
      models: baseModels,
      promptVersions: baseVersions,
    })

    const callArgs = vi.mocked(plotterStage.runPlotter).mock.calls[0]?.[0]
    expect(callArgs?.fallback).toBeUndefined()
  })

  it('passes the resolved writer fallback into runWriter for runTextPhase', async () => {
    vi.mocked(writerStage.runWriter).mockResolvedValue('text-v1')

    await runTextPhase({
      seed: 'seed',
      planFinal: 'approved-plan',
      storyId: 1,
      models: baseModels,
      fallbacks: { writer: 'deepseek/deepseek-v4-flash' },
      promptVersions: baseVersions,
    })

    const callArgs = vi.mocked(writerStage.runWriter).mock.calls[0]?.[0]
    expect(callArgs?.fallback).toBe('deepseek/deepseek-v4-flash')
  })

  it('passes the resolved plotter fallback into runPlotter for runPlotterOnly', async () => {
    vi.mocked(plotterStage.runPlotter).mockResolvedValue('plan-v1')

    await runPlotterOnly({
      seed: 'seed',
      storyId: 1,
      models: baseModels,
      fallbacks: { plotter: 'deepseek/deepseek-v4-flash' },
      promptVersions: baseVersions,
    })

    const callArgs = vi.mocked(plotterStage.runPlotter).mock.calls[0]?.[0]
    expect(callArgs?.fallback).toBe('deepseek/deepseek-v4-flash')
  })
})

describe('manualTopicIds replacing the auto-pool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const manualTopics = [
    { id: 5, title: 'Manual topic', note: null, rank: 0, usedCount: 0 },
  ]

  it('loads the manually selected topics instead of the auto-pool for runPlanPhase', async () => {
    vi.mocked(loadTopicsModule.loadTopicsByIds).mockResolvedValue(manualTopics)
    vi.mocked(plotterStage.runPlotter).mockResolvedValue('plan-v1')

    const result = await runPlanPhase({
      seed: 'seed',
      storyId: 1,
      models: baseModels,
      promptVersions: baseVersions,
      injectTopics: true,
      manualTopicIds: [5],
    })

    expect(loadTopicsModule.loadTopicsByIds).toHaveBeenCalledWith([5])
    expect(loadTopicsModule.loadEligibleTopics).not.toHaveBeenCalled()

    const callArgs = vi.mocked(plotterStage.runPlotter).mock.calls[0]?.[0]
    expect(callArgs?.eligibleTopics).toEqual(manualTopics)
    expect(callArgs?.topicsMode).toBe('manual')
    expect(result.usedTopicIds).toEqual([5])
  })

  it('uses auto topicsMode when no manual selection is provided', async () => {
    vi.mocked(loadTopicsModule.loadEligibleTopics).mockResolvedValue([
      { id: 9, title: 'Pool topic', note: null, rank: 0, usedCount: 0 },
    ])
    vi.mocked(plotterStage.runPlotter).mockResolvedValue('plan-v1')

    await runPlanPhase({
      seed: 'seed',
      storyId: 1,
      models: baseModels,
      promptVersions: baseVersions,
      injectTopics: true,
    })

    const callArgs = vi.mocked(plotterStage.runPlotter).mock.calls[0]?.[0]
    expect(callArgs?.topicsMode).toBe('auto')
  })

  it('records all manually selected topics as used even if the plotter footer omits one', async () => {
    vi.mocked(loadTopicsModule.loadTopicsByIds).mockResolvedValue([
      { id: 5, title: 'A', note: null, rank: 0, usedCount: 0 },
      { id: 7, title: 'B', note: null, rank: 0, usedCount: 0 },
    ])
    vi.mocked(plotterStage.runPlotter).mockResolvedValue('plan-v1\nТЕМЫ: 5')

    const result = await runPlanPhase({
      seed: 'seed',
      storyId: 1,
      models: baseModels,
      promptVersions: baseVersions,
      manualTopicIds: [5, 7],
    })

    expect(result.usedTopicIds).toEqual([5, 7])
  })

  it('loads the manually selected topics instead of the auto-pool for runPlotterOnly', async () => {
    vi.mocked(loadTopicsModule.loadTopicsByIds).mockResolvedValue(manualTopics)
    vi.mocked(plotterStage.runPlotter).mockResolvedValue('plan-v1')

    const result = await runPlotterOnly({
      seed: 'seed',
      storyId: 1,
      models: baseModels,
      promptVersions: baseVersions,
      injectTopics: true,
      manualTopicIds: [5],
    })

    expect(loadTopicsModule.loadTopicsByIds).toHaveBeenCalledWith([5])
    expect(loadTopicsModule.loadEligibleTopics).not.toHaveBeenCalled()
    expect(result.usedTopicIds).toEqual([5])
  })
})
