import '@testing-library/jest-dom/vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QuestionsPipelineSection } from './questions-pipeline-section'
import { api } from '../lib/api'

vi.mock('../lib/api', () => ({
  api: {
    pipeline: {
      questions: vi.fn(),
    },
  },
}))

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  localStorage.clear()
})

beforeEach(() => {
  vi.useFakeTimers()
})

describe('QuestionsPipelineSection', () => {
  it('stops polling and shows a retry option after an unrecoverable fetch error', async () => {
    const questionsMock = vi
      .mocked(api.pipeline.questions)
      .mockRejectedValue(new Error('Что-то пошло не так. Попробуй ещё раз через пару минут.'))

    render(
      <QuestionsPipelineSection
        storyId={1}
        pipelineStatus="questions_pending"
        onAnswersSubmitted={() => undefined}
      />,
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(questionsMock).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Не удалось загрузить вопросы')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Попробовать снова' })).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000 * 5)
    })

    expect(questionsMock).toHaveBeenCalledTimes(1)
  })
})
