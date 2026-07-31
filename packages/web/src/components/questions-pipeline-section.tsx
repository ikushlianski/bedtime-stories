import { useState, useEffect, useRef } from 'react'
import { api, type PlanQuestion, type PipelineStatusValue } from '../lib/api'
import { StatusCallout } from './index'

const POLL_INTERVAL_MS = 3000

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
  } catch { /* ignore */ }
}

function clearStorage(...keys: string[]) {
  keys.forEach((k) => { try { localStorage.removeItem(k) } catch { /* ignore */ } })
}

function resolveAnswer(selected: string | undefined, custom: string): string {
  const trimmed = custom.trim()
  return trimmed.length > 0 ? trimmed : (selected ?? '')
}

function GeneratingSpinner() {
  const [dotCount, setDotCount] = useState(1)

  useEffect(() => {
    const id = setInterval(() => setDotCount((n) => (n % 3) + 1), 600)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <span className="loading loading-spinner loading-md text-primary" />
      <p className="text-base text-base-content/70">
        ИИ придумывает вопросы{'.'.repeat(dotCount)}
      </p>
    </div>
  )
}

interface Props {
  storyId: number
  pipelineStatus: PipelineStatusValue
  onAnswersSubmitted: () => void
  storyTitle?: string | null
  storySeed?: string | null
}

export function QuestionsPipelineSection({ storyId, pipelineStatus, onAnswersSubmitted, storyTitle, storySeed }: Props) {
  const isPending = pipelineStatus === 'questions_pending'
  const isAnswered = pipelineStatus !== 'pending' && pipelineStatus !== 'questions_pending'

  const [questions, setQuestions] = useState<PlanQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [selectedOptions, setSelectedOptions] = useState<Record<number, string>>(
    () => loadFromStorage(STORAGE_KEY_OPTIONS(storyId), {}),
  )
  const [customTexts, setCustomTexts] = useState<Record<number, string>>(
    () => loadFromStorage(STORAGE_KEY_CUSTOM(storyId), {}),
  )
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!isPending && !isAnswered) return

    setLoading(true)
    setFetchError(null)

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
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
        setLoading(false)
        setFetchError(err instanceof Error ? err.message : 'Не удалось загрузить уточняющие вопросы')
      }
    }

    void fetchOnce()

    if (isPending) {
      intervalRef.current = setInterval(() => void fetchOnce(), POLL_INTERVAL_MS)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [storyId, isPending, isAnswered, retryKey])

  useEffect(() => {
    saveToStorage(STORAGE_KEY_OPTIONS(storyId), selectedOptions)
  }, [storyId, selectedOptions])

  useEffect(() => {
    saveToStorage(STORAGE_KEY_CUSTOM(storyId), customTexts)
  }, [storyId, customTexts])

  const allAnswered =
    questions.length > 0 &&
    questions.every((q) => resolveAnswer(selectedOptions[q.id], customTexts[q.id] ?? '').length > 0)

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
      onAnswersSubmitted()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Не удалось отправить ответы')
      setSubmitting(false)
    }
  }

  if (!isPending && !isAnswered) return null

  if (isAnswered) {
    if (!loading && questions.length === 0) return null

    return (
      <div className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body py-4">
          <button
            type="button"
            className="flex w-full items-center justify-between text-left"
            onClick={() => setExpanded((v) => !v)}
          >
            <span className="flex items-center gap-2 text-sm font-medium text-base-content/60">
              <span className="text-success">✓</span>
              Уточняющие вопросы отвечены
              {questions.length > 0 && <span className="badge badge-ghost badge-sm">{questions.length}</span>}
            </span>
            <span className="text-xs text-base-content/40">{expanded ? '▲ Свернуть' : '▼ Показать'}</span>
          </button>

          {expanded && (
            <div className="mt-4 space-y-5 border-t border-base-200 pt-4">
              {loading && <p className="text-sm text-base-content/50">Загружаем…</p>}
              {questions.map((q, i) => (
                <div key={q.id} className="space-y-1">
                  <p className="text-sm font-medium text-base-content">
                    {i + 1}. {q.questionText}
                  </p>
                  <p className="text-sm text-base-content/60">{q.answerText ?? '—'}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  const contextLabel = storySeed?.trim() || storyTitle?.trim()

  return (
    <div className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-4">
        <h2 className="font-serif text-2xl text-base-content">Уточняющие вопросы</h2>

        {contextLabel && (
          <div className="rounded-lg border border-base-200 bg-base-200/50 px-4 py-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-base-content/40">Идея</p>
            <p className="text-sm text-base-content/80">{contextLabel}</p>
          </div>
        )}

        <p className="text-sm text-base-content/60">
          Ответь на вопросы, чтобы история стала более личной.
        </p>

        {fetchError ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <StatusCallout tone="error" title="Не удалось загрузить вопросы" message={fetchError} />
            <button type="button" className="btn btn-sm btn-outline" onClick={() => setRetryKey((n) => n + 1)}>
              Попробовать снова
            </button>
          </div>
        ) : loading || questions.length === 0 ? (
          <GeneratingSpinner />
        ) : (
          <>
            {submitError && (
              <StatusCallout tone="error" title="Ошибка отправки" message={submitError} />
            )}

            <div className="space-y-6">
              {questions.map((question, index) => (
                <div key={question.id} className="space-y-3">
                  <p className="text-sm font-medium text-base-content">
                    {index + 1}. {question.questionText}
                  </p>

                  {question.answerOptions && question.answerOptions.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {question.answerOptions.map((option) => {
                        const selected = selectedOptions[question.id] === option
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setSelectedOptions((prev) => ({ ...prev, [question.id]: option }))}
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
                              {selected && <span className="h-2 w-2 rounded-full bg-primary-content" />}
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
                      onChange={(e) =>
                        setCustomTexts((prev) => ({ ...prev, [question.id]: e.target.value }))
                      }
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
          </>
        )}
      </div>
    </div>
  )
}
