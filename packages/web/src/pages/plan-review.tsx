import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, type Story, type PsychologistOutput } from '../lib/api'
import { PageHeader, PlanReviewCard, StatusCallout } from '../components'

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
      .catch((fetchError) => setError(fetchError instanceof Error ? fetchError.message : 'Failed to load story'))
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
    } catch (approvalError) {
      setApproveError(approvalError instanceof Error ? approvalError.message : 'Failed to approve plan')
    } finally {
      setApproving(false)
    }
  }

  if (loading) {
    return <StatusCallout title="Loading" message="Fetching the plan review data." />
  }

  if (error) {
    return <StatusCallout tone="error" title="Story load failed" message={error} />
  }

  if (!story) {
    return <StatusCallout tone="warning" title="Story not found" message="The requested story does not exist." />
  }

  if (!psychOutput) {
    return <StatusCallout title="Loading assessment" message="Waiting for psychologist output." />
  }

  return (
    <div>
      <PageHeader
        eyebrow="Review"
        title="Plan Review"
        description="Compare the first plan draft against the final version and validate the psychologist assessment."
        backAction={
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
            ← Back to stories
          </button>
        }
      />

      {approveError && (
        <div className="mb-4">
          <StatusCallout tone="error" title="Approval failed" message={approveError} />
        </div>
      )}

      <PlanReviewCard
        planV1={story.plan_v1 ?? ''}
        planFinal={story.plan_final ?? ''}
        iterationsCount={story.plan_iterations ?? 0}
        psychologistOutput={psychOutput}
        onApprove={() => {
          if (!approving) {
            void handleApprove()
          }
        }}
      />
    </div>
  )
}
