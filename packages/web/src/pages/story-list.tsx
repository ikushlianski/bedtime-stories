import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, type Story, type CreateStoryInput, type StoryGroup } from '../lib/api'
import { AddExampleStoryModal, CreateStoryModal, PageHeader, StatusCallout, StoryCard, StoryFilters } from '../components'
import { DEFAULT_FILTERS, loadStoredFilters, saveStoredFilters, type StoryFilterState } from '../components/story-filters'

export function StoryListPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const seedFromUrl = searchParams.get('seed')
  const groupIdFromUrl = searchParams.get('groupId')
  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<StoryFilterState>(() => loadStoredFilters())

  useEffect(() => {
    saveStoredFilters(filters)
  }, [filters])
  const [universes, setUniverses] = useState<StoryGroup[]>([])
  const [showModal, setShowModal] = useState(seedFromUrl !== null)
  const [showExampleModal, setShowExampleModal] = useState(false)

  useEffect(() => {
    api.universes.list().then(setUniverses).catch(() => undefined)
  }, [])

  const allTags = Array.from(
    new Set(stories.flatMap((s) => (s.tags as string[] | null) ?? []))
  ).sort()

  const fetchStories = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await api.stories.list({
        status: filters.status === 'all' ? undefined : filters.status,
        groupId: filters.groupId ?? undefined,
        tag: filters.tag ?? undefined,
      })

      setStories(data)
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Не удалось загрузить истории')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    void fetchStories()
  }, [fetchStories])

  async function handleCreateStory(input: CreateStoryInput) {
    const created = await api.stories.create(input)

    setShowModal(false)

    if ('seed' in input) {
      void api.pipeline.run(created.id, input.seed)
    }

    navigate(`/stories/${created.id}/pipeline`)
  }

  const handleDeleteStory = useCallback((story: Story) => {
    if (!confirm('Удалить эту историю навсегда? Это действие нельзя отменить.')) {
      return
    }

    api.stories
      .delete(story.id)
      .then(() => setStories((prev) => prev.filter((s) => s.id !== story.id)))
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Не удалось удалить историю'),
      )
  }, [])

  return (
    <div>
      <PageHeader
        eyebrow="Библиотека"
        title="Истории"
        description="Следи за историями от черновика до прочтения и запускай новые идеи для сказок на ночь."
        action={
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-secondary gap-2" onClick={() => setShowExampleModal(true)}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M4 3a2 2 0 00-2 2v9.5A2.5 2.5 0 004.5 17H16a2 2 0 002-2V6a2 2 0 00-2-2h-5.5L9.3 2.4A1 1 0 008.5 2H4z" />
              </svg>
              Добавить пример
            </button>
            <button className="btn btn-primary gap-2" onClick={() => setShowModal(true)}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
              </svg>
              Новая история
            </button>
          </div>
        }
      />

      <div className="mb-6">
        <StoryFilters
          value={filters}
          onChange={setFilters}
          universes={universes}
          availableTags={allTags}
        />
      </div>

      {loading && <StatusCallout title="Загрузка" message="Получаем истории из библиотеки." />}

      {!loading && error && (
        <StatusCallout tone="error" title="Не удалось загрузить истории" message={error} />
      )}

      {!loading && !error && stories.length === 0 && (
        <StatusCallout
          tone="warning"
          title="Историй пока нет"
          message="Создай историю или смени фильтры."
        />
      )}

      {!loading && !error && stories.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {stories.map((story) => (
            <StoryCard
              key={story.id}
              title={story.title}
              status={story.status}
              createdAt={story.created_at}
              onTitleClick={() => navigate(`/stories/${story.id}`)}
              actions={[
                {
                  label: 'Открыть',
                  tone: 'primary',
                  onClick: () => navigate(`/stories/${story.id}`),
                },
                {
                  label: 'Удалить',
                  tone: 'destructive',
                  onClick: () => handleDeleteStory(story),
                },
              ]}
            />
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

      <AddExampleStoryModal
        open={showExampleModal}
        onClose={() => {
          setShowExampleModal(false)
          void fetchStories()
        }}
      />
    </div>
  )
}
