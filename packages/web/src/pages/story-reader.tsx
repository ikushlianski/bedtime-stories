import { useState, useEffect, useRef, useCallback, type RefObject } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, isReactionAnnotation, type Story, type Annotation, type AnnotationType, type PipelineStatusValue } from '../lib/api'
import { AnnotationToolbar, FeedbackForm, PageHeader, StatusCallout, Toast, StoryTagEditor } from '../components'
import { useToast } from '../lib/use-toast'
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

  return { story, setStory, loading, error }
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

function EditableStoryText({
  initialText,
  editRef,
}: {
  initialText: string
  editRef: RefObject<HTMLDivElement | null>
}) {
  useEffect(() => {
    if (editRef.current && !editRef.current.innerText) {
      editRef.current.innerText = initialText
    }
  }, [initialText, editRef])

  return (
    <div
      ref={editRef}
      contentEditable
      suppressContentEditableWarning
      className="rounded-box border-2 border-primary bg-base-100 p-8 font-serif text-xl leading-relaxed text-base-content shadow-sm outline-none min-h-96 focus:border-primary/70"
    />
  )
}

export function StoryReaderPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const storyId = Number(id)
  const { story, setStory, loading, error } = useStoryFetch(storyId)
  const [selection, setSelection] = useState<SelectionState | null>(null)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [annotationError, setAnnotationError] = useState<string | null>(null)
  const [markingRead, setMarkingRead] = useState(false)
  const [currentStatus, setCurrentStatus] = useState<string | null>(null)
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatusValue | null>(null)
  const [approvingText, setApprovingText] = useState(false)
  const [redoingText, setRedoingText] = useState(false)
  const [reviewActionError, setReviewActionError] = useState<string | null>(null)
  const [analysisText, setAnalysisText] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisSaving, setAnalysisSaving] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [analysisReactionsCount, setAnalysisReactionsCount] = useState<number | null>(null)
  const { message: toastMessage, showToast } = useToast()
  const [storyTags, setStoryTags] = useState<string[]>([])
  const [editMode, setEditMode] = useState(false)
  const [savingText, setSavingText] = useState(false)
  const [saveTextError, setSaveTextError] = useState<string | null>(null)
  const editRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (story) {
      setCurrentStatus(story.status)
      setAnalysisText(story.story_analysis ?? '')
      setStoryTags((story.tags as string[] | null) ?? [])
    }
  }, [story])

  useEffect(() => {
    if (isNaN(storyId)) return

    api.pipeline
      .status(storyId)
      .then((s) => setPipelineStatus(s.status))
      .catch(() => undefined)
  }, [storyId])

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
        showToast('Заметка сохранена')
      } catch (err) {
        setAnnotationError(err instanceof Error ? err.message : 'Не удалось сохранить заметку')
      }
    },
    [storyId],
  )

  const handleSaveText = useCallback(async () => {
    if (!editRef.current) return

    const newText = editRef.current.innerText
    setSavingText(true)
    setSaveTextError(null)

    try {
      const updated = await api.stories.updateText(storyId, newText)
      setStory(updated)
      setEditMode(false)
      showToast('Текст сохранён')
    } catch (err) {
      setSaveTextError(err instanceof Error ? err.message : 'Не удалось сохранить текст')
    } finally {
      setSavingText(false)
    }
  }, [storyId, setStory, showToast])

  const counts = countByType(annotations)
  const reactionCount = totalReactions(counts)

  useEffect(() => {
    if (!story) return

    if (story.status === 'draft' && !story.text_final) {
      api.pipeline.status(storyId).then((s) => {
        setPipelineStatus(s.status)

        if (s.status === 'questions_pending') {
          navigate(`/stories/${storyId}/questions`, { replace: true })
        } else if (s.status === 'text_ready') {
          navigate(`/stories/${storyId}/text-review`, { replace: true })
        } else if (s.status === 'text_review') {
          /* stay on story reader — review banner will appear */
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

  if (story.status === 'draft' && !story.text_final && pipelineStatus !== 'text_review') {
    return <StatusCallout title="Перенаправление" message="Определяем статус конвейера..." />
  }

  const textToDisplay = story.text_final ?? story.text_v2 ?? story.text_v1 ?? null

  return (
    <div>
      <Toast message={toastMessage} />

      {pipelineStatus === 'text_review' && (
        <div className="mb-6 rounded-box border border-primary/30 bg-primary/10 p-4">
          {story.text_change_summary && (
            <div className="mb-4 rounded-box border border-info/30 bg-info/10 p-4">
              <p className="mb-1 text-sm font-semibold text-info-content">Что изменилось</p>
              <p className="text-sm text-base-content">{story.text_change_summary}</p>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-base-content">История готова к проверке. Одобри или отправь на доработку.</p>
            <div className="flex gap-2">
              {reviewActionError && (
                <span className="text-xs text-error">{reviewActionError}</span>
              )}
              <button
                className="btn btn-sm btn-outline"
                disabled={redoingText}
                onClick={() => {
                  setRedoingText(true)
                  setReviewActionError(null)
                  api.stories.redoText(storyId)
                    .then(() => navigate(`/stories/${storyId}/pipeline`))
                    .catch((err) => {
                      setReviewActionError(err instanceof Error ? err.message : 'Не удалось запустить доработку')
                      setRedoingText(false)
                    })
                }}
              >
                {redoingText ? 'Запускаем…' : 'Ещё один проход'}
              </button>
              <button
                className="btn btn-sm btn-primary"
                disabled={approvingText}
                onClick={() => {
                  setApprovingText(true)
                  setReviewActionError(null)
                  api.stories.approveText(storyId, true)
                    .then(() => {
                      setCurrentStatus('ready')
                      setPipelineStatus('text_ready')
                    })
                    .catch((err) => {
                      setReviewActionError(err instanceof Error ? err.message : 'Не удалось одобрить историю')
                      setApprovingText(false)
                    })
                }}
              >
                {approvingText ? 'Сохраняем…' : 'Одобрить историю'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                className="btn btn-primary btn-sm"
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

      <div className="mb-6 rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-base-content/50">Категории</p>
        <StoryTagEditor
          tags={storyTags}
          onSave={async (tags) => {
            const updated = await api.stories.updateTags(storyId, tags)
            setStoryTags((updated.tags as string[] | null) ?? [])
            showToast('Категории сохранены')
          }}
        />
      </div>

      <div className="mb-2 flex justify-end gap-2">
        {textToDisplay && !editMode && (
          <button
            className="btn btn-xs btn-outline"
            onClick={() => setEditMode(true)}
          >
            Редактировать текст
          </button>
        )}
        {editMode && (
          <>
            {saveTextError && <span className="text-xs text-error self-center">{saveTextError}</span>}
            <button className="btn btn-xs btn-ghost" disabled={savingText} onClick={() => setEditMode(false)}>
              Отмена
            </button>
            <button className="btn btn-xs btn-primary" disabled={savingText} onClick={() => void handleSaveText()}>
              {savingText ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </>
        )}
      </div>

      <div className="relative">
        {editMode && textToDisplay ? (
          <EditableStoryText initialText={textToDisplay} editRef={editRef} />
        ) : textToDisplay ? (
          <StoryText text={textToDisplay} onSelection={setSelection} />
        ) : (
          <StatusCallout
            tone="warning"
            title="Текст недоступен"
            message="Финальный текст истории ещё не был сгенерирован."
          />
        )}

        {!editMode && selection && (
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
                const storyText = textToDisplay ?? ''
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

      {pipelineStatus === 'text_review' && (
        <div className="mt-4 rounded-box border border-primary/30 bg-primary/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-base-content">Одобри историю или отправь на доработку.</p>
            <div className="flex gap-2">
              {reviewActionError && <span className="text-xs text-error self-center">{reviewActionError}</span>}
              <button
                className="btn btn-sm btn-outline"
                disabled={redoingText}
                onClick={() => {
                  setRedoingText(true)
                  setReviewActionError(null)
                  api.stories.redoText(storyId)
                    .then(() => navigate(`/stories/${storyId}/pipeline`))
                    .catch((err) => {
                      setReviewActionError(err instanceof Error ? err.message : 'Не удалось запустить доработку')
                      setRedoingText(false)
                    })
                }}
              >
                {redoingText ? 'Запускаем…' : 'Ещё один проход'}
              </button>
              <button
                className="btn btn-sm btn-primary"
                disabled={approvingText}
                onClick={() => {
                  setApprovingText(true)
                  setReviewActionError(null)
                  api.stories.approveText(storyId, true)
                    .then(() => {
                      setCurrentStatus('ready')
                      setPipelineStatus('text_ready')
                    })
                    .catch((err) => {
                      setReviewActionError(err instanceof Error ? err.message : 'Не удалось одобрить историю')
                      setApprovingText(false)
                    })
                }}
              >
                {approvingText ? 'Сохраняем…' : 'Одобрить историю'}
              </button>
            </div>
          </div>
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
                className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm space-y-3"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`badge badge-sm ${isReactionAnnotation(annotation.type) ? 'badge-primary' : 'badge-secondary'}`}
                  >
                    {annotationTypeLabel(annotation.type)}
                  </span>
                  <span className="text-xs text-base-content/50">
                    {new Date(annotation.createdAt).toLocaleString()}
                  </span>
                </div>

                <blockquote className="border-l-4 border-base-300 pl-4 font-serif text-sm italic text-base-content/60">
                  {annotation.selectedText}
                </blockquote>

                {annotation.noteText && (
                  <div className="flex justify-end">
                    <div className="max-w-prose rounded-2xl rounded-tr-sm bg-primary/10 px-4 py-2.5">
                      <p className="mb-1 text-xs font-semibold text-primary/70">Вы</p>
                      <p className="whitespace-pre-wrap text-sm text-base-content">{annotation.noteText}</p>
                    </div>
                  </div>
                )}

                {annotation.resolvedSummary && (
                  <div className="flex justify-start">
                    <div className="max-w-prose rounded-2xl rounded-tl-sm bg-base-200 px-4 py-2.5">
                      <p className="mb-1 text-xs font-semibold text-base-content/40">ИИ</p>
                      <p className="whitespace-pre-wrap text-sm text-base-content/80">{annotation.resolvedSummary}</p>
                    </div>
                  </div>
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

      {story.source === 'legacy' && (
        <section className="mt-10">
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-[0.2em] text-base-content/60">
            Анализ примерной истории
          </h3>
          <p className="mb-3 text-sm text-base-content/50">
            ИИ извлекает стилистические паттерны и реакции ребёнка. Эти данные используются при генерации новых историй.
          </p>

          <div className="flex gap-2 mb-3">
            <button
              className={`btn btn-sm btn-outline ${analyzing ? 'loading' : ''}`}
              disabled={analyzing || analysisSaving}
              onClick={() => {
                setAnalyzing(true)
                setAnalysisError(null)
                api.stories.analyze(storyId)
                  .then((result) => {
                    setAnalysisText(result.storyAnalysis)
                    setAnalysisReactionsCount(result.reactionsExtracted)
                  })
                  .catch((err) => setAnalysisError(err instanceof Error ? err.message : 'Ошибка анализа'))
                  .finally(() => setAnalyzing(false))
              }}
            >
              {analyzing ? 'Анализируем...' : analysisText ? 'Перезапустить анализ ИИ' : 'Проанализировать с ИИ'}
            </button>
          </div>

          {analysisReactionsCount !== null && (
            <p className="mb-2 text-xs text-success">
              Извлечено реакций: {analysisReactionsCount}
            </p>
          )}

          <textarea
            className="textarea textarea-bordered min-h-40 w-full bg-base-200"
            placeholder="Заметки об этой истории — добавь свои наблюдения..."
            value={analysisText}
            onChange={(e) => setAnalysisText(e.target.value)}
            disabled={analyzing}
          />

          <div className="mt-2 flex items-center gap-3">
            <button
              className={`btn btn-sm btn-primary ${analysisSaving ? 'loading' : ''}`}
              disabled={analysisSaving || analyzing}
              onClick={() => {
                setAnalysisSaving(true)
                setAnalysisError(null)
                api.stories.updateAnalysis(storyId, analysisText)
                  .catch((err) => setAnalysisError(err instanceof Error ? err.message : 'Не удалось сохранить'))
                  .finally(() => setAnalysisSaving(false))
              }}
            >
              {analysisSaving ? 'Сохраняем...' : 'Сохранить заметки'}
            </button>
            {analysisError && <span className="text-sm text-error">{analysisError}</span>}
          </div>
        </section>
      )}

      {story.status !== 'draft' && (
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
      )}
    </div>
  )
}
