import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, type Story } from '../lib/api'
import { AnnotationToolbar, FeedbackForm } from '../components'
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
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load story'))
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
      className="relative prose prose-lg max-w-none font-serif leading-relaxed text-gray-800 select-text"
      onMouseUp={handleMouseUp}
    >
      {text.split('\n').map((para, i) => (
        <p key={i}>{para}</p>
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate('/')}
          className="text-sm text-indigo-600 hover:underline flex items-center gap-1"
        >
          ← Back to stories
        </button>

        <span className="text-xs text-gray-400 capitalize">{story.status}</span>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-8">{story.title}</h1>

      <div className="relative">
        {story.text_final ? (
          <StoryText text={story.text_final} onSelection={setSelection} />
        ) : (
          <p className="text-gray-400 italic">Story text not yet available.</p>
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

      <div className="mt-16 border-t border-gray-200 pt-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Feedback</h2>

        <FeedbackForm
          storyId={String(storyId)}
          onSubmit={(values: FeedbackValues) =>
            api.feedback.submit(storyId, { ...values, feedback_type: 'agent_run' }).then(() => undefined)
          }
        />
      </div>
    </div>
  )
}
