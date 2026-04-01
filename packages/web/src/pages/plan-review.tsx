import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, type Story, type PsychologistOutput } from '../lib/api'
import { PlanReviewCard } from '../components'

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
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load story'))
      .finally(() => setLoading(false))
  }, [id])

  return { story, loading, error }
}

function useRunSnapshot(id: number) {
  const [psychOutput, setPsychOutput] = useState<PsychologistOutput | null>(null)

  useEffect(() => {
    api.pipeline
      .snapshot(id)
      .then((snapshot) => setPsychOutput(snapshot.psychologist_plan_output))
      .catch(() => setPsychOutput(null))
  }, [id])

  return psychOutput
}

export function PlanReviewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const storyId = Number(id)
  const { story, loading, error } = usePlanReviewStory(storyId)
  const psychOutput = useRunSnapshot(storyId)
  const [approving, setApproving] = useState(false)
  const [approveError, setApproveError] = useState<string | null>(null)

  const handleApprove = async () => {
    setApproving(true)
    setApproveError(null)

    try {
      await api.stories.approvePlan(storyId)
      navigate(`/stories/${storyId}/pipeline`)
    } catch (err) {
      setApproveError(err instanceof Error ? err.message : 'Failed to approve plan')
    } finally {
      setApproving(false)
    }
  }

  if (loading) {
    return <p className="text-gray-500 text-sm">Loading story...</p>
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
        {error}
      </div>
    )
  }

  if (!story) {
    return <p className="text-gray-400 text-sm">Story not found.</p>
  }

  if (!psychOutput) {
    return <p className="text-gray-400 text-sm">Loading assessment...</p>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate('/')}
          className="text-sm text-indigo-600 hover:underline flex items-center gap-1"
        >
          ← Back to stories
        </button>

        <h1 className="text-xl font-semibold text-gray-800">Plan Review</h1>
      </div>

      {approveError && (
        <p className="text-red-600 text-sm mb-4">{approveError}</p>
      )}

      <PlanReviewCard
        planV1={story.plan_v1 ?? ''}
        planFinal={story.plan_final ?? ''}
        iterationsCount={story.plan_iterations ?? 0}
        psychologistOutput={psychOutput}
        onApprove={() => {
          if (!approving) void handleApprove()
        }}
      />
    </div>
  )
}
