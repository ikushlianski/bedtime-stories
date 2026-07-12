import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, type Story, type Annotation } from '../lib/api'
import { PageHeader, StatusCallout } from '../components'

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

function TextAnnotationPanel({ storyId, text, onCritiqueStarted }: { storyId: number; text: string; onCritiqueStarted: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [popover, setPopover] = useState<SelectionPopover | null>(null)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)
  const [critiquing, setCritiquing] = useState(false)
  const [critiqueError, setCritiqueError] = useState<string | null>(null)

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
    if (!popover || !comment.trim()) return

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

  const handleCritique = async () => {
    setCritiquing(true)
    setCritiqueError(null)

    try {
      await api.stories.critiqueText(storyId)
      onCritiqueStarted()
    } catch (err) {
      setCritiqueError(err instanceof Error ? err.message : 'Не удалось запустить критика')
      setCritiquing(false)
    }
  }

  const hasAnnotations = annotations.length > 0

  return (
    <div className="space-y-4">
      {hasAnnotations && (
        <div className="flex justify-end">
          <button
            className="btn btn-sm btn-outline"
            onClick={() => void handleCritique()}
            disabled={critiquing}
          >
            {critiquing ? 'Запускаем...' : 'Запустить критика с учётом комментариев'}
          </button>
        </div>
      )}

      <div className="relative" ref={containerRef} onMouseUp={handleMouseUp}>
        <div className="select-text cursor-text leading-relaxed text-base-content">
          {text.split('\n').map((line, i) => (
            <p key={i} className={line.trim() === '' ? 'mb-4' : 'mb-1'}>
              {line || '\u00A0'}
            </p>
          ))}
        </div>

        {popover && (
          <div
            className="absolute z-20 w-72"
            style={{ left: popover.x, top: popover.y, transform: 'translate(-50%, -100%)' }}
          >
            <div className="rounded-box border border-base-300 bg-base-100 p-3 shadow-xl">
              <p className="mb-2 line-clamp-2 text-xs italic text-base-content/50">&ldquo;{popover.text}&rdquo;</p>

              <textarea
                autoFocus
                className="textarea textarea-bordered w-full text-sm"
                rows={2}
                placeholder="Твой комментарий..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void handleSave()
                  if (e.key === 'Escape') handleDismiss()
                }}
              />

              {saveError && <p className="mt-1 text-xs text-error">{saveError}</p>}

              <div className="mt-2 flex justify-end gap-2">
                <button className="btn btn-ghost btn-xs" onClick={handleDismiss}>Отмена</button>
                <button
                  className="btn btn-primary btn-xs"
                  onClick={() => void handleSave()}
                  disabled={!comment.trim() || saving}
                >
                  {saving ? '...' : 'Сохранить'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {hasAnnotations && (
        <div className="space-y-4">
          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-base-content/60">Заметки к тексту</h3>
            <ul className="space-y-3">
              {annotations.map((a) => (
                <li key={a.id} className="rounded-box border border-base-300 bg-base-200/50 p-4">
                  <p className="mb-1 text-xs italic text-base-content/50">&ldquo;{a.selectedText}&rdquo;</p>
                  <p className="text-sm text-base-content">{a.noteText}</p>
                </li>
              ))}
            </ul>
          </section>

          {critiqueError && (
            <StatusCallout tone="error" title="Ошибка запуска критика" message={critiqueError} />
          )}

          <div className="flex justify-end">
            <button
              className="btn btn-outline"
              onClick={() => void handleCritique()}
              disabled={critiquing}
            >
              {critiquing ? 'Запускаем...' : 'Запустить критика с учётом комментариев'}
            </button>
          </div>
        </div>
      )}

      {!hasAnnotations && (
        <div className="flex justify-end">
          <button
            className="btn btn-outline"
            onClick={() => void handleCritique()}
            disabled={critiquing}
          >
            {critiquing ? 'Запускаем...' : 'Запустить критика'}
          </button>
        </div>
      )}
    </div>
  )
}

export function TextReviewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const storyId = Number(id)
  const { story, loading, error } = useTextReviewStory(storyId)
  const [approving, setApproving] = useState(false)
  const [approveError, setApproveError] = useState<string | null>(null)
  const [redoing, setRedoing] = useState(false)
  const [redoError, setRedoError] = useState<string | null>(null)
  const [redoInstructions, setRedoInstructions] = useState('')

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
      await api.stories.redoText(storyId, redoInstructions)
      navigate(`/stories/${storyId}/pipeline`)
    } catch (redoErr) {
      setRedoError(redoErr instanceof Error ? redoErr.message : 'Не удалось запустить доработку')
      setRedoing(false)
    }
  }

  const handleCritiqueStarted = useCallback(() => {
    navigate(`/stories/${storyId}/pipeline`)
  }, [navigate, storyId])

  if (loading) {
    return <StatusCallout title="Загрузка" message="Получаем данные для проверки текста." />
  }

  if (error) {
    return <StatusCallout tone="error" title="Ошибка загрузки истории" message={error} />
  }

  if (!story) {
    return <StatusCallout tone="warning" title="История не найдена" message="Запрошенная история не существует." />
  }

  const textToReview = story.text_v2 ?? story.text_v1 ?? ''

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

      <section className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-3xl text-base-content">Текст истории</h2>

            <div className="flex gap-2">
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
              value={redoInstructions}
              onChange={(e) => setRedoInstructions(e.target.value)}
            />
            <p className="mt-1 text-xs text-base-content/50">
              Нажми «Отправить на доработку», чтобы переписать текст с учётом этих указаний.
            </p>
          </div>

          <TextAnnotationPanel
            storyId={storyId}
            text={textToReview}
            onCritiqueStarted={handleCritiqueStarted}
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
    </div>
  )
}
