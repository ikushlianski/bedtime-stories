import { useEffect, useState } from 'react'
import { StoryIdea, api } from '../lib/api'
import { IdeaCard } from './idea-card'
import { Button } from './button'

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

  const generateIdeas = async () => {
    setIsGenerating(true)
    setError(null)
    try {
      const result = await api.universes.suggestIdeas(universeId)
      await loadIdeas()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка при генерировании идей'
      setError(msg)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleApproveIdea = async (ideaId: number, createStory: boolean) => {
    try {
      const result = await api.universes.approveIdea(universeId, ideaId, createStory)
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
          onClick={generateIdeas}
          loading={isGenerating}
          disabled={isLoading || isGenerating}
        >
          Генерировать идеи
        </Button>
      </div>

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
                onApprove={(createStory) => handleApproveIdea(idea.id, createStory ?? false)}
                onReject={(reason) => handleRejectIdea(idea.id, reason)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
