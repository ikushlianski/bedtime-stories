import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, type Story, type CreateStoryInput } from '../lib/api'
import { CreateStoryModal, PageHeader, StatusCallout, StoryCard, StoryFilterTabs } from '../components'

type StatusFilter = 'all' | 'draft' | 'ready' | 'read' | 'archived'

export function StoryListPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const seedFromUrl = searchParams.get('seed')
  const groupIdFromUrl = searchParams.get('groupId')
  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [showModal, setShowModal] = useState(seedFromUrl !== null)

  const fetchStories = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await api.stories.list(filter === 'all' ? undefined : filter)

      setStories(data)
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Не удалось загрузить истории')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void fetchStories()
  }, [fetchStories])

  async function handleCreateStory(input: CreateStoryInput) {
    const created = await api.stories.create(input)

    setShowModal(false)

    if (created.source === 'user') {
      navigate(`/stories/${created.id}`)
      return
    }

    if ('seed' in input) {
      void api.pipeline.run(created.id, input.seed)
      navigate(`/stories/${created.id}/questions`)
      return
    }

    navigate(`/stories/${created.id}/pipeline`)
  }

  return (
    <div>
      <PageHeader
        eyebrow="Библиотека"
        title="Истории"
        description="Следи за историями от черновика до прочтения и запускай новые идеи для сказок на ночь."
        action={
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + Новая история
          </button>
        }
      />

      <div className="mb-6">
        <StoryFilterTabs value={filter} onChange={setFilter} />
      </div>

      {loading && <StatusCallout title="Загрузка" message="Получаем истории из библиотеки." />}

      {!loading && error && (
        <StatusCallout tone="error" title="Не удалось загрузить истории" message={error} />
      )}

      {!loading && !error && stories.length === 0 && (
        <StatusCallout
          tone="warning"
          title="Историй пока нет"
          message="Создай историю, чтобы запустить конвейер планирования и проверки."
        />
      )}

      {!loading && !error && stories.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {stories.map((story) => (
            <div key={story.id} className="relative">
              <button
                className="w-full text-left"
                onClick={() => navigate(`/stories/${story.id}`)}
              >
                <StoryCard title={story.title} status={story.status} createdAt={story.created_at} />
              </button>

              <button
                className="btn btn-ghost btn-xs absolute bottom-3 right-3 text-error hover:bg-error/10"
                onClick={(e) => {
                  e.stopPropagation()

                  if (confirm('Удалить эту историю навсегда? Это действие нельзя отменить.')) {
                    api.stories
                      .delete(story.id)
                      .then(() => setStories((prev) => prev.filter((s) => s.id !== story.id)))
                      .catch((err) =>
                        setError(err instanceof Error ? err.message : 'Не удалось удалить историю'),
                      )
                  }
                }}
              >
                Удалить
              </button>
            </div>
          ))}
        </div>
      )}

      <CreateStoryModal
        open={showModal}
        initialSeed={seedFromUrl ?? ''}
        initialGroupId={groupIdFromUrl ? parseInt(groupIdFromUrl, 10) : null}
        onClose={() => {
          setShowModal(false)

          if (seedFromUrl !== null) {
            const next = new URLSearchParams(searchParams)
            next.delete('seed')
            next.delete('groupId')
            setSearchParams(next, { replace: true })
          }
        }}
        onSubmit={handleCreateStory}
      />
    </div>
  )
}
