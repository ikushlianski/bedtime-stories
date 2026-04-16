import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, isReactionAnnotation, type Story, type Annotation, type AnnotationType } from '../lib/api'
import { AnnotationToolbar, FeedbackForm, PageHeader, StatusCallout } from '../components'
import type { FeedbackValues } from '../components/types'
import {
  annotationTypeLabel,
  sortAnnotationsByPosition,
  appendAnnotation,
  countByType,
  totalReactions,
} from './story-reader-annotations'
import { findTextOffset } from './find-text-offset'

interface SelectionState {
  text: string
  position: { x: number; y: number }
  placement: 'above' | 'below'
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
      .catch((fetchError) => setError(fetchError instanceof Error ? fetchError.message : 'Не удалось загрузить историю'))
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
    const spaceAbove = rect.top - containerRect.top
    const placement: 'above' | 'below' = spaceAbove < 60 ? 'below' : 'above'

    onSelection({
      text: selectedText,
      position: {
        x: rect.left - containerRect.left + rect.width / 2,
        y: placement === 'above' ? rect.top - containerRect.top - 8 : rect.bottom - containerRect.top + 8,
      },
      placement,
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
  const [markingRead, setMarkingRead] = useState(false)
  const [currentStatus, setCurrentStatus] = useState<string | null>(null)

  useEffect(() => {
    if (story) {
      setCurrentStatus(story.status)
    }
  }, [story])

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
    async (type: AnnotationType, text: string, start: number, end: number, noteText?: string) => {
      setAnnotationError(null)

      try {
        const created = await api.annotations.create(storyId, {
          type,
          selectedText: text,
          noteText,
          positionStart: start,
          positionEnd: end,
        })

        setAnnotations((current) => appendAnnotation(current, created))
      } catch (err) {
        setAnnotationError(err instanceof Error ? err.message : 'Не удалось сохранить заметку')
      }
    },
    [storyId],
  )

  const counts = countByType(annotations)
  const reactionCount = totalReactions(counts)

  useEffect(() => {
    if (!story) return

    if (story.status === 'draft' && !story.text_final) {
      api.pipeline.status(storyId).then((pipelineStatus) => {
        if (pipelineStatus.status === 'questions_pending') {
          navigate(`/stories/${storyId}/questions`, { replace: true })
        } else if (pipelineStatus.status === 'plan_ready') {
          navigate(`/stories/${storyId}/plan-review`, { replace: true })
        } else if (pipelineStatus.status === 'text_ready') {
          navigate(`/stories/${storyId}/text-review`, { replace: true })
        } else {
          navigate(`/stories/${storyId}/pipeline`, { replace: true })
        }
      }).catch(() => {
        navigate(`/stories/${storyId}/pipeline`, { replace: true })
      })
    }
  }, [story, storyId, navigate])

  if (loading) {
    return <StatusCallout title="Загрузка" message="Получаем текст истории." />
  }

  if (error) {
    return <StatusCallout tone="error" title="Ошибка загрузки истории" message={error} />
  }

  if (!story) {
    return <StatusCallout tone="warning" title="История не найдена" message="Запрошенная история не существует." />
  }

  if (story.status === 'draft' && !story.text_final) {
    return <StatusCallout title="Перенаправление" message="Определяем статус конвейера..." />
  }

  return (
    <div>
      <PageHeader
        eyebrow="Чтение"
        title={story.title}
        description="Читай финальную историю, отмечай понравившиеся отрывки и оставь отзыв после прочтения."
        backAction={
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
            ← К историям
          </button>
        }
        action={
          <div className="flex items-center gap-2">
            <span className="badge badge-outline capitalize">{currentStatus ?? story.status}</span>
            {annotations.length > 0 && (
              <span className="badge badge-primary badge-outline">
                {reactionCount} реакций · {counts.my_note} заметок
              </span>
            )}
            {(currentStatus ?? story.status) === 'ready' && (
              <button
                className="btn btn-success btn-sm"
                disabled={markingRead}
                onClick={() => {
                  setMarkingRead(true)
                  api.stories
                    .updateStatus(storyId, 'read')
                    .then(() => setCurrentStatus('read'))
                    .finally(() => setMarkingRead(false))
                }}
              >
                {markingRead ? '...' : '✓ Прочитано'}
              </button>
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
            title="Текст недоступен"
            message="Финальный текст истории ещё не был сгенерирован."
          />
        )}

        {selection && (
          <div
            style={{
              position: 'absolute',
              left: selection.position.x,
              top: selection.position.y,
              transform: selection.placement === 'above' ? 'translate(-50%, -100%)' : 'translateX(-50%)',
              zIndex: 10,
            }}
          >
            <AnnotationToolbar
              selectedText={selection.text}
              onAnnotate={(type, text, noteText) => {
                const storyText = story?.text_final ?? ''
                const globalOffset = findTextOffset(storyText, text)
                const start = globalOffset?.start ?? selection.start
                const end = globalOffset?.end ?? selection.end

                void handleAnnotate(type, text, start, end, noteText)
                handleAnnotationDismiss()
              }}
            />
          </div>
        )}
      </div>

      {annotationError && (
        <div className="mt-4">
          <StatusCallout tone="error" title="Ошибка сохранения заметки" message={annotationError} />
        </div>
      )}

      {annotations.length > 0 && (
        <section className="mt-8">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-base-content/60">
            Заметки
          </h3>
          <ul className="space-y-3">
            {annotations.map((annotation) => (
              <li
                key={annotation.id}
                className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={`badge badge-sm ${isReactionAnnotation(annotation.type) ? 'badge-primary' : 'badge-secondary'}`}
                  >
                    {annotationTypeLabel(annotation.type)}
                  </span>
                  <span className="text-xs text-base-content/50">
                    {new Date(annotation.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="whitespace-pre-wrap font-serif text-sm italic text-base-content/70">
                  &ldquo;{annotation.selectedText}&rdquo;
                </p>
                {annotation.noteText && (
                  <p className="mt-2 whitespace-pre-wrap text-base text-base-content">
                    {annotation.noteText}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {story.discussion_questions !== null && story.discussion_questions.length > 0 && (
        <section className="mt-10">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-base-content/60">
            Вопросы для обсуждения
          </h3>
          <p className="mb-3 text-sm text-base-content/60">
            Задай Саше эти вопросы после истории — запомнившиеся ответы можно отметить как заметки выше.
          </p>
          <ol className="list-decimal space-y-2 pl-6 text-base text-base-content">
            {story.discussion_questions.map((question, i) => (
              <li key={i}>{question}</li>
            ))}
          </ol>
        </section>
      )}

      <section className="mt-12">
        <PageHeader
          eyebrow="Отзыв"
          title="Впечатления от чтения"
          description="Запиши общее впечатление после прочтения — это поможет улучшить следующие истории."
        />

        <FeedbackForm
          storyId={String(storyId)}
          onSubmit={(values: FeedbackValues) =>
            api.feedback.submit(storyId, {
              rating: values.rating,
              structured_feedback: values.structured_feedback,
              feedback_type: 'agent_run',
            }).then(() => undefined)
          }
        />
      </section>
    </div>
  )
}
