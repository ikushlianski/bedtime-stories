import { describe, it, expect } from 'vitest'
import {
  buildPlanSnapshotInsert,
  buildTextSnapshotUpdate,
  buildPlanStoriesUpdate,
  buildTextStoriesUpdate,
} from './pipeline-persistence'
import type { PlanPhaseResult, TextPhaseResult } from '@bedtime/core/pipeline/orchestrator'
import type { CriticOutput } from '@bedtime/core/pipeline/schemas'

const plotCriticOutput: CriticOutput = { issues: [], improvement_needed: false }
const writerCriticOutput: CriticOutput = { issues: [], improvement_needed: false }

const basePlan: PlanPhaseResult = {
  planV1: 'plan draft one',
  planFinal: 'plan final version',
  planIterationsCount: 2,
  titleSuggested: 'Волшебный лес',
  sashaContext: null,
  plotCriticOutput,
  models: {
    plotter: 'claude-sonnet-4-6',
    plotCritic: 'claude-haiku-4-5-20251001',
    writer: 'claude-sonnet-4-6',
    writerCritic: 'claude-haiku-4-5-20251001',
  },
  promptVersions: {
    plotter: 3,
    plotCritic: 2,
    writer: 4,
    writerCritic: 1,
  },
}

const baseText: TextPhaseResult = {
  textV1: 'text draft one',
  textV2: 'text final version',
  writerCriticOutput,
  models: {
    plotter: 'claude-sonnet-4-6',
    plotCritic: 'claude-haiku-4-5-20251001',
    writer: 'claude-sonnet-4-6',
    writerCritic: 'claude-haiku-4-5-20251001',
  },
  promptVersions: {
    plotter: 3,
    plotCritic: 2,
    writer: 5,
    writerCritic: 2,
  },
}

describe('buildPlanSnapshotInsert', () => {
  it('writes plan-related columns and sets psychologist fields to null', () => {
    const row = buildPlanSnapshotInsert(42, basePlan)

    expect(row.storyId).toBe(42)
    expect(row.plotterModel).toBe('claude-sonnet-4-6')
    expect(row.plotterPromptVersion).toBe(3)
    expect(row.psychologistPlanModel).toBeNull()
    expect(row.psychologistPlanPromptVersion).toBeNull()
    expect(row.plotCriticModel).toBe('claude-haiku-4-5-20251001')
    expect(row.plotCriticPromptVersion).toBe(2)
    expect(row.planV1).toBe('plan draft one')
    expect(row.planFinal).toBe('plan final version')
    expect(row.planIterationsCount).toBe(2)
    expect(row.psychologistPlanOutput).toBeNull()
    expect(row.plotCriticOutput).toBe(plotCriticOutput)
  })

  it('does not leak writer/critic/psychologist-text model or version', () => {
    const row = buildPlanSnapshotInsert(42, basePlan)

    expect(row.writerModel).toBeUndefined()
    expect(row.writerPromptVersion).toBeUndefined()
    expect(row.writerCriticModel).toBeUndefined()
    expect(row.writerCriticPromptVersion).toBeUndefined()
    expect(row.textV1).toBeUndefined()
    expect(row.textV2).toBeUndefined()
    expect(row.writerCriticOutput).toBeUndefined()
  })
})

describe('buildTextSnapshotUpdate', () => {
  it('writes text-related columns and sets psychologist fields to null', () => {
    const update = buildTextSnapshotUpdate(baseText)

    expect(update.writerModel).toBe('claude-sonnet-4-6')
    expect(update.writerPromptVersion).toBe(5)
    expect(update.psychologistTextModel).toBeNull()
    expect(update.psychologistTextPromptVersion).toBeNull()
    expect(update.writerCriticModel).toBe('claude-haiku-4-5-20251001')
    expect(update.writerCriticPromptVersion).toBe(2)
    expect(update.textV1).toBe('text draft one')
    expect(update.textV2).toBe('text final version')
    expect(update.psychologistTextOutput).toBeNull()
    expect(update.writerCriticOutput).toBe(writerCriticOutput)
  })

  it('does not overwrite plan-related columns in the snapshot', () => {
    const update = buildTextSnapshotUpdate(baseText)

    expect(update.plotterModel).toBeUndefined()
    expect(update.plotterPromptVersion).toBeUndefined()
    expect(update.psychologistPlanModel).toBeUndefined()
    expect(update.psychologistPlanPromptVersion).toBeUndefined()
    expect(update.plotCriticModel).toBeUndefined()
    expect(update.plotCriticPromptVersion).toBeUndefined()
    expect(update.planV1).toBeUndefined()
    expect(update.planFinal).toBeUndefined()
    expect(update.planIterationsCount).toBeUndefined()
  })
})

describe('buildPlanStoriesUpdate', () => {
  it('writes plan, plotter, and plot-critic fields for the stories row', () => {
    const update = buildPlanStoriesUpdate(basePlan)

    expect(update).toEqual({
      title: 'Волшебный лес',
      planV1: 'plan draft one',
      planFinal: 'plan final version',
      planIterations: 2,
      plotterModel: 'claude-sonnet-4-6',
      plotterPromptVersion: 3,
      plotCriticModel: 'claude-haiku-4-5-20251001',
      plotCriticPromptVersion: 2,
    })
  })
})

describe('buildTextStoriesUpdate', () => {
  it('writes text, writer, and writer-critic fields for the stories row', () => {
    const update = buildTextStoriesUpdate(baseText)

    expect(update).toEqual({
      textV1: 'text draft one',
      textV2: 'text final version',
      writerModel: 'claude-sonnet-4-6',
      writerPromptVersion: 5,
      writerCriticModel: 'claude-haiku-4-5-20251001',
      writerCriticPromptVersion: 2,
    })
  })
})
