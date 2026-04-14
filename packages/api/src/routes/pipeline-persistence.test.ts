import { describe, it, expect } from 'vitest'
import {
  buildPlanSnapshotInsert,
  buildTextSnapshotUpdate,
  buildPlanStoriesUpdate,
  buildTextStoriesUpdate,
} from './pipeline-persistence'
import type { PlanPhaseResult, TextPhaseResult } from '@bedtime/core/pipeline/orchestrator'
import type { PsychologistOutput, CriticOutput } from '@bedtime/core/pipeline/schemas'

const psychologistPlanOutput: PsychologistOutput = {
  safety: { verdict: 'safe', issues: [] },
  therapeutic: { score: 4, strengths: ['warmth'], gaps: [] },
  recommended_changes: [],
}

const psychologistTextOutput: PsychologistOutput = {
  safety: { verdict: 'safe', issues: [] },
  therapeutic: { score: 5, strengths: ['resolution'], gaps: [] },
  recommended_changes: [],
}

const plotCriticOutput: CriticOutput = { issues: [], improvement_needed: false }
const writerCriticOutput: CriticOutput = { issues: [], improvement_needed: false }

const basePlan: PlanPhaseResult = {
  planV1: 'plan draft one',
  planFinal: 'plan final version',
  planIterationsCount: 2,
  psychologistPlanOutput,
  plotCriticOutput,
  models: {
    plotter: 'claude-sonnet-4-6',
    psychologist: 'claude-sonnet-4-6',
    plotCritic: 'claude-haiku-4-5-20251001',
    writer: 'claude-sonnet-4-6',
    writerCritic: 'claude-haiku-4-5-20251001',
  },
  promptVersions: {
    plotter: 3,
    psychologistPlan: 1,
    psychologistText: 1,
    plotCritic: 2,
    writer: 4,
    writerCritic: 1,
  },
}

const baseText: TextPhaseResult = {
  textV1: 'text draft one',
  textV2: 'text final version',
  psychologistTextOutput,
  writerCriticOutput,
  models: {
    plotter: 'claude-sonnet-4-6',
    psychologist: 'claude-sonnet-4-6',
    plotCritic: 'claude-haiku-4-5-20251001',
    writer: 'claude-sonnet-4-6',
    writerCritic: 'claude-haiku-4-5-20251001',
  },
  promptVersions: {
    plotter: 3,
    psychologistPlan: 1,
    psychologistText: 1,
    plotCritic: 2,
    writer: 5,
    writerCritic: 2,
  },
}

describe('buildPlanSnapshotInsert', () => {
  it('writes only plan-related columns and leaves writer/critic/psychologist-text fields unset', () => {
    const row = buildPlanSnapshotInsert(42, basePlan)

    expect(row.storyId).toBe(42)
    expect(row.plotterModel).toBe('claude-sonnet-4-6')
    expect(row.plotterPromptVersion).toBe(3)
    expect(row.psychologistPlanModel).toBe('claude-sonnet-4-6')
    expect(row.psychologistPlanPromptVersion).toBe(1)
    expect(row.plotCriticModel).toBe('claude-haiku-4-5-20251001')
    expect(row.plotCriticPromptVersion).toBe(2)
    expect(row.planV1).toBe('plan draft one')
    expect(row.planFinal).toBe('plan final version')
    expect(row.planIterationsCount).toBe(2)
    expect(row.psychologistPlanOutput).toBe(psychologistPlanOutput)
    expect(row.plotCriticOutput).toBe(plotCriticOutput)
  })

  it('does not leak writer/critic/psychologist-text model or version (they must not be written until text phase runs)', () => {
    const row = buildPlanSnapshotInsert(42, basePlan)

    expect(row.writerModel).toBeUndefined()
    expect(row.writerPromptVersion).toBeUndefined()
    expect(row.psychologistTextModel).toBeUndefined()
    expect(row.psychologistTextPromptVersion).toBeUndefined()
    expect(row.writerCriticModel).toBeUndefined()
    expect(row.writerCriticPromptVersion).toBeUndefined()
    expect(row.textV1).toBeUndefined()
    expect(row.textV2).toBeUndefined()
    expect(row.psychologistTextOutput).toBeUndefined()
    expect(row.writerCriticOutput).toBeUndefined()
  })
})

describe('buildTextSnapshotUpdate', () => {
  it('writes only text-related columns for the persistence update', () => {
    const update = buildTextSnapshotUpdate(baseText)

    expect(update.writerModel).toBe('claude-sonnet-4-6')
    expect(update.writerPromptVersion).toBe(5)
    expect(update.psychologistTextModel).toBe('claude-sonnet-4-6')
    expect(update.psychologistTextPromptVersion).toBe(1)
    expect(update.writerCriticModel).toBe('claude-haiku-4-5-20251001')
    expect(update.writerCriticPromptVersion).toBe(2)
    expect(update.textV1).toBe('text draft one')
    expect(update.textV2).toBe('text final version')
    expect(update.psychologistTextOutput).toBe(psychologistTextOutput)
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
