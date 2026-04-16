import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, type PipelineStatus, type PipelineStatusValue, type Story } from '../lib/api'
import { PageHeader, PipelineProgress, StatusCallout } from '../components'
import type { PipelineStep, AgentName, AgentStatus } from '../components/types'
import { decidePipelineRetry } from './pipeline-retry'

const POLL_INTERVAL_MS = 3000

const API_STATUS_MAP: Record<string, AgentStatus> = {
  pending: 'idle',
  running: 'running',
  completed: 'done',
  failed: 'error',
}

const KNOWN_AGENT_NAMES = new Set<AgentName>([
  'Plotter',
  'Psychologist',
  'PlotCritic',
  'Writer',
  'WriterCritic',
  'Improver',
])

const AGENT_DISPLAY_NAMES: Record<string, string> = {
  Plotter: 'Сюжетник',
  Psychologist: 'Психолог',
  PlotCritic: 'Критик плана',
  Writer: 'Писатель',
  WriterCritic: 'Критик текста',
  Improver: 'Улучшатель',
}

function toAgentName(raw: string): AgentName {
  if (KNOWN_AGENT_NAMES.has(raw as AgentName)) {
    return raw as AgentName
  }

  return 'Plotter'
}

function toPipelineSteps(status: PipelineStatus): PipelineStep[] {
  const currentStep = status.current_step ?? null
  let passedCurrent = false

  return status.steps.map((step) => {
    const agentName = toAgentName(step.agent ?? step.name)
    const isCurrent = currentStep !== null && (step.agent === currentStep || step.name === currentStep)

    let resolvedStatus: AgentStatus

    if (step.status === 'completed') {
      resolvedStatus = 'done'
    } else if (step.status === 'failed') {
      resolvedStatus = 'error'
    } else if (isCurrent) {
      resolvedStatus = 'running'
      passedCurrent = true
    } else if (passedCurrent) {
      resolvedStatus = 'idle'
    } else if (currentStep === null) {
      resolvedStatus = API_STATUS_MAP[step.status] ?? 'idle'
    } else {
      resolvedStatus = 'done'
    }

    return { agentName, status: resolvedStatus }
  })
}

function isActivePolling(status: PipelineStatusValue): boolean {
  return status === 'plan_running' || status === 'text_running' || status === 'pending'
}

function describeStatus(status: PipelineStatusValue): string {
  switch (status) {
    case 'questions_pending':
      return 'Ожидаем ответов на уточняющие вопросы.'
    case 'plan_running':
      return 'Идёт фаза планирования.'
    case 'plan_ready':
      return 'План готов к проверке.'
    case 'text_running':
      return 'Идёт фаза написания текста.'
    case 'text_ready':
      return 'Текст готов к проверке.'
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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (isNaN(storyId)) return

    api.stories
      .get(storyId)
      .then(setStory)
      .catch(() => {
        /* non-fatal — retry button will hide until story loads */
      })
  }, [storyId])

  const handleRetry = useCallback(async (seed: string) => {
    setRetrying(true)
    setRetryError(null)

    try {
      await api.pipeline.run(storyId, seed)
      setError(null)

      if (intervalRef.current === null) {
        intervalRef.current = setInterval(async () => {
          try {
            const data = await api.pipeline.status(storyId)
            setStatus(data)
          } catch {
            /* polling will self-heal on next tick */
          }
        }, POLL_INTERVAL_MS)
      }
    } catch (err) {
      setRetryError(err instanceof Error ? err.message : 'Не удалось перезапустить конвейер')
    } finally {
      setRetrying(false)
    }
  }, [storyId])

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await api.pipeline.status(storyId)

        setStatus(data)

        if (!isActivePolling(data.status)) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
        }
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Не удалось загрузить статус конвейера')

        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      }
    }

    void fetchStatus()

    intervalRef.current = setInterval(() => void fetchStatus(), POLL_INTERVAL_MS)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [storyId])

  return (
    <div>
      <PageHeader
        eyebrow="Обработка"
        title="Статус конвейера"
        description={
          status
            ? `${describeStatus(status.status)}${status.current_step ? ` Сейчас работает: ${AGENT_DISPLAY_NAMES[status.current_step] ?? status.current_step}.` : ''}`
            : 'Опрашиваем текущий конвейер генерации.'
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
          <PipelineProgress steps={toPipelineSteps(status)} />

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
