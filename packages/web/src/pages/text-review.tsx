import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, type Story, type Annotation } from '../lib/api'
import { PageHeader, StatusCallout } from '../components'
import { StoryChatPanel } from './story-chat-panel'
import { TextVersionHistory } from '../components/text-version-history'
import { splitTextIntoLines } from './text-blocks'
import {
  NOTE_TEXT_MAX_LENGTH,
  isSelectionWithinLimit,
  isNoteTextWithinLimit,
  SELECTION_TOO_LONG_MESSAGE,
} from '../components/annotation-limits'

function useTextReviewStory(id: number) {
  const [story, setStory] = useState<Story | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    setLoading(true)
    setError(null)

    api.stories
      .get(id)
      .then(setStory)
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить историю'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    reload()
  }, [reload])

  return { story, loading, error, reload }
}

interface SelectionPopover {
  text: string
  x: number
  y: number
  start: number
  end: number
}

function TextAnnotationPanel({ storyId, text, onChatAboutThis }: { storyId: number; text: string; onChatAboutThis?: (selectedText: string, lineIndex?: number) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [popover, setPopover] = useState<SelectionPopover | null>(null)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    api.annotations.list(storyId, 'text').then(setAnnotations).catch(() => undefined)
  }, [storyId])

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection()

    if (!selection || selection.isCollapsed || !containerRef.current) return

    const selectedText = selection.toString().trim()

    if (!selectedText) return

    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    const containerRect = containerRef.current.getBoundingClientRect()

    setPopover({
      text: selectedText,
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top - 8,
      start: range.startOffset,
      end: range.endOffset,
    })

    setComment('')
    setSaveError(null)
  }, [])

  const handleDismiss = useCallback(() => {
    setPopover(null)
    setComment('')
    window.getSelection()?.removeAllRanges()
  }, [])

  const handleSave = async () => {
    if (!popover || !comment.trim() || !isNoteTextWithinLimit(comment)) return

    setSaving(true)
    setSaveError(null)

    try {
      const created = await api.annotations.create(storyId, {
        type: 'my_note',
        selectedText: popover.text,
        noteText: comment.trim(),
        positionStart: popover.start,
        positionEnd: popover.end,
        context: 'text',
      })

      setAnnotations((prev) => [...prev, created])
      handleDismiss()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Не удалось сохранить')
    } finally {
      setSaving(false)
    }
  }

  const hasAnnotations = annotations.length > 0

  return (
    <div className="space-y-4">
      {onChatAboutThis && (
        <p className="text-xs text-base-content/50">
          Нажми ✎ у любого абзаца, чтобы переписать только его.
        </p>
      )}

      <div className="relative" ref={containerRef} onMouseUp={handleMouseUp}>
        <div className="select-text cursor-text text-base leading-relaxed text-base-content lg:text-sm">
          {splitTextIntoLines(text).map((line) =>
            line.isBlock ? (
              <div key={line.index} className="mb-1 flex items-start gap-2">
                <p className="flex-1">{line.text}</p>
                {onChatAboutThis && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs shrink-0 select-none"
                    title="Переписать этот абзац"
                    data-testid={`rewrite-block-${line.index}`}
                    onMouseUp={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation()
                      window.getSelection()?.removeAllRanges()
                      onChatAboutThis(line.text, line.index)
                    }}
                  >
                    ✎
                  </button>
                )}
              </div>
            ) : (
              <p key={line.index} className="mb-4">
                {line.text || '\u00A0'}
              </p>
            ),
          )}
        </div>

        {popover && (
          <div
            className="absolute z-20 w-72"
            style={{ left: popover.x, top: popover.y, transform: 'translate(-50%, -100%)' }}
          >
            <div className="rounded-box border border-base-300 bg-base-100 p-3 shadow-xl">
              <p className="mb-2 line-clamp-2 text-xs italic text-base-content/50">&ldquo;{popover.text}&rdquo;</p>

              {!isSelectionWithinLimit(popover.text) ? (
                <p className="text-xs text-base-content/70">{SELECTION_TOO_LONG_MESSAGE}</p>
              ) : (
                <>
                  <textarea
                    autoFocus
                    className="textarea textarea-bordered w-full text-sm"
                    rows={2}
                    placeholder="Твой комментарий..."
                    value={comment}
                    maxLength={NOTE_TEXT_MAX_LENGTH}
                    onChange={(e) => setComment(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void handleSave()
                      if (e.key === 'Escape') handleDismiss()
                    }}
                  />

                  <p className="mt-1 text-right text-xs text-base-content/50">
                    {comment.length}/{NOTE_TEXT_MAX_LENGTH}
                  </p>
                </>
              )}

              {saveError && <p className="mt-1 text-xs text-error">{saveError}</p>}

              <div className="mt-2 flex justify-between gap-2">
                <button className="btn btn-ghost btn-xs" onClick={handleDismiss}>Отмена</button>
                <div className="flex gap-2">
                  {onChatAboutThis && (
                    <button
                      className="btn btn-secondary btn-xs"
                      onClick={() => {
                        onChatAboutThis(popover.text)
                        handleDismiss()
                      }}
                    >
                      Обсудить →
                    </button>
                  )}
                  {isSelectionWithinLimit(popover.text) && (
                    <button
                      className="btn btn-primary btn-xs"
                      onClick={() => void handleSave()}
                      disabled={!comment.trim() || !isNoteTextWithinLimit(comment) || saving}
                    >
                      {saving ? '...' : 'Сохранить'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {hasAnnotations && (
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-base-content/60">Заметки к тексту</h3>
          <ul className="space-y-3">
            {annotations.map((a) => (
              <li key={a.id} className="rounded-box border border-base-300 bg-base-200/50 p-4">
                {a.selectedText && <p className="mb-1 text-xs italic text-base-content/50">&ldquo;{a.selectedText}&rdquo;</p>}
                <p className="text-sm text-base-content">{a.noteText}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

export function TextReviewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const storyId = Number(id)
  const { story, loading, error, reload } = useTextReviewStory(storyId)
  const [approving, setApproving] = useState(false)
  const [approveError, setApproveError] = useState<string | null>(null)
  const [redoing, setRedoing] = useState(false)
  const [redoError, setRedoError] = useState<string | null>(null)
  const [redoReason, setRedoReason] = useState('')
  const [redoModel, setRedoModel] = useState('')
  const [showModelInput, setShowModelInput] = useState(false)
  const [chatSelection, setChatSelection] = useState<{ text: string; lineIndex?: number } | null>(null)
  const [localText, setLocalText] = useState<string | null>(null)

  const handleApprove = async () => {
    setApproving(true)
    setApproveError(null)

    try {
      await api.stories.approveText(storyId)
      navigate(`/stories/${storyId}`)
    } catch (approvalError) {
      setApproveError(approvalError instanceof Error ? approvalError.message : 'Не удалось одобрить текст')
    } finally {
      setApproving(false)
    }
  }

  const handleRedo = async () => {
    setRedoing(true)
    setRedoError(null)

    try {
      await api.stories.redoText(storyId, redoReason, redoModel)
      navigate(`/stories/${storyId}/pipeline`)
    } catch (redoErr) {
      setRedoError(redoErr instanceof Error ? redoErr.message : 'Не удалось запустить доработку')
      setRedoing(false)
    }
  }

  if (loading) {
    return <StatusCallout title="Загрузка" message="Получаем данные для проверки текста." />
  }

  if (error) {
    return <StatusCallout tone="error" title="Ошибка загрузки истории" message={error} />
  }

  if (!story) {
    return <StatusCallout tone="warning" title="История не найдена" message="Запрошенная история не существует." />
  }

  const textToReview = localText ?? story.active_text ?? story.text_v2 ?? story.text_v1 ?? ''

  return (
    <div>
      <PageHeader
        eyebrow="На вычитке"
        title="Вычитка текста"
        description="Прочитай текст, оставь комментарии и одобри для Саши — или отправь на доработку."
        backAction={
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
            ← К историям
          </button>
        }
      />

      {story.text_change_summary && (
        <div className="mb-4 rounded-box border border-info/30 bg-info/10 p-4">
          <p className="mb-1 text-sm font-semibold text-info-content">Что изменилось</p>
          <p className="text-sm text-base-content">{story.text_change_summary}</p>
        </div>
      )}

      {(approveError || redoError) && (
        <div className="mb-4">
          <StatusCallout tone="error" title="Ошибка" message={approveError ?? redoError ?? ''} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <section className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body gap-6 lg:gap-4 lg:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-serif text-3xl text-base-content">Текст истории</h2>

              <div className="flex flex-wrap gap-2">
                <button className="btn btn-outline btn-sm" onClick={() => void handleRedo()} disabled={redoing || approving}>
                  {redoing ? 'Запускаем...' : 'Отправить на доработку'}
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => void handleApprove()} disabled={approving || redoing}>
                  {approving ? 'Сохраняем…' : 'Готово для Саши'}
                </button>
              </div>
            </div>

            <p className="text-sm text-base-content/60">
              Выдели любой фрагмент текста, чтобы оставить точечный комментарий. Или напиши общие указания к доработке ниже — они попадут прямо к писателю.
            </p>

            <div className="rounded-box border border-primary/20 bg-primary/5 p-4">
              <label className="mb-2 block text-sm font-medium text-base-content">
                Что изменить в этой версии?
              </label>
              <textarea
                className="textarea textarea-bordered min-h-24 w-full bg-base-100 text-sm"
                placeholder="Например: вплети в историю строчки этой песни… (можно вставить целиком). Эти указания получит писатель при следующем прогоне."
                value={redoReason}
                onChange={(e) => setRedoReason(e.target.value)}
              />
              <p className="mt-1 text-xs text-base-content/50">
                Нажми «Отправить на доработку», чтобы переписать текст с учётом этих указаний.
              </p>

              <details
                className="mt-2 text-xs text-base-content/60"
                onToggle={(e) => setShowModelInput((e.target as HTMLDetailsElement).open)}
              >
                <summary className="cursor-pointer select-none">Другая модель (необязательно)</summary>
                {showModelInput && (
                  <input
                    type="text"
                    className="input input-bordered input-xs mt-2 w-full max-w-xs"
                    placeholder="например, anthropic/claude-sonnet-4"
                    value={redoModel}
                    onChange={(e) => setRedoModel(e.target.value)}
                  />
                )}
              </details>
            </div>

            <TextVersionHistory
              storyId={storyId}
              activeVersionId={story.active_text_version_id}
              onRestored={() => {
                setLocalText(null)
                reload()
              }}
            />

            <TextAnnotationPanel
              storyId={storyId}
              text={textToReview}
              onChatAboutThis={(text, lineIndex) => setChatSelection({ text, lineIndex })}
            />

            <div className="flex flex-wrap justify-end gap-2 border-t border-base-300 pt-4">
              <button className="btn btn-outline btn-sm" onClick={() => void handleRedo()} disabled={redoing || approving}>
                {redoing ? 'Запускаем...' : 'Отправить на доработку'}
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => void handleApprove()} disabled={approving || redoing}>
                {approving ? 'Сохраняем…' : 'Готово для Саши'}
              </button>
            </div>
          </div>
        </section>

        <div className="lg:sticky lg:top-4">
          <StoryChatPanel
            storyId={storyId}
            context="text"
            selectedText={chatSelection?.text}
            selectedTextLineIndex={chatSelection?.lineIndex}
            onPatchApplied={() => {
              setLocalText(null)
              setChatSelection(null)
              reload()
            }}
            onClose={chatSelection ? () => setChatSelection(null) : undefined}
          />
        </div>
      </div>
    </div>
  )
}
