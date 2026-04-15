import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, type Story, type RunSnapshot } from '../lib/api'
import { PageHeader, PlanReviewCard, StatusCallout } from '../components'
import DiffViewer from '../components/diff-viewer'
import { deriveReviewSnapshotState } from './review-snapshot-state'

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
  const [snapshot, setSnapshot] = useState<RunSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    api.pipeline
      .snapshot(id)
      .then((data) => setSnapshot(data))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err : new Error('Failed to load pipeline snapshot'))
      })
      .finally(() => setLoading(false))
  }, [id])

  return { snapshot, loading, error }
}

export function PlanReviewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const storyId = Number(id)
  const { story, loading, error } = usePlanReviewStory(storyId)
  const snapshotFetch = useRunSnapshot(storyId)
  const snapshotState = deriveReviewSnapshotState({
    loading: snapshotFetch.loading,
    error: snapshotFetch.error,
    snapshot: snapshotFetch.snapshot,
    phase: 'plan',
  })
  const [approving, setApproving] = useState(false)
  const [approveError, setApproveError] = useState<string | null>(null)
  const [dismissing, setDismissing] = useState(false)

  const handleDismiss = async () => {
    if (!confirm('Delete this story permanently? This cannot be undone.')) {
      return
    }

    setDismissing(true)

    try {
      await api.stories.delete(storyId)
      navigate('/')
    } catch (dismissError) {
      setApproveError(dismissError instanceof Error ? dismissError.message : 'Failed to delete story')
      setDismissing(false)
    }
  }

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

  if (snapshotState.kind === 'loading') {
    return <StatusCallout title="Loading assessment" message="Waiting for psychologist output." />
  }

  const approveHandler = () => {
    if (!approving) {
      void handleApprove()
    }
  }

  const dismissHandler = () => {
    if (!dismissing) {
      void handleDismiss()
    }
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
        action={
          <button
            className="btn btn-error btn-outline btn-sm"
            onClick={dismissHandler}
            disabled={dismissing}
          >
            Dismiss story
          </button>
        }
      />

      {approveError && (
        <div className="mb-4">
          <StatusCallout tone="error" title="Approval failed" message={approveError} />
        </div>
      )}

      {snapshotState.kind === 'ready' ? (
        <PlanReviewCard
          planV1={story.plan_v1 ?? ''}
          planFinal={story.plan_final ?? ''}
          iterationsCount={story.plan_iterations ?? 0}
          psychologistOutput={snapshotState.psychOutput}
          onApprove={approveHandler}
        />
      ) : (
        <div className="space-y-4">
          <StatusCallout
            tone={snapshotState.reason === 'error' ? 'error' : 'warning'}
            title={
              snapshotState.reason === 'error'
                ? 'Psychologist assessment unavailable'
                : 'No psychologist assessment recorded'
            }
            message={snapshotState.message}
          />

          <section className="card border border-base-300 bg-base-100 shadow-sm">
            <div className="card-body gap-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-serif text-3xl text-base-content">Plan Review</h2>
                  <p className="text-sm text-base-content/65">
                    Iterations: {story.plan_iterations ?? 0}
                  </p>
                </div>

                <button className="btn btn-success btn-wide" onClick={approveHandler} disabled={approving}>
                  Approve Plan
                </button>
              </div>

              <DiffViewer
                originalText={story.plan_v1 ?? ''}
                revisedText={story.plan_final ?? ''}
                label="Plan v1 → Final"
              />
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
