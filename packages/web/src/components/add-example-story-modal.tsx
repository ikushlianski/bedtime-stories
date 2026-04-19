import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type StoryGroup } from '../lib/api'

interface AddExampleStoryModalProps {
  open: boolean
  onClose: () => void
}

function AddExampleStoryModal({ open, onClose }: AddExampleStoryModalProps) {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [textFinal, setTextFinal] = useState('')
  const [groupId, setGroupId] = useState<number | null>(null)
  const [analyzeAfterCreate, setAnalyzeAfterCreate] = useState(true)
  const [addToReadingList, setAddToReadingList] = useState(false)
  const [universes, setUniverses] = useState<StoryGroup[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    api.universes.list().then(setUniverses).catch(() => undefined)
  }, [open])

  function handleClose() {
    setTitle('')
    setTextFinal('')
    setGroupId(null)
    setAnalyzeAfterCreate(true)
    setAddToReadingList(false)
    setError(null)
    onClose()
  }

  async function handleSubmit() {
    if (!textFinal.trim()) {
      setError('Текст истории обязателен')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const created = await api.stories.create({
        title: title.trim() || undefined,
        textFinal: textFinal.trim(),
        source: 'legacy',
        addToReadingList,
        ...(groupId !== null ? { groupId } : {}),
      })

      if (analyzeAfterCreate) {
        await api.stories.analyze(created.id)
      }

      handleClose()
      navigate(`/stories/${created.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить историю')
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-2xl">
        <h3 className="mb-4 text-lg font-bold">Добавить примерную историю</h3>
        <p className="mb-4 text-sm text-base-content/60">
          Вставьте историю, написанную вручную. Можно добавить аннотации прямо в тексте в скобках,
          например <span className="font-mono text-xs">(Гоша засмеялся)</span> — ИИ учтёт их при анализе.
        </p>

        <div className="flex flex-col gap-3">
          <input
            type="text"
            className="input input-bordered bg-base-100"
            placeholder="Название (необязательно)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={submitting}
          />

          <textarea
            className="textarea textarea-bordered min-h-64 bg-base-100"
            placeholder="Текст истории..."
            value={textFinal}
            onChange={(e) => setTextFinal(e.target.value)}
            disabled={submitting}
          />

          {universes.length > 0 && (
            <select
              className="select select-bordered bg-base-100"
              value={groupId ?? ''}
              onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : null)}
              disabled={submitting}
            >
              <option value="">Без вселенной</option>
              {universes.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          )}

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={analyzeAfterCreate}
              onChange={(e) => setAnalyzeAfterCreate(e.target.checked)}
              disabled={submitting}
            />
            Проанализировать с ИИ сразу после добавления
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={addToReadingList}
              onChange={(e) => setAddToReadingList(e.target.checked)}
              disabled={submitting}
            />
            Добавить в список для чтения
          </label>

          {error && <p className="text-sm text-error">{error}</p>}

          <div className="modal-action mt-2">
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleClose}
              disabled={submitting}
            >
              Отмена
            </button>
            <button
              className={`btn btn-primary btn-sm ${submitting ? 'loading' : ''}`}
              onClick={() => void handleSubmit()}
              disabled={submitting}
            >
              {submitting
                ? analyzeAfterCreate
                  ? 'Сохраняем и анализируем...'
                  : 'Сохраняем...'
                : 'Добавить'}
            </button>
          </div>
        </div>
      </div>
      <div className="modal-backdrop" onClick={handleClose} />
    </dialog>
  )
}

export { AddExampleStoryModal }
