import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Story } from '../lib/api'
import { StoryCard } from '../components'

type StatusFilter = 'all' | 'draft' | 'ready' | 'read' | 'archived'

const FILTER_TABS: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Ready', value: 'ready' },
  { label: 'Read', value: 'read' },
  { label: 'Archived', value: 'archived' },
]

function NewStoryModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (id: number) => void
}) {
  const [seed, setSeed] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!seed.trim()) return

    setSubmitting(true)
    setError(null)

    try {
      const story = await api.stories.create(seed.trim())

      onCreated(story.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create story')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4">
        <h2 className="text-xl font-semibold mb-4">New Story</h2>

        <textarea
          className="w-full border border-gray-300 rounded-lg p-3 text-sm min-h-[120px] resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
          placeholder="Enter a seed idea for the story..."
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          autoFocus
        />

        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}

        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            disabled={submitting || !seed.trim()}
            className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create Story'}
          </button>
        </div>
      </div>
    </div>
  )
}

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stories')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void fetchStories()
  }, [fetchStories])

  const handleCreated = (id: number) => {
    setShowModal(false)
    navigate(`/stories/${id}/pipeline`)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Stories</h1>

        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
        >
          + New Story
        </button>
      </div>

      <div className="flex gap-2 mb-6">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
              filter === tab.value
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'text-gray-600 border-gray-300 hover:border-indigo-400'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading stories...</p>}

      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && stories.length === 0 && (
        <p className="text-gray-400 text-sm">No stories found. Create one to get started.</p>
      )}

      {!loading && !error && stories.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stories.map((story) => (
            <button
              key={story.id}
              className="text-left w-full"
              onClick={() => navigate(`/stories/${story.id}`)}
            >
              <StoryCard
                title={story.title}
                status={story.status}
                createdAt={story.created_at}
              />
            </button>
          ))}
        </div>
      )}

      {showModal && <NewStoryModal onClose={() => setShowModal(false)} onCreated={handleCreated} />}
    </div>
  )
}
