import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, type Story, type Annotation, type AnnotationType } from '../lib/api'
import { AnnotationToolbar, FeedbackForm, PageHeader, StatusCallout } from '../components'
import type { FeedbackValues } from '../components/types'
import {
  annotationTypeLabel,
  sortAnnotationsByPosition,
  appendAnnotation,
  countByType,
} from './story-reader-annotations'
import { findTextOffset } from './find-text-offset'

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
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [annotationError, setAnnotationError] = useState<string | null>(null)

  useEffect(() => {
    if (isNaN(storyId)) return

    api.annotations
      .list(storyId)
      .then((items) => setAnnotations(sortAnnotationsByPosition(items)))
      .catch(() => {
        /* surfaced inline on write failure; list endpoint errors are non-critical */
      })
  }, [storyId])

  const handleAnnotationDismiss = useCallback(() => setSelection(null), [])

  const handleAnnotate = useCallback(
    async (type: AnnotationType, text: string, start: number, end: number) => {
      setAnnotationError(null)

      try {
        const created = await api.annotations.create(storyId, {
          type,
          selectedText: text,
          positionStart: start,
          positionEnd: end,
        })

        setAnnotations((current) => appendAnnotation(current, created))
      } catch (err) {
        setAnnotationError(err instanceof Error ? err.message : 'Failed to save annotation')
      }
    },
    [storyId],
  )

  const counts = countByType(annotations)

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
        action={
          <div className="flex items-center gap-2">
            <span className="badge badge-outline capitalize">{story.status}</span>
            {annotations.length > 0 && (
              <span className="badge badge-primary badge-outline">
                {counts.sasha_reaction} reactions · {counts.my_note} notes
              </span>
            )}
          </div>
        }
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
                const storyText = story?.text_final ?? ''
                const globalOffset = findTextOffset(storyText, text)
                const start = globalOffset?.start ?? selection.start
                const end = globalOffset?.end ?? selection.end

                void handleAnnotate(type, text, start, end)
                handleAnnotationDismiss()
              }}
            />
          </div>
        )}
      </div>

      {annotationError && (
        <div className="mt-4">
          <StatusCallout tone="error" title="Annotation save failed" message={annotationError} />
        </div>
      )}

      {annotations.length > 0 && (
        <section className="mt-8">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-base-content/60">
            Annotations
          </h3>
          <ul className="space-y-3">
            {annotations.map((annotation) => (
              <li
                key={annotation.id}
                className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={`badge badge-sm ${annotation.type === 'sasha_reaction' ? 'badge-primary' : 'badge-secondary'}`}
                  >
                    {annotationTypeLabel(annotation.type)}
                  </span>
                  <span className="text-xs text-base-content/50">
                    {new Date(annotation.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-base text-base-content">
                  “{annotation.selectedText}”
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

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
