import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Annotation } from '../lib/api'

interface SelectionPopover {
  text: string
  x: number
  y: number
  start: number
  end: number
}

interface PlanAnnotatorProps {
  storyId: number
  planText: string
}

function RedoPlanButton({ storyId, disabled }: { storyId: number; disabled: boolean }) {
  const navigate = useNavigate()
  const [redoing, setRedoing] = useState(false)

  const handleRedo = async () => {
    setRedoing(true)

    try {
      await api.annotations.redoPlan(storyId)
      navigate(`/stories/${storyId}/pipeline`)
    } catch {
      setRedoing(false)
    }
  }

  return (
    <button
      className="btn btn-sm btn-outline"
      onClick={() => void handleRedo()}
      disabled={disabled || redoing}
    >
      {redoing ? 'Запускаем...' : 'Переделать с учётом комментариев'}
    </button>
  )
}

function PlanAnnotator({ storyId, planText }: PlanAnnotatorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [popover, setPopover] = useState<SelectionPopover | null>(null)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    api.annotations.list(storyId, 'plan').then(setAnnotations).catch(() => undefined)
  }, [storyId])

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection()

    if (!selection || selection.isCollapsed || !containerRef.current) {
      return
    }

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
        context: 'plan',
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
      {hasAnnotations && (
        <div className="flex justify-end">
          <RedoPlanButton storyId={storyId} disabled={false} />
        </div>
      )}

      <div className="relative" ref={containerRef} onMouseUp={handleMouseUp}>
        <div className="select-text cursor-text leading-relaxed text-base-content">
          {planText.split('\n').map((line, i) => (
            <p key={i} className={line.trim() === '' ? 'mb-4' : 'mb-1'}>
              {line || '\u00A0'}
            </p>
          ))}
        </div>

        {popover && (
          <div
            className="absolute z-20 w-72"
            style={{
              left: popover.x,
              top: popover.y,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="rounded-box border border-base-300 bg-base-100 p-3 shadow-xl">
              <p className="mb-2 line-clamp-2 text-xs italic text-base-content/50">
                &ldquo;{popover.text}&rdquo;
              </p>

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
                <button className="btn btn-ghost btn-xs" onClick={handleDismiss}>
                  Отмена
                </button>
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
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-base-content/60">
              Заметки к плану
            </h3>
            <ul className="space-y-3">
              {annotations.map((a) => (
                <li key={a.id} className="rounded-box border border-base-300 bg-base-200/50 p-4">
                  <p className="mb-1 text-xs italic text-base-content/50">&ldquo;{a.selectedText}&rdquo;</p>
                  <p className="text-sm text-base-content">{a.noteText}</p>
                </li>
              ))}
            </ul>
          </section>

          <div className="flex justify-end">
            <RedoPlanButton storyId={storyId} disabled={false} />
          </div>
        </div>
      )}
    </div>
  )
}

export default PlanAnnotator
