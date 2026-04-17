import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, type Story, type RunSnapshot, type PipelineStatusValue } from '../lib/api'
import { PageHeader, PlanReviewCard, StatusCallout } from '../components'
import DiffViewer from '../components/diff-viewer'
import { deriveReviewSnapshotState } from './review-snapshot-state'
import { PlanConversationPanel } from './plan-conversation-panel'

function usePlanReviewStory(id: number) {
  const [story, setStory] = useState<Story | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    api.stories
      .get(id)
      .then(setStory)
      .catch((fetchError) => setError(fetchError instanceof Error ? fetchError.message : 'Не удалось загрузить историю'))
      .finally(() => setLoading(false))
  }, [id])

  return { story, loading, error }
}

function useRunSnapshot(id: number) {
  const [snapshot, setSnapshot] = useState<RunSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    api.pipeline
      .snapshot(id)
      .then((data) => setSnapshot(data))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err : new Error('Не удалось загрузить снимок конвейера'))
      })
      .finally(() => setLoading(false))
  }, [id])

  return { snapshot, loading, error }
}

export function PlanReviewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const storyId = Number(id)
  const { story, loading, error } = usePlanReviewStory(storyId)
  const snapshotFetch = useRunSnapshot(storyId)
  const snapshotState = deriveReviewSnapshotState({
    loading: snapshotFetch.loading,
    error: snapshotFetch.error,
    snapshot: snapshotFetch.snapshot,
    phase: 'plan',
  })
  const [approving, setApproving] = useState(false)
  const [approveError, setApproveError] = useState<string | null>(null)
  const [dismissing, setDismissing] = useState(false)
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatusValue | null>(null)
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    api.pipeline.status(storyId).then((s) => setPipelineStatus(s.status)).catch(() => undefined)
  }, [storyId])

  const handleRetryPlan = useCallback(async () => {
    setRetrying(true)
    setApproveError(null)

    try {
      await api.annotations.redoPlan(storyId)
      navigate(`/stories/${storyId}/pipeline`)
    } catch (err) {
      setApproveError(err instanceof Error ? err.message : 'Не удалось перезапустить план')
      setRetrying(false)
    }
  }, [storyId, navigate])

  const handleDismiss = async () => {
    if (!confirm('Удалить эту историю навсегда? Это действие нельзя отменить.')) {
      return
    }

    setDismissing(true)

    try {
      await api.stories.delete(storyId)
      navigate('/')
    } catch (dismissError) {
      setApproveError(dismissError instanceof Error ? dismissError.message : 'Не удалось удалить историю')
      setDismissing(false)
    }
  }

  const handleApprove = async () => {
    setApproving(true)
    setApproveError(null)

    try {
      await api.stories.approvePlan(storyId)
      navigate(`/stories/${storyId}/pipeline`)
    } catch (approvalError) {
      setApproveError(approvalError instanceof Error ? approvalError.message : 'Не удалось одобрить план')
    } finally {
      setApproving(false)
    }
  }

  if (loading) {
    return <StatusCallout title="Загрузка" message="Получаем данные для проверки плана." />
  }

  if (error) {
    return <StatusCallout tone="error" title="Ошибка загрузки истории" message={error} />
  }

  if (!story) {
    return <StatusCallout tone="warning" title="История не найдена" message="Запрошенная история не существует." />
  }

  if (snapshotState.kind === 'loading') {
    return <StatusCallout title="Загрузка оценки" message="Ожидаем результатов психолога." />
  }

  const approveHandler = () => {
    if (!approving) {
      void handleApprove()
    }
  }

  const dismissHandler = () => {
    if (!dismissing) {
      void handleDismiss()
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Проверка"
        title="Проверка плана"
        description="Сравни первый черновик плана с финальной версией и проверь оценку психолога."
        backAction={
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
            ← К историям
          </button>
        }
        action={
          <button
            className="btn btn-error btn-outline btn-sm"
            onClick={dismissHandler}
            disabled={dismissing}
          >
            Удалить историю
          </button>
        }
      />

      {approveError && (
        <div className="mb-4">
          <StatusCallout tone="error" title="Ошибка" message={approveError} />
        </div>
      )}

      {pipelineStatus === 'failed' && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-box border border-error/30 bg-error/10 p-4">
          <p className="text-sm text-base-content">
            Генерация плана завершилась с ошибкой. Можно попробовать снова.
          </p>
          <button
            className="btn btn-sm btn-outline"
            onClick={() => void handleRetryPlan()}
            disabled={retrying}
          >
            {retrying ? 'Запускаем…' : 'Повторить генерацию плана'}
          </button>
        </div>
      )}

      {snapshotState.kind === 'ready' ? (
        <div className="space-y-6">
          <PlanReviewCard
            storyId={storyId}
            planV1={story.plan_v1 ?? ''}
            planFinal={story.plan_final ?? ''}
            iterationsCount={story.plan_iterations ?? 0}
            psychologistOutput={snapshotState.psychOutput}
            onApprove={approveHandler}
          />

          <PlanConversationPanel storyId={storyId} />
        </div>
      ) : (
        <div className="space-y-4">
          <StatusCallout
            tone={snapshotState.reason === 'error' ? 'error' : 'warning'}
            title={
              snapshotState.reason === 'error'
                ? 'Оценка психолога недоступна'
                : 'Оценка психолога не записана'
            }
            message={snapshotState.message}
          />

          <section className="card border border-base-300 bg-base-100 shadow-sm">
            <div className="card-body gap-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-serif text-3xl text-base-content">Проверка плана</h2>
                  <p className="text-sm text-base-content/65">
                    Итераций: {story.plan_iterations ?? 0}
                  </p>
                </div>

                <button className="btn btn-primary" onClick={approveHandler} disabled={approving}>
                  Одобрить план
                </button>
              </div>

              <div className="max-h-96 overflow-y-auto rounded-box border border-base-300 bg-base-100 p-5">
                {(story.plan_final ?? '').split('\n').map((line, i) => (
                  <p key={i} className={`leading-relaxed text-base-content ${line.trim() === '' ? 'mb-3' : 'mb-1'}`}>
                    {line || '\u00A0'}
                  </p>
                ))}
              </div>
            </div>
          </section>

          <PlanConversationPanel storyId={storyId} />
        </div>
      )}
    </div>
  )
}
