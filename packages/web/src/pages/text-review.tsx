import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, type Story, type RunSnapshot } from '../lib/api'
import { PageHeader, StatusCallout, TextReviewCard } from '../components'
import DiffViewer from '../components/diff-viewer'
import { deriveReviewSnapshotState } from './review-snapshot-state'

function useTextReviewStory(id: number) {
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

export function TextReviewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const storyId = Number(id)
  const { story, loading, error } = useTextReviewStory(storyId)
  const snapshotFetch = useRunSnapshot(storyId)
  const snapshotState = deriveReviewSnapshotState({
    loading: snapshotFetch.loading,
    error: snapshotFetch.error,
    snapshot: snapshotFetch.snapshot,
    phase: 'text',
  })
  const [approving, setApproving] = useState(false)
  const [approveError, setApproveError] = useState<string | null>(null)

  const handleApprove = async () => {
    setApproving(true)
    setApproveError(null)

    try {
      await api.stories.approveText(storyId)
      navigate(`/stories/${storyId}`)
    } catch (approvalError) {
      setApproveError(approvalError instanceof Error ? approvalError.message : 'Failed to approve text')
    } finally {
      setApproving(false)
    }
  }

  if (loading) {
    return <StatusCallout title="Loading" message="Fetching the text review data." />
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

  return (
    <div>
      <PageHeader
        eyebrow="Review"
        title="Text Review"
        description="Compare the two text drafts and confirm the final wording is safe and therapeutically useful."
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

      {snapshotState.kind === 'ready' ? (
        <TextReviewCard
          textV1={story.text_v1 ?? ''}
          textV2={story.text_v2 ?? ''}
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
                <h2 className="font-serif text-3xl text-base-content">Text Review</h2>

                <button className="btn btn-success btn-wide" onClick={approveHandler} disabled={approving}>
                  Approve Text
                </button>
              </div>

              <DiffViewer
                originalText={story.text_v1 ?? ''}
                revisedText={story.text_v2 ?? ''}
                label="Text v1 → v2"
              />
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
