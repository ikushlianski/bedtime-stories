import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Story } from '../lib/api'
import { CreateStoryModal, PageHeader, StatusCallout, StoryCard, StoryFilterTabs } from '../components'

type StatusFilter = 'all' | 'draft' | 'ready' | 'read' | 'archived'

export function StoryListPage() {
  const navigate = useNavigate()
  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [showModal, setShowModal] = useState(false)

  const fetchStories = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await api.stories.list(filter === 'all' ? undefined : filter)

      setStories(data)
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load stories')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void fetchStories()
  }, [fetchStories])

  async function handleCreateStory(seed: string) {
    const story = await api.stories.create(seed)

    await api.pipeline.run(story.id, seed)

    setShowModal(false)
    navigate(`/stories/${story.id}/pipeline`)
  }

  return (
    <div>
      <PageHeader
        eyebrow="Library"
        title="Stories"
        description="Track generated stories from draft through reading, and launch new bedtime story ideas."
        action={
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + New Story
          </button>
        }
      />

      <div className="mb-6">
        <StoryFilterTabs value={filter} onChange={setFilter} />
      </div>

      {loading && <StatusCallout title="Loading" message="Fetching stories from the library." />}

      {!loading && error && (
        <StatusCallout tone="error" title="Could not load stories" message={error} />
      )}

      {!loading && !error && stories.length === 0 && (
        <StatusCallout
          tone="warning"
          title="No stories yet"
          message="Create a story to start the planning and review pipeline."
        />
      )}

      {!loading && !error && stories.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {stories.map((story) => (
            <button
              key={story.id}
              className="text-left"
              onClick={() => navigate(`/stories/${story.id}`)}
            >
              <StoryCard title={story.title} status={story.status} createdAt={story.created_at} />
            </button>
          ))}
        </div>
      )}

      <CreateStoryModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleCreateStory}
      />
    </div>
  )
}
