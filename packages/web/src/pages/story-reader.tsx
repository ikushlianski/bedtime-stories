import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, type Story } from '../lib/api'
import { AnnotationToolbar, FeedbackForm, PageHeader, StatusCallout } from '../components'
import type { FeedbackValues } from '../components/types'

interface SelectionState {
  text: string
  position: { x: number; y: number }
  start: number
  end: number
}

function useStoryFetch(id: number) {
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

function StoryText({
  text,
  onSelection,
}: {
  text: string
  onSelection: (sel: SelectionState | null) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection()

    if (!selection || selection.isCollapsed || !containerRef.current) {
      onSelection(null)
      return
    }

    const selectedText = selection.toString().trim()

    if (!selectedText) {
      onSelection(null)
      return
    }

    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    const containerRect = containerRef.current.getBoundingClientRect()

    onSelection({
      text: selectedText,
      position: {
        x: rect.left - containerRect.left + rect.width / 2,
        y: rect.top - containerRect.top - 8,
      },
      start: range.startOffset,
      end: range.endOffset,
    })
  }, [onSelection])

  return (
    <div
      ref={containerRef}
      className="relative rounded-box border border-base-300 bg-base-100 p-8 font-serif text-xl leading-relaxed text-base-content shadow-sm"
      onMouseUp={handleMouseUp}
    >
      {text.split('\n').map((para, i) => (
        <p key={i} className="mb-4 last:mb-0">
          {para}
        </p>
      ))}
    </div>
  )
}

export function StoryReaderPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const storyId = Number(id)
  const { story, loading, error } = useStoryFetch(storyId)
  const [selection, setSelection] = useState<SelectionState | null>(null)

  const handleAnnotationDismiss = useCallback(() => setSelection(null), [])

  if (loading) {
    return <StatusCallout title="Loading" message="Fetching the story text." />
  }

  if (error) {
    return <StatusCallout tone="error" title="Story load failed" message={error} />
  }

  if (!story) {
    return <StatusCallout tone="warning" title="Story not found" message="The requested story does not exist." />
  }

  return (
    <div>
      <PageHeader
        eyebrow="Reading"
        title={story.title}
        description="Read the final story, annotate specific passages, and capture post-read feedback."
        backAction={
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
            ← Back to stories
          </button>
        }
        action={<span className="badge badge-outline capitalize">{story.status}</span>}
      />

      <div className="relative">
        {story.text_final ? (
          <StoryText text={story.text_final} onSelection={setSelection} />
        ) : (
          <StatusCallout
            tone="warning"
            title="Text unavailable"
            message="The final story text has not been generated yet."
          />
        )}

        {selection && (
          <div
            style={{
              position: 'absolute',
              left: selection.position.x,
              top: selection.position.y,
              transform: 'translateX(-50%)',
            }}
          >
            <AnnotationToolbar
              selectedText={selection.text}
              onAnnotate={(type, text) => {
                void api.annotations.create(storyId, {
                  text,
                  type,
                  start: selection.start,
                  end: selection.end,
                })
                handleAnnotationDismiss()
              }}
            />
          </div>
        )}
      </div>

      <section className="mt-12">
        <PageHeader
          eyebrow="Feedback"
          title="Reader Response"
          description="Capture the overall reaction after reading to improve later story generations."
        />

        <FeedbackForm
          storyId={String(storyId)}
          onSubmit={(values: FeedbackValues) =>
            api.feedback.submit(storyId, { ...values, feedback_type: 'agent_run' }).then(() => undefined)
          }
        />
      </section>
    </div>
  )
}
