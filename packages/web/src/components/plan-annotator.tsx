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
  onChatAboutThis?: (selectedText: string) => void
}

function ModelOverrideInput({ model, onChange }: { model: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false)

  return (
    <details className="text-xs text-base-content/60" onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer select-none">Другая модель (необязательно)</summary>
      {open && (
        <input
          type="text"
          className="input input-bordered input-xs mt-2 w-full max-w-xs"
          placeholder="например, anthropic/claude-sonnet-4"
          value={model}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </details>
  )
}

function RedoPlanButton({ storyId, disabled, reason, model }: { storyId: number; disabled: boolean; reason: string; model: string }) {
  const navigate = useNavigate()
  const [redoing, setRedoing] = useState(false)
  const [redoError, setRedoError] = useState<string | null>(null)

  const handleRedo = async () => {
    setRedoing(true)
    setRedoError(null)

    try {
      await api.stories.redoPlan(storyId, reason, model)
      navigate(`/stories/${storyId}/pipeline`)
    } catch (err) {
      setRedoError(err instanceof Error ? err.message : 'Не удалось запустить доработку')
      setRedoing(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {redoError && <p className="text-xs text-error">{redoError}</p>}
      <button
        className="btn btn-sm btn-outline"
        onClick={() => void handleRedo()}
        disabled={disabled || redoing}
      >
        {redoing ? 'Запускаем...' : 'Переделать с учётом комментариев'}
      </button>
    </div>
  )
}

function ResolvedAnnotations({ annotations }: { annotations: Annotation[] }) {
  const [expanded, setExpanded] = useState(false)

  if (annotations.length === 0) return null

  return (
    <div className="rounded-box border border-base-300 bg-base-200/30">
      <button
        className="flex w-full items-center justify-between px-4 py-3 text-sm text-base-content/50 hover:text-base-content/70"
        onClick={() => setExpanded((v) => !v)}
      >
        <span>Учтённые комментарии ({annotations.length})</span>
        <span>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <ul className="space-y-3 px-4 pb-4">
          {annotations.map((a) => (
            <li key={a.id} className="rounded-box border border-base-300/50 bg-base-100/50 p-3 opacity-50">
              <p className="mb-1 text-xs italic text-base-content/40">&ldquo;{a.selectedText}&rdquo;</p>
              <p className="text-sm text-base-content/60">{a.noteText}</p>
              {a.resolvedSummary && (
                <p className="mt-2 border-t border-base-300/30 pt-2 text-xs text-base-content/40">
                  ✓ {a.resolvedSummary}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function PlanAnnotator({ storyId, planText, onChatAboutThis }: PlanAnnotatorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [popover, setPopover] = useState<SelectionPopover | null>(null)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [allAnnotations, setAllAnnotations] = useState<Annotation[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)
  const [redoReason, setRedoReason] = useState('')
  const [redoModel, setRedoModel] = useState('')

  useEffect(() => {
    api.annotations.list(storyId, 'plan').then(setAllAnnotations).catch(() => undefined)
  }, [storyId])

  const activeAnnotations = allAnnotations.filter((a) => a.resolvedAt === null)
  const resolvedAnnotations = allAnnotations.filter((a) => a.resolvedAt !== null)

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

      setAllAnnotations((prev) => [...prev, created])
      handleDismiss()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Не удалось сохранить')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-box border border-primary/20 bg-primary/5 p-4">
        <label className="mb-2 block text-sm font-medium text-base-content">Что изменить в плане?</label>
        <textarea
          className="textarea textarea-bordered min-h-20 w-full bg-base-100 text-sm"
          placeholder="Необязательно: общие указания к переработке плана — их получит Сюжетник при следующем прогоне."
          value={redoReason}
          onChange={(e) => setRedoReason(e.target.value)}
        />
        <div className="mt-2">
          <ModelOverrideInput model={redoModel} onChange={setRedoModel} />
        </div>
        <div className="mt-3 flex justify-end">
          <RedoPlanButton storyId={storyId} disabled={false} reason={redoReason} model={redoModel} />
        </div>
      </div>

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

              <div className="mt-2 flex justify-between gap-2">
                <button className="btn btn-ghost btn-xs" onClick={handleDismiss}>
                  Отмена
                </button>
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
          </div>
        )}
      </div>

      {activeAnnotations.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-base-content/60">
            Заметки к плану
          </h3>
          <ul className="space-y-3">
            {activeAnnotations.map((a) => (
              <li key={a.id} className="rounded-box border border-base-300 bg-base-200/50 p-4">
                {a.selectedText && <p className="mb-1 text-xs italic text-base-content/50">&ldquo;{a.selectedText}&rdquo;</p>}
                <p className="text-sm text-base-content">{a.noteText}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ResolvedAnnotations annotations={resolvedAnnotations} />
    </div>
  )
}

export default PlanAnnotator
