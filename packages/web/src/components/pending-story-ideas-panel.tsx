import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type StoryIdea, type ModelCategories, EMPTY_MODEL_CATEGORIES } from '../lib/api'
import { IdeaCard } from './idea-card'

interface PendingIdeaWithUniverse extends StoryIdea {
  universeName: string
}

export function PendingStoryIdeasPanel() {
  const navigate = useNavigate()
  const [ideas, setIdeas] = useState<PendingIdeaWithUniverse[]>([])
  const [models, setModels] = useState<ModelCategories>(EMPTY_MODEL_CATEGORIES)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const loadAll = async () => {
    setLoading(true)
    setLoadError(null)

    try {
      const [universes, cats] = await Promise.all([api.universes.list(), api.models.list()])
      setModels(cats)

      const perUniverse = await Promise.all(
        universes.map((u) =>
          api.universes
            .listIdeas(u.id, 'pending')
            .then((rows) => rows.map((r) => ({ ...r, universeName: u.name }))),
        ),
      )

      setIdeas(perUniverse.flat())
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Не удалось загрузить идеи')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
  }, [])

  const handleApprove = async (idea: PendingIdeaWithUniverse, createStory?: boolean, model?: string) => {
    setActionError(null)

    try {
      const result = await api.universes.approveIdea(idea.universeId, idea.id, model, createStory)
      setIdeas((prev) => prev.filter((i) => i.id !== idea.id))

      if (createStory && result.createdStoryId) {
        navigate(`/stories/${result.createdStoryId}`)
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Не удалось принять идею')
    }
  }

  const handleReject = async (idea: PendingIdeaWithUniverse, reason?: string) => {
    setActionError(null)

    try {
      await api.universes.rejectIdea(idea.universeId, idea.id, reason)
      setIdeas((prev) => prev.filter((i) => i.id !== idea.id))
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Не удалось отклонить идею')
    }
  }

  if (loading) {
    return <p className="text-sm text-base-content/50">Загрузка идей…</p>
  }

  if (loadError) {
    return <p className="text-sm text-error">{loadError}</p>
  }

  if (ideas.length === 0) {
    return <p className="text-sm text-base-content/40">Нет ожидающих идей.</p>
  }

  return (
    <div className="grid gap-3">
      {actionError && <p className="text-sm text-error">{actionError}</p>}
      {ideas.map((idea) => (
        <div key={idea.id}>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-base-content/50">{idea.universeName}</p>
          <IdeaCard
            idea={idea}
            categories={models}
            onApprove={(createStory, model) => handleApprove(idea, createStory, model)}
            onReject={(reason) => handleReject(idea, reason)}
          />
        </div>
      ))}
    </div>
  )
}
