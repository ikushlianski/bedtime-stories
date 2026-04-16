import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, type PlanQuestion } from '../lib/api'
import { PageHeader, StatusCallout } from '../components'

const POLL_INTERVAL_MS = 3000

function usePlanQuestions(storyId: number) {
  const [questions, setQuestions] = useState<PlanQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    async function fetchOnce() {
      try {
        const data = await api.pipeline.questions(storyId)

        if (data.length > 0) {
          setQuestions(data)
          setLoading(false)

          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Не удалось загрузить вопросы')
        setLoading(false)

        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      }
    }

    void fetchOnce()

    intervalRef.current = setInterval(() => {
      void fetchOnce()
    }, POLL_INTERVAL_MS)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [storyId])

  return { questions, loading, error }
}

function usePipelineStatusRedirect(storyId: number, navigate: ReturnType<typeof useNavigate>) {
  useEffect(() => {
    api.pipeline
      .status(storyId)
      .then((status) => {
        if (status.status === 'plan_running' || status.status === 'plan_ready') {
          navigate(`/stories/${storyId}/pipeline`)
        }
      })
      .catch(() => {
        /* non-fatal */
      })
  }, [storyId, navigate])
}

function GeneratingQuestionsState() {
  const [dotCount, setDotCount] = useState(1)

  useEffect(() => {
    const id = setInterval(() => setDotCount((n) => (n % 3) + 1), 600)
    return () => clearInterval(id)
  }, [])

  const dots = '.'.repeat(dotCount)

  return (
    <div className="flex flex-col items-center gap-6 py-16 text-center">
      <span className="loading loading-spinner loading-lg text-primary" />
      <div>
        <p className="text-xl font-medium text-base-content">ИИ придумывает вопросы{dots}</p>
        <p className="mt-2 text-sm text-base-content/50">
          Обычно это занимает около 20–30 секунд
        </p>
      </div>
    </div>
  )
}

function answersStorageKey(storyId: number) {
  return `plan-questions-answers-${storyId}`
}

function loadSavedAnswers(storyId: number): Record<number, string> {
  try {
    const raw = localStorage.getItem(answersStorageKey(storyId))
    return raw ? (JSON.parse(raw) as Record<number, string>) : {}
  } catch {
    return {}
  }
}

function saveAnswers(storyId: number, answers: Record<number, string>) {
  try {
    localStorage.setItem(answersStorageKey(storyId), JSON.stringify(answers))
  } catch {
    /* localStorage unavailable */
  }
}

function clearSavedAnswers(storyId: number) {
  try {
    localStorage.removeItem(answersStorageKey(storyId))
  } catch {
    /* ignore */
  }
}

export function PlanQuestionsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const storyId = Number(id)
  const { questions, loading, error } = usePlanQuestions(storyId)
  const [answers, setAnswers] = useState<Record<number, string>>(() => loadSavedAnswers(storyId))
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  usePipelineStatusRedirect(storyId, navigate)

  useEffect(() => {
    saveAnswers(storyId, answers)
  }, [storyId, answers])

  const allAnswered =
    questions.length > 0 &&
    questions.every((q) => {
      const answer = answers[q.id]
      return answer !== undefined && answer.trim().length > 0
    })

  const handleAnswerChange = (questionId: number, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setSubmitError(null)

    try {
      const answersPayload = questions.map((q) => ({
        id: q.id,
        answer: answers[q.id] ?? '',
      }))

      await api.pipeline.submitAnswers(storyId, answersPayload)

      clearSavedAnswers(storyId)
      navigate(`/stories/${storyId}/pipeline`)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Не удалось отправить ответы')
      setSubmitting(false)
    }
  }

  if (error) {
    return <StatusCallout tone="error" title="Не удалось загрузить вопросы" message={error} />
  }

  if (loading || questions.length === 0) {
    return (
      <div>
        <PageHeader
          eyebrow="Планирование"
          title="Уточняющие вопросы"
          backAction={
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
              ← К историям
            </button>
          }
        />
        <GeneratingQuestionsState />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow="Планирование"
        title="Уточняющие вопросы"
        description="Ответь на эти вопросы, чтобы история стала более личной, прежде чем будет создан план."
        backAction={
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
            ← К историям
          </button>
        }
      />

      {submitError && (
        <div className="mb-4">
          <StatusCallout tone="error" title="Ошибка отправки" message={submitError} />
        </div>
      )}

      <div className="space-y-6">
        <div className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body gap-6">
            {questions.map((question, index) => (
              <div key={question.id} className="space-y-3">
                <label className="label">
                  <span className="label-text font-medium">
                    {index + 1}. {question.questionText}
                  </span>
                </label>

                {question.answerOptions && question.answerOptions.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {question.answerOptions.map((option) => {
                      const selected = answers[question.id] === option
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => handleAnswerChange(question.id, option)}
                          className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                            selected
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-base-300 bg-base-100 text-base-content hover:border-primary/50 hover:bg-base-200'
                          }`}
                        >
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                              selected ? 'border-primary bg-primary' : 'border-base-300'
                            }`}
                          >
                            {selected && (
                              <span className="h-2 w-2 rounded-full bg-primary-content" />
                            )}
                          </span>
                          <span className="text-sm">{option}</span>
                        </button>
                      )
                    })}
                  </div>
                )}

                <textarea
                  className="textarea textarea-bordered w-full"
                  rows={2}
                  value={answers[question.id] ?? ''}
                  onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                  placeholder="Свой ответ..."
                />
              </div>
            ))}

            <div className="flex justify-end pt-2">
              <button
                className="btn btn-primary btn-wide"
                onClick={() => void handleSubmit()}
                disabled={!allAnswered || submitting}
              >
                {submitting ? 'Отправляем...' : 'Отправить ответы'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
