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

const STORAGE_KEY_OPTIONS = (id: number) => `plan-questions-options-${id}`
const STORAGE_KEY_CUSTOM = (id: number) => `plan-questions-custom-${id}`

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function saveToStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

function clearStorage(...keys: string[]) {
  keys.forEach((k) => {
    try { localStorage.removeItem(k) } catch { /* ignore */ }
  })
}

function resolveAnswer(selected: string | undefined, custom: string): string {
  const trimmed = custom.trim()
  return trimmed.length > 0 ? trimmed : (selected ?? '')
}

export function PlanQuestionsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const storyId = Number(id)
  const { questions, loading, error } = usePlanQuestions(storyId)
  const [selectedOptions, setSelectedOptions] = useState<Record<number, string>>(
    () => loadFromStorage(STORAGE_KEY_OPTIONS(storyId), {}),
  )
  const [customTexts, setCustomTexts] = useState<Record<number, string>>(
    () => loadFromStorage(STORAGE_KEY_CUSTOM(storyId), {}),
  )
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  usePipelineStatusRedirect(storyId, navigate)

  useEffect(() => {
    saveToStorage(STORAGE_KEY_OPTIONS(storyId), selectedOptions)
  }, [storyId, selectedOptions])

  useEffect(() => {
    saveToStorage(STORAGE_KEY_CUSTOM(storyId), customTexts)
  }, [storyId, customTexts])

  const allAnswered =
    questions.length > 0 &&
    questions.every((q) => resolveAnswer(selectedOptions[q.id], customTexts[q.id] ?? '').length > 0)

  const handleSelectOption = (questionId: number, option: string) => {
    setSelectedOptions((prev) => ({ ...prev, [questionId]: option }))
  }

  const handleCustomText = (questionId: number, value: string) => {
    setCustomTexts((prev) => ({ ...prev, [questionId]: value }))
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setSubmitError(null)

    try {
      const answersPayload = questions.map((q) => ({
        id: q.id,
        answer: resolveAnswer(selectedOptions[q.id], customTexts[q.id] ?? ''),
      }))

      await api.pipeline.submitAnswers(storyId, answersPayload)

      clearStorage(STORAGE_KEY_OPTIONS(storyId), STORAGE_KEY_CUSTOM(storyId))
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
                      const selected = selectedOptions[question.id] === option
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => handleSelectOption(question.id, option)}
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

                <div className="mt-1">
                  <p className="mb-1 text-xs text-base-content/40">
                    {question.answerOptions && question.answerOptions.length > 0
                      ? 'Или напиши свой вариант:'
                      : 'Твой ответ:'}
                  </p>
                  <textarea
                    className="textarea textarea-bordered w-full"
                    rows={2}
                    value={customTexts[question.id] ?? ''}
                    onChange={(e) => handleCustomText(question.id, e.target.value)}
                    placeholder="Свой ответ..."
                  />
                </div>
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
