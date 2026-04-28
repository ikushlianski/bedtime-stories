import { useState, useEffect, useRef, useCallback, type RefObject } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, isReactionAnnotation, type Story, type Annotation, type AnnotationType, type PipelineStatusValue } from '../lib/api'
import { AnnotationToolbar, PageHeader, StatusCallout, Toast, StoryTagEditor } from '../components'
import ParentReviewForm from '../components/parent-review-form'
import ChildReactionForm from '../components/child-reaction-form'
import SwapModelModal from '../components/swap-model-modal'
import { formatMicros } from '@bedtime/shared/money/micros'
import { useToast } from '../lib/use-toast'
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

function stripLeadingTitle(text: string): string {
  const lines = text.split('\n')
  const firstNonEmpty = lines.findIndex((l) => l.trim() !== '')

  if (firstNonEmpty === -1) return text

  const first = lines[firstNonEmpty].trim()

  if (/^\*\*[^*]+\*\*$/.test(first) || /^#+\s/.test(first)) {
    return lines.slice(firstNonEmpty + 1).join('\n').trimStart()
  }

  return text
}

function StoryText({
  text,
  editable = false,
  draftKey,
  editRef,
  onSelection,
  onInput,
}: {
  text: string
  editable?: boolean
  draftKey?: string
  editRef?: RefObject<HTMLDivElement>
  onSelection: (sel: SelectionState | null) => void
  onInput?: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const resolvedRef = editRef ?? containerRef

  const displayText = stripLeadingTitle(text)

  useEffect(() => {
    if (!editable || !resolvedRef.current) return

    const saved = draftKey ? localStorage.getItem(draftKey) : null
    resolvedRef.current.innerText = saved ?? displayText
  }, [editable])

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleInput = useCallback(() => {
    onInput?.()

    if (!draftKey || !resolvedRef.current) return

    const text = resolvedRef.current.innerText

    if (saveTimer.current) clearTimeout(saveTimer.current)

    saveTimer.current = setTimeout(() => {
      localStorage.setItem(draftKey, text)
    }, 400)
  }, [draftKey, onInput, resolvedRef])

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection()

    if (!selection || selection.isCollapsed || !resolvedRef.current) {
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
    const containerRect = resolvedRef.current.getBoundingClientRect()
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
  }, [onSelection, resolvedRef])

  if (editable) {
    return (
      <div
        ref={resolvedRef}
        contentEditable
        suppressContentEditableWarning
        className="rounded-box border-2 border-primary/40 bg-base-100 p-8 font-serif text-xl leading-relaxed text-base-content shadow-sm outline-none focus:border-primary/70 min-h-96 cursor-text"
        onMouseUp={handleMouseUp}
        onInput={handleInput}
      />
    )
  }

  return (
    <div
      ref={resolvedRef}
      className="relative rounded-box border border-base-300 bg-base-100 p-8 font-serif text-xl leading-relaxed text-base-content shadow-sm"
      onMouseUp={handleMouseUp}
    >
      {displayText.split('\n').map((para, i) => (
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
  const { message: toastMessage, showToast } = useToast()

  const handleMarkRead = useCallback(() => {
    setMarkingRead(true)
    api.stories
      .addReading(storyId)
      .then((result) => {
        if (result.statusUpdated) setCurrentStatus('read')
        showToast('Прочитано!')
      })
      .catch((err) => {
        showToast(err instanceof Error ? err.message : 'Не удалось отметить как прочитанное')
      })
      .finally(() => setMarkingRead(false))
  }, [storyId, showToast])

  const [storyTags, setStoryTags] = useState<string[]>([])
  const [allTags, setAllTags] = useState<string[]>([])
  const [swapStage, setSwapStage] = useState<'plotter' | 'writer' | null>(null)
  const draftKey = `story-text-draft-${storyId}`
  const [isDirty, setIsDirty] = useState(() => !!localStorage.getItem(`story-text-draft-${storyId}`))
  const [savingText, setSavingText] = useState(false)
  const [saveTextError, setSaveTextError] = useState<string | null>(null)
  const editRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (story) {
      setCurrentStatus(story.status)
setStoryTags((story.tags as string[] | null) ?? [])
    }
  }, [story])

  useEffect(() => {
    api.stories.allTags().then(setAllTags).catch(() => undefined)
  }, [])

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
      localStorage.removeItem(draftKey)
      setIsDirty(false)
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

      {pipelineStatus === 'text_review' && (currentStatus ?? story.status) === 'draft' && (
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
            {((currentStatus ?? story.status) === 'ready' || (currentStatus ?? story.status) === 'read') && (
              <button
                className="btn btn-primary btn-sm"
                disabled={markingRead}
                onClick={handleMarkRead}
              >
                {markingRead ? '...' : (currentStatus ?? story.status) === 'read' ? 'Прочитать снова' : '✓ Прочитано'}
              </button>
            )}
          </div>
        }
      />

      <div className="mb-6 rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-base-content/50">Категории</p>
        <StoryTagEditor
          tags={storyTags}
          allTags={allTags}
          onSave={async (tags) => {
            const updated = await api.stories.updateTags(storyId, tags)
            setStoryTags((updated.tags as string[] | null) ?? [])
            showToast('Категории сохранены')
          }}
        />
      </div>

      {story.cost && story.cost.perStage.length > 0 && (
        <div className="mb-6 rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
          <div className="mb-2 flex items-baseline justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-base-content/50">Стоимость</p>
            <p className="text-sm">Итого: <span className="font-mono">${formatMicros(story.cost.totalUsdMicros, 5)}</span></p>
          </div>
          <table className="table table-xs">
            <thead>
              <tr>
                <th>Стадия</th>
                <th>Модель</th>
                <th className="text-right">In</th>
                <th className="text-right">Out</th>
                <th className="text-right">USD</th>
              </tr>
            </thead>
            <tbody>
              {story.cost.perStage.map((row, i) => {
                const swappable = (['plotter', 'writer'] as const).includes(
                  row.stage as 'plotter' | 'writer',
                )
                return (
                  <tr key={i}>
                    <td className="font-mono text-xs">
                      {row.stage}{row.attempt > 1 ? ` #${row.attempt}` : ''}
                      {swappable && (
                        <button
                          className="btn btn-ghost btn-xs ml-2"
                          title="Сменить модель и пере-запустить эту стадию"
                          onClick={() => setSwapStage(row.stage as 'plotter' | 'writer')}
                        >
                          ↻
                        </button>
                      )}
                    </td>
                    <td className="font-mono text-xs">{row.model}</td>
                    <td className="text-right font-mono">{row.tokensIn}</td>
                    <td className="text-right font-mono">{row.tokensOut}</td>
                    <td className="text-right font-mono">${formatMicros(row.usdMicros, 5)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="mt-3 text-right text-xs">
            <button
              className="link"
              onClick={() => navigate(`/admin#story-${storyId}`)}
            >
              Оценить, стоила ли история своих денег →
            </button>
          </div>
        </div>
      )}

      {swapStage && (
        <SwapModelModal
          open={true}
          storyId={storyId}
          stage={swapStage}
          currentModel={
            story.cost?.perStage.find((p) => p.stage === swapStage)?.model ?? null
          }
          onClose={() => setSwapStage(null)}
          onSubmitted={() => {
            setSwapStage(null)
            navigate(`/stories/${storyId}/pipeline`)
          }}
        />
      )}

      <div className="relative">
        {textToDisplay ? (
          <StoryText
            text={textToDisplay}
            editable
            draftKey={draftKey}
            editRef={editRef}
            onSelection={setSelection}
            onInput={() => setIsDirty(true)}
          />
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

      {isDirty && (
        <div className="mt-2 flex items-center justify-end gap-2">
          {saveTextError && <span className="text-xs text-error">{saveTextError}</span>}
          <button
            className="btn btn-xs btn-ghost"
            disabled={savingText}
            onClick={() => {
              localStorage.removeItem(draftKey)
              if (editRef.current && textToDisplay) editRef.current.innerText = stripLeadingTitle(textToDisplay)
              setIsDirty(false)
              setSaveTextError(null)
            }}
          >
            Отмена
          </button>
          <button className="btn btn-xs btn-primary" disabled={savingText} onClick={() => void handleSaveText()}>
            {savingText ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </div>
      )}

      {annotationError && (
        <div className="mt-4">
          <StatusCallout tone="error" title="Ошибка сохранения заметки" message={annotationError} />
        </div>
      )}

      {pipelineStatus === 'text_review' && (currentStatus ?? story.status) === 'draft' && (
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


      {((currentStatus ?? story.status) === 'ready' || (currentStatus ?? story.status) === 'read') && (
        <div className="mt-10 flex justify-center">
          <button
            className="btn btn-primary"
            disabled={markingRead}
            onClick={handleMarkRead}
          >
            {markingRead ? '...' : (currentStatus ?? story.status) === 'read' ? 'Прочитать снова' : '✓ Прочитано'}
          </button>
        </div>
      )}

      {story.status !== 'draft' && (
        <section className="mt-12 space-y-6">
          <PageHeader
            eyebrow="Отзыв"
            title="Впечатления от чтения"
            description="Запиши впечатления — родительские и Сашины."
          />

          <div className="card border border-base-300 bg-base-200 shadow-sm">
            <div className="card-body gap-4">
              <h3 className="font-serif text-xl text-base-content">Впечатления родителя</h3>
              <p className="text-sm text-base-content/60">Критический взгляд — качество, темп, стоит ли повторять.</p>
              <ParentReviewForm storyId={storyId} />
            </div>
          </div>

          <div className="card border border-base-300 bg-base-200 shadow-sm">
            <div className="card-body gap-4">
              <h3 className="font-serif text-xl text-base-content">Реакции Саши</h3>
              <p className="text-sm text-base-content/60">Что понравилось, что запомнилось, как Саша реагировал.</p>
              <ChildReactionForm storyId={storyId} />
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
