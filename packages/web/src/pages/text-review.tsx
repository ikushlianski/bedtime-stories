import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, type Story, type PsychologistOutput } from '../lib/api'
import { PageHeader, StatusCallout, TextReviewCard } from '../components'

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
  const [psychOutput, setPsychOutput] = useState<PsychologistOutput | null>(null)

  useEffect(() => {
    api.pipeline
      .snapshot(id)
      .then((snapshot) => setPsychOutput(snapshot.psychologist_text_output))
      .catch(() => setPsychOutput(null))
  }, [id])

  return psychOutput
}

export function TextReviewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const storyId = Number(id)
  const { story, loading, error } = useTextReviewStory(storyId)
  const psychOutput = useRunSnapshot(storyId)
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

  if (!psychOutput) {
    return <StatusCallout title="Loading assessment" message="Waiting for psychologist output." />
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

      <TextReviewCard
        textV1={story.text_v1 ?? ''}
        textV2={story.text_v2 ?? ''}
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
