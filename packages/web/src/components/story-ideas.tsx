import { useEffect, useState } from 'react'
import type { ModelCatalogEntry } from '../lib/api'
import { StoryIdea, api } from '../lib/api'
import { IdeaCard } from './idea-card'
import { Button } from './button'
import ModelSelectDropdown from './model-select-dropdown'

export interface StoryIdeasProps {
  universeId: number
  onIdeasChange?: (ideas: StoryIdea[]) => void
  onStoryCreated?: (storyId: number) => void
}

export function StoryIdeas({ universeId, onIdeasChange, onStoryCreated }: StoryIdeasProps) {
  const [ideas, setIdeas] = useState<StoryIdea[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [models, setModels] = useState<ModelCatalogEntry[]>([])
  const [selectedModel, setSelectedModel] = useState('')
  const [showModelSelector, setShowModelSelector] = useState(false)

  const loadIdeas = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await api.universes.listIdeas(universeId, 'pending')
      setIdeas(data)
      onIdeasChange?.(data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка при загрузке идей'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  const loadModels = async () => {
    try {
      const data = await api.models.list()
      setModels(data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка при загрузке моделей'
      setError(msg)
    }
  }

  const generateIdeas = async () => {
    if (!selectedModel) {
      setError('Выберите модель для генерирования идей')
      return
    }

    setIsGenerating(true)
    setError(null)
    try {
      await api.universes.suggestIdeas(universeId, selectedModel)
      setShowModelSelector(false)
      setSelectedModel('')
      await loadIdeas()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка при генерировании идей'
      setError(msg)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleApproveIdea = async (ideaId: number, createStory: boolean, model: string) => {
    try {
      const result = await api.universes.approveIdea(universeId, ideaId, model, createStory)
      if (createStory && result.createdStoryId) {
        onStoryCreated?.(result.createdStoryId)
      }
      await loadIdeas()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка при одобрении идеи'
      setError(msg)
    }
  }

  const handleRejectIdea = async (ideaId: number, reason?: string) => {
    try {
      await api.universes.rejectIdea(universeId, ideaId, reason)
      await loadIdeas()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка при отклонении идеи'
      setError(msg)
    }
  }

  useEffect(() => {
    loadIdeas()
    loadModels()
  }, [universeId])

  const ideasByTopic = ideas.reduce(
    (acc, idea) => {
      if (!acc[idea.topic]) {
        acc[idea.topic] = []
      }
      acc[idea.topic].push(idea)
      return acc
    },
    {} as Record<string, StoryIdea[]>,
  )

  const topicGroups = Object.entries(ideasByTopic).sort(([a], [b]) => a.localeCompare(b))

  return (
    <div className="space-y-4">
      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-base-content">
          Идеи {ideas.length > 0 && <span className="badge badge-lg">{ideas.length}</span>}
        </h3>
        <Button
          size="sm"
          onClick={() => setShowModelSelector(true)}
          loading={isGenerating}
          disabled={isLoading || isGenerating}
        >
          Генерировать идеи
        </Button>
      </div>

      {showModelSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-base-100 rounded-lg p-6 max-w-sm w-full mx-4">
            <h4 className="font-semibold mb-4">Выберите модель для генерирования идей</h4>
            <ModelSelectDropdown
              models={models}
              value={selectedModel}
              onChange={setSelectedModel}
              placeholder="Выберите модель..."
            />
            <div className="flex gap-2 mt-6">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowModelSelector(false)
                  setSelectedModel('')
                }}
                disabled={isGenerating}
              >
                Отмена
              </Button>
              <Button
                size="sm"
                onClick={generateIdeas}
                loading={isGenerating}
                disabled={!selectedModel || isGenerating}
                className="flex-1"
              >
                Генерировать
              </Button>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-8">
          <span className="loading loading-spinner loading-lg" />
        </div>
      )}

      {!isLoading && topicGroups.length === 0 && (
        <div className="text-center py-8">
          <p className="text-base-content/70 text-sm">Нет идей. Нажмите кнопку выше, чтобы генерировать новые идеи.</p>
        </div>
      )}

      {!isLoading && topicGroups.map(([topic, topicIdeas]) => (
        <div key={topic} className="space-y-2">
          <h4 className="text-sm font-medium text-base-content/80 uppercase tracking-wide">{topic}</h4>
          <div className="grid gap-2">
            {topicIdeas.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                models={models}
                onApprove={(createStory, model) => handleApproveIdea(idea.id, createStory ?? false, model ?? '')}
                onReject={(reason) => handleRejectIdea(idea.id, reason)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
