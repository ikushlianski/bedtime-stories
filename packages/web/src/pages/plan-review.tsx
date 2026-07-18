import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, type Story } from '../lib/api'
import { PageHeader, StatusCallout } from '../components'
import PlanAnnotator from '../components/plan-annotator'
import { StoryChatPanel } from './story-chat-panel'

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
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить историю'))
      .finally(() => setLoading(false))
  }, [id])

  return { story, loading, error }
}

export function PlanReviewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const storyId = Number(id)
  const { story, loading, error } = usePlanReviewStory(storyId)
  const [approving, setApproving] = useState(false)
  const [approveError, setApproveError] = useState<string | null>(null)
  const [chatSelectedText, setChatSelectedText] = useState<string | null>(null)
  const [localPlanText, setLocalPlanText] = useState<string>('')

  useEffect(() => {
    if (story) {
      setLocalPlanText(story.plan_v1 ?? story.plan_final ?? '')
    }
  }, [story])

  const handleApprove = async () => {
    setApproving(true)
    setApproveError(null)

    try {
      await api.stories.approvePlan(storyId)
      navigate(`/stories/${storyId}/pipeline`)
    } catch (err) {
      setApproveError(err instanceof Error ? err.message : 'Не удалось одобрить план')
    } finally {
      setApproving(false)
    }
  }

  if (loading) {
    return <StatusCallout title="Загрузка" message="Получаем план истории." />
  }

  if (error) {
    return <StatusCallout tone="error" title="Ошибка загрузки" message={error} />
  }

  if (!story) {
    return <StatusCallout tone="warning" title="История не найдена" message="Запрошенная история не существует." />
  }

  if (!localPlanText && !(story.plan_v1 ?? story.plan_final)) {
    return <StatusCallout tone="warning" title="План ещё не готов" message="Дождись завершения фазы планирования." />
  }

  return (
    <div>
      <PageHeader
        eyebrow="Проверка плана"
        title={story.title || 'Проверка плана'}
        description="Прочитай план и оставь комментарии. Когда будешь готов — одобри."
        backAction={
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/stories/${storyId}/pipeline`)}>
            ← К конвейеру
          </button>
        }
      />

      {approveError && (
        <div className="mb-4">
          <StatusCallout tone="error" title="Ошибка одобрения" message={approveError} />
        </div>
      )}

      {story.plan_change_summary && (
        <div className="mb-4 rounded-box border border-info/30 bg-info/10 p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-info/70">Что изменилось</p>
          <div className="text-sm text-base-content/80 leading-relaxed whitespace-pre-wrap">
            {story.plan_change_summary}
          </div>
        </div>
      )}

      <section className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-2xl text-base-content">Сырой сюжет</h2>

            <button
              className="btn btn-primary"
              onClick={() => void handleApprove()}
              disabled={approving}
            >
              {approving ? 'Одобряем...' : 'Одобрить план →'}
            </button>
          </div>

          <PlanAnnotator
            storyId={storyId}
            planText={localPlanText}
            onChatAboutThis={(text) => setChatSelectedText(text)}
          />

          <div className="flex justify-end">
            <button
              className="btn btn-primary"
              onClick={() => void handleApprove()}
              disabled={approving}
            >
              {approving ? 'Одобряем...' : 'Одобрить план →'}
            </button>
          </div>
        </div>
      </section>

      {chatSelectedText !== null && (
        <div className="mt-6">
          <StoryChatPanel
            storyId={storyId}
            context="plan"
            selectedText={chatSelectedText}
            onPatchApplied={(newText) => {
              setLocalPlanText(newText)
              setChatSelectedText(null)
            }}
            onClose={() => setChatSelectedText(null)}
          />
        </div>
      )}

      {chatSelectedText === null && (
        <div className="mt-6">
          <StoryChatPanel storyId={storyId} context="plan" />
        </div>
      )}
    </div>
  )
}
