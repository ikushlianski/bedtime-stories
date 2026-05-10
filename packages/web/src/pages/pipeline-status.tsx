import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, type PipelineStatus, type PipelineStatusValue, type Story, type ModelCategories, EMPTY_MODEL_CATEGORIES } from '../lib/api'
import { AttentionStories, PageHeader, PipelineProgress, StatusCallout } from '../components'
import ModelSelectDropdown from '../components/model-select-dropdown'
import { QuestionsPipelineSection } from '../components/questions-pipeline-section'
import type { PipelineStep, AgentName, AgentStatus } from '../components/types'
import { decidePipelineRetry } from './pipeline-retry'

const API_BASE = (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env['VITE_API_URL'] ?? 'http://localhost:8020'


const KNOWN_AGENT_NAMES = new Set<AgentName>([
  'Questions',
  'Plotter',
  'Psychologist',
  'Writer',
  'WriterCritic',
  'Improver',
])

const AGENT_DISPLAY_NAMES: Record<string, string> = {
  Questions: 'Уточняющие вопросы',
  Plotter: 'Сюжетник',
  Psychologist: 'Психолог',
  Writer: 'Писатель',
  WriterCritic: 'Критик текста',
  Improver: 'Улучшатель',
}

const TERMINAL_PUBLIC_STATUSES = new Set<PipelineStatusValue>([
  'plan_ready',
  'text_ready',
  'text_review',
  'failed',
  'questions_failed',
])

function toAgentName(raw: string): AgentName {
  if (KNOWN_AGENT_NAMES.has(raw as AgentName)) {
    return raw as AgentName
  }

  return 'Plotter'
}


function toPipelineSteps(status: PipelineStatus): PipelineStep[] {
  return status.steps.map((step) => {
    const agentName = toAgentName(step.agent ?? step.name)

    let resolvedStatus: AgentStatus

    if (step.status === 'completed') resolvedStatus = 'done'
    else if (step.status === 'failed') resolvedStatus = 'error'
    else if (step.status === 'running') resolvedStatus = 'running'
    else resolvedStatus = 'idle'

    return { agentName, status: resolvedStatus, summary: step.summary }
  })
}

function isActiveStatus(status: PipelineStatusValue): boolean {
  return status === 'plan_running' || status === 'text_running' || status === 'pending' || status === 'questions_pending' || status === 'questions_answered'
}

function internalToPublicStatus(internal: string): PipelineStatusValue {
  switch (internal) {
    case 'questions_pending': return 'questions_pending'
    case 'questions_answered': return 'questions_answered'
    case 'questions_failed': return 'questions_failed'
    case 'plan_running': return 'plan_running'
    case 'plan_ready': return 'plan_ready'
    case 'plan_failed': return 'failed'
    case 'text_running': return 'text_running'
    case 'text_ready': return 'text_ready'
    case 'text_review': return 'text_review'
    case 'text_failed': return 'failed'
    default: return 'pending'
  }
}

function describeStatus(status: PipelineStatusValue): string {
  switch (status) {
    case 'questions_pending':
      return 'Ожидаем ответов на уточняющие вопросы.'
    case 'questions_answered':
      return 'Вопросы отвечены. Запустите фазу планирования.'
    case 'questions_failed':
      return 'Ошибка при генерации вопросов. Выберите модель и попробуйте снова.'
    case 'plan_running':
      return 'Идёт фаза планирования.'
    case 'plan_ready':
      return 'План готов к проверке.'
    case 'text_running':
      return 'Идёт фаза написания текста.'
    case 'text_ready':
      return 'Текст готов к проверке.'
    case 'text_review':
      return 'История готова к проверке.'
    case 'failed':
      return 'Конвейер завершился с ошибкой.'
    case 'pending':
      return 'Ожидаем запуска конвейера.'
    default:
      return 'Неизвестный статус.'
  }
}

export function PipelineStatusPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const storyId = Number(id)
  const [status, setStatus] = useState<PipelineStatus | null>(null)
  const [story, setStory] = useState<Story | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)
  const [streamingText, setStreamingText] = useState('')
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const [launching, setLaunching] = useState(false)
  const [models, setModels] = useState<ModelCategories>(EMPTY_MODEL_CATEGORIES)
  const esRef = useRef<EventSource | null>(null)
  const fetchStatusRef = useRef<(() => Promise<void>) | null>(null)
  const pendingResetRef = useRef(false)

  useEffect(() => {
    if (isNaN(storyId)) return

    api.stories
      .get(storyId)
      .then(setStory)
      .catch(() => {
        /* non-fatal */
      })
  }, [storyId])

  useEffect(() => {
    api.models
      .list()
      .then(setModels)
      .catch(() => {
        /* non-fatal */
      })
  }, [])

  const openEventSource = useCallback((sid: number) => {
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }

    const es = new EventSource(`${API_BASE}/api/pipeline/stream/${sid}`, { withCredentials: true })
    esRef.current = es

    es.addEventListener('step', (e: MessageEvent<string>) => {
      const event = JSON.parse(e.data) as { type: 'step'; name: string; status: 'running' | 'done'; summary?: string }

      setStatus((prev) => {
        if (!prev) return prev

        const newSteps = prev.steps.map((step) => {
          if (step.name === event.name || step.agent === event.name) {
            return {
              ...step,
              status: (event.status === 'running' ? 'running' : 'completed') as 'running' | 'completed',
              ...(event.summary !== undefined ? { summary: event.summary } : {}),
            }
          }

          return step
        })

        return {
          ...prev,
          current_step: event.status === 'running' ? event.name : prev.current_step,
          steps: newSteps,
        }
      })
    })

    es.addEventListener('status', (e: MessageEvent<string>) => {
      const event = JSON.parse(e.data) as { type: 'status'; status: string }
      const publicStatus = internalToPublicStatus(event.status)

      setStatus((prev) => {
        if (!prev) return prev

        return { ...prev, status: publicStatus }
      })

      if (TERMINAL_PUBLIC_STATUSES.has(publicStatus)) {
        es.close()
        esRef.current = null
        pendingResetRef.current = false
        setStreamingText('')
      }
    })

    es.addEventListener('chunk', (e: MessageEvent<string>) => {
      const event = JSON.parse(e.data) as { text: string }

      if (pendingResetRef.current) {
        pendingResetRef.current = false
        setStreamingText(event.text)
      } else {
        setStreamingText((prev) => prev + event.text)
      }
    })

    es.addEventListener('chunk_reset', () => {
      pendingResetRef.current = true
    })

    es.onerror = () => {
      es.close()
      esRef.current = null
      void fetchStatusRef.current?.()
    }
  }, [])

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.pipeline.status(storyId)

      setStatus(data)

      if (isActiveStatus(data.status)) {
        if (!esRef.current) {
          openEventSource(storyId)
        }
      } else {
        if (esRef.current) {
          esRef.current.close()
          esRef.current = null
        }
      }
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Не удалось загрузить статус конвейера')
    }
  }, [storyId, openEventSource])

  fetchStatusRef.current = fetchStatus

  useEffect(() => {
    void fetchStatus()

    return () => {
      if (esRef.current) {
        esRef.current.close()
        esRef.current = null
      }
    }
  }, [fetchStatus])

  const autoTriggeredRef = useRef(false)

  useEffect(() => {
    if (status?.status === 'questions_answered' && !autoTriggeredRef.current) {
      autoTriggeredRef.current = true
      api.pipeline.retryPlan(storyId)
        .then(() => fetchStatus())
        .catch((err: unknown) => setRetryError(err instanceof Error ? err.message : 'Не удалось запустить планировщик'))
    }
  }, [status?.status, storyId, fetchStatus])

  const handleRetry = useCallback(async (seed: string) => {
    setRetrying(true)
    setRetryError(null)

    try {
      await api.pipeline.run(storyId, seed)
      setError(null)
      await fetchStatus()
    } catch (err) {
      setRetryError(err instanceof Error ? err.message : 'Не удалось перезапустить конвейер')
    } finally {
      setRetrying(false)
    }
  }, [storyId, fetchStatus])

  const handleLaunchWithModel = useCallback(async () => {
    if (!story) return

    setLaunching(true)
    setError(null)

    try {
      const seed = story.seed || story.title || ''
      await api.pipeline.run(storyId, seed, selectedModel || undefined)
      await fetchStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось запустить генерацию вопросов')
    } finally {
      setLaunching(false)
    }
  }, [storyId, selectedModel, story, fetchStatus])

  return (
    <div>
      <PageHeader
        eyebrow="Обработка"
        title={story?.title || 'Статус конвейера'}
        description={
          status
            ? `${describeStatus(status.status)}${status.current_step ? ` Сейчас работает: ${AGENT_DISPLAY_NAMES[status.current_step] ?? status.current_step}.` : ''}`
            : 'Подключаемся к конвейеру генерации.'
        }
      />

      {error && (
        <StatusCallout tone="error" title="Ошибка запроса к конвейеру" message={error} />
      )}

      {!status && !error && (
        <StatusCallout title="Загрузка" message="Получаем актуальный статус конвейера." />
      )}

      {status && (
        <div className="space-y-6">
          {(status.status === 'pending' || status.status === 'questions_failed') && story && (
            <div className="card border border-base-300 bg-base-100 shadow-sm">
              <div className="card-body gap-4">
                <h2 className="font-serif text-2xl text-base-content">Уточняющие вопросы</h2>

                {status.status === 'questions_failed' && (
                  <StatusCallout
                    tone="error"
                    title="Ошибка генерации вопросов"
                    message="Не удалось сгенерировать вопросы. Выберите модель и попробуйте снова."
                  />
                )}

                <p className="text-sm text-base-content/60">
                  Выберите модель для генерации вопросов или оставьте пустым — будет использоваться DeepSeek V4 Pro.
                </p>

                <div className="space-y-3">
                  <label className="form-control">
                    <span className="label-text mb-2">Модель</span>
                    <ModelSelectDropdown
                      categories={models}
                      value={selectedModel || ''}
                      onChange={setSelectedModel}
                    />
                  </label>

                  {error && (
                    <StatusCallout tone="error" title="Ошибка" message={error} />
                  )}

                  <div className="flex justify-end">
                    <button
                      className="btn btn-primary"
                      onClick={() => void handleLaunchWithModel()}
                      disabled={launching}
                    >
                      {launching ? 'Запускаем…' : 'Генерировать вопросы'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {story?.mode !== 'auto' && status.status !== 'pending' && status.status !== 'questions_failed' && (
            <QuestionsPipelineSection
              storyId={storyId}
              pipelineStatus={status.status}
              onAnswersSubmitted={() => void fetchStatus()}
              storyTitle={story?.title}
              storySeed={story?.seed}
            />
          )}

          <PipelineProgress steps={toPipelineSteps(status)} />

          <AttentionStories currentStoryId={storyId} />

          {streamingText && (
            <div className="rounded-lg border border-base-300 bg-base-200 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-base-content/50">Писатель — текст в процессе</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-base-content/80">{streamingText}</p>
            </div>
          )}

          {status.status === 'plan_ready' && (
            <div className="flex justify-end">
              <button className="btn btn-primary" onClick={() => navigate(`/stories/${storyId}/plan-review`)}>
                Проверить план →
              </button>
            </div>
          )}

          {status.status === 'text_ready' && (
            <div className="flex justify-end">
              <button className="btn btn-primary" onClick={() => navigate(`/stories/${storyId}/text-review`)}>
                Проверить текст →
              </button>
            </div>
          )}

          {status.status === 'text_review' && (
            <div className="flex justify-end">
              <button className="btn btn-primary" onClick={() => navigate(`/stories/${storyId}`)}>
                Читать историю →
              </button>
            </div>
          )}

          {status.status === 'failed' && (
            <StatusCallout
              tone="error"
              title={status.phase === 'text' ? 'Ошибка в фазе текста' : 'Ошибка в фазе планирования'}
              message="Проверь логи API для упавшего шага, прежде чем перезапускать историю."
            />
          )}

          {(() => {
            const retryDecision = decidePipelineRetry(status.status, story)

            if (retryDecision.action === 'hidden') return null

            if (retryDecision.action === 'blocked') {
              return (
                <StatusCallout
                  tone="warning"
                  title="Перезапуск невозможен"
                  message="У истории нет затравки, поэтому конвейер нельзя перезапустить отсюда."
                />
              )
            }

            const label =
              retryDecision.action === 'retry_plan'
                ? retryDecision.reason === 'pending'
                  ? 'Запустить конвейер'
                  : 'Повторить фазу планирования'
                : 'Повторить фазу текста'

            const onClick = () => {
              if (retryDecision.action === 'retry_plan') {
                void handleRetry(retryDecision.seed)
              }
            }

            return (
              <div className="space-y-2">
                {retryError && <StatusCallout tone="error" title="Перезапуск не удался" message={retryError} />}
                <div className="flex justify-end">
                  <button
                    className="btn btn-primary"
                    onClick={onClick}
                    disabled={retrying || retryDecision.action !== 'retry_plan'}
                  >
                    {retrying ? 'Запускаем…' : label}
                  </button>
                </div>
                {retryDecision.action === 'retry_text' && (
                  <p className="text-right text-xs text-base-content/60">
                    Повторный запуск фазы текста пока нужно делать со страницы проверки плана.
                  </p>
                )}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
