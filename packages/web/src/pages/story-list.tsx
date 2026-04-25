import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { api, type Story, type CreateStoryInput, type StoryGroup } from '../lib/api'
import { AddExampleStoryModal, CreateStoryModal, PageHeader, StatusCallout, StoryCard, StoryFilters } from '../components'
import { loadStoredFilters, saveStoredFilters, type StoryFilterState, type StatusFilter } from '../components/story-filters'

const PAGE_META: Record<string, { eyebrow: string; title: string; description: string }> = {
  draft: {
    eyebrow: 'В работе',
    title: 'Черновики',
    description: 'Истории в процессе создания — от идеи до одобрения.',
  },
  ready: {
    eyebrow: 'К прочтению',
    title: 'Непрочитанные',
    description: 'Готовые истории, которые ещё не читали.',
  },
  read: {
    eyebrow: 'Прочитанные',
    title: 'Прочитанные',
    description: 'История прочитана. Можно вспомнить и перечитать.',
  },
}

interface SortableStoryCardProps {
  story: Story
  onTitleClick: () => void
  onDelete: () => void
}

function SortableStoryCard({ story, onTitleClick, onDelete }: SortableStoryCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: story.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: isDragging ? ('relative' as const) : undefined,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <StoryCard
        title={story.title}
        status={story.status}
        createdAt={story.created_at}
        seriesId={story.series_id}
        totalUsd={story.total_usd ?? null}
        onTitleClick={onTitleClick}
        dragHandleProps={{ ...listeners, ...attributes }}
        actions={[
          {
            label: 'Открыть',
            tone: 'primary',
            onClick: onTitleClick,
          },
          {
            label: 'Удалить',
            tone: 'destructive',
            onClick: onDelete,
          },
        ]}
      />
    </div>
  )
}

export function StoryListPage({ lockedStatus }: { lockedStatus?: StatusFilter }) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const seedFromUrl = searchParams.get('seed')
  const groupIdFromUrl = searchParams.get('groupId')
  const modalParam = searchParams.get('modal')

  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<StoryFilterState>(() => {
    const stored = loadStoredFilters()
    return lockedStatus ? { ...stored, status: lockedStatus } : stored
  })

  const effectiveFilters = useMemo(
    () => (lockedStatus ? { ...filters, status: lockedStatus } : filters),
    [filters, lockedStatus],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  )

  useEffect(() => {
    saveStoredFilters(filters)
  }, [filters])

  const [universes, setUniverses] = useState<StoryGroup[]>([])
  const [showModal, setShowModal] = useState(modalParam === 'create' || seedFromUrl !== null)
  const [showExampleModal, setShowExampleModal] = useState(modalParam === 'example')

  useEffect(() => {
    api.universes.list().then(setUniverses).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (modalParam === 'create') {
      setShowModal(true)
    } else if (modalParam === 'example') {
      setShowExampleModal(true)
    }
  }, [modalParam])

  const allTags = Array.from(
    new Set(stories.flatMap((s) => (s.tags as string[] | null) ?? []))
  ).sort()

  const fetchStories = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await api.stories.list({
        status: effectiveFilters.status === 'all' ? undefined : effectiveFilters.status,
        groupId: effectiveFilters.groupId ?? undefined,
        tag: effectiveFilters.tag ?? undefined,
        sort: effectiveFilters.sort !== 'custom' ? effectiveFilters.sort : undefined,
      })

      setStories(data)
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Не удалось загрузить истории')
    } finally {
      setLoading(false)
    }
  }, [effectiveFilters])

  useEffect(() => {
    void fetchStories()
  }, [fetchStories])

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (!over || active.id === over.id) return

    setStories((prev) => {
      const oldIndex = prev.findIndex((s) => s.id === active.id)
      const newIndex = prev.findIndex((s) => s.id === over.id)
      const reordered = arrayMove(prev, oldIndex, newIndex)

      void api.stories.reorder(reordered.map((s, i) => ({ id: s.id, sort_order: i * 10 })))

      return reordered
    })
  }

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

  function clearModalParam(params: URLSearchParams) {
    params.delete('modal')
    params.delete('seed')
    params.delete('groupId')
  }

  const meta = PAGE_META[lockedStatus ?? 'ready'] ?? PAGE_META.ready

  return (
    <div>
      <PageHeader
        eyebrow={meta.eyebrow}
        title={meta.title}
        description={meta.description}
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
          value={effectiveFilters}
          onChange={(f) => setFilters(lockedStatus ? { ...f, status: lockedStatus } : f)}
          universes={universes}
          availableTags={allTags}
          lockedStatus={lockedStatus}
        />
      </div>

      {loading && <StatusCallout title="Загрузка" message="Получаем истории из библиотеки." />}

      {!loading && error && (
        <StatusCallout tone="error" title="Не удалось загрузить истории" message={error} />
      )}

      {!loading && !error && stories.length === 0 && (
        <div className="rounded-box border border-warning/30 bg-warning/5 px-5 py-4 text-sm text-base-content/70">
          {(() => {
            const labels: Record<string, string> = {
              draft: 'Черновиков',
              ready: 'Непрочитанных историй',
              read: 'Прочитанных историй',
              archived: 'Архивных историй',
              all: 'Историй',
            }
            const label = labels[effectiveFilters.status] ?? 'Историй'
            const hasFilter = effectiveFilters.groupId != null || effectiveFilters.tag != null

            return (
              <>
                <span>{label} пока нет. </span>
                <button
                  className="btn-link text-sm font-normal underline-offset-2"
                  onClick={() => setShowModal(true)}
                >
                  Создай историю
                </button>
                {hasFilter && <span> или смени фильтр.</span>}
              </>
            )
          })()}
        </div>
      )}

      {!loading && !error && stories.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={stories.map((s) => s.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {stories.map((story) => (
                <SortableStoryCard
                  key={story.id}
                  story={story}
                  onTitleClick={() => navigate(`/stories/${story.id}`)}
                  onDelete={() => handleDeleteStory(story)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <CreateStoryModal
        open={showModal}
        initialSeed={seedFromUrl ?? ''}
        initialGroupId={groupIdFromUrl ? parseInt(groupIdFromUrl, 10) : null}
        onClose={() => {
          setShowModal(false)
          const next = new URLSearchParams(searchParams)
          clearModalParam(next)
          setSearchParams(next, { replace: true })
        }}
        onSubmit={handleCreateStory}
        onSeriesCreated={() => void fetchStories()}
      />

      <AddExampleStoryModal
        open={showExampleModal}
        onClose={() => {
          setShowExampleModal(false)
          const next = new URLSearchParams(searchParams)
          clearModalParam(next)
          setSearchParams(next, { replace: true })
          void fetchStories()
        }}
      />
    </div>
  )
}
