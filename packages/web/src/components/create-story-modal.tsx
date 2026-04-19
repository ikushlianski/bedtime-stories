import { useState, useEffect } from 'react'
import { api, type CreateStoryInput, type StoryGroup } from '../lib/api'
import {
  validateCreateStoryForm,
  type CreateStoryFormState,
} from './create-story-form'

interface CreateStoryModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (input: CreateStoryInput) => Promise<void>
  initialSeed?: string
  initialGroupId?: number | null
}

const LAST_UNIVERSE_KEY = 'create-story-last-universe-id'

function loadLastUniverseId(): number | null {
  try {
    const raw = localStorage.getItem(LAST_UNIVERSE_KEY)
    return raw ? Number(raw) : null
  } catch {
    return null
  }
}

function saveLastUniverseId(id: number | null) {
  try {
    if (id === null) {
      localStorage.removeItem(LAST_UNIVERSE_KEY)
    } else {
      localStorage.setItem(LAST_UNIVERSE_KEY, String(id))
    }
  } catch {
  }
}

function CreateStoryModal({ open, onClose, onSubmit, initialSeed = '', initialGroupId = null }: CreateStoryModalProps) {
  const [form, setForm] = useState<CreateStoryFormState>({
    seed: initialSeed,
    groupId: initialGroupId ?? loadLastUniverseId(),
    pipelineMode: 'auto',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [universes, setUniverses] = useState<StoryGroup[]>([])
  const [showCreateUniverse, setShowCreateUniverse] = useState(false)
  const [newUniverseName, setNewUniverseName] = useState('')
  const [creatingUniverse, setCreatingUniverse] = useState(false)

  useEffect(() => {
    if (open) {
      setForm({
        seed: initialSeed,
        groupId: initialGroupId ?? loadLastUniverseId(),
        pipelineMode: 'auto',
      })
      setError(null)
      setShowCreateUniverse(false)
      setNewUniverseName('')

      api.universes.list().then((list) => {
        setUniverses(list)

        if (list.length === 0) {
          setShowCreateUniverse(true)
        }
      }).catch(() => setUniverses([]))
    }
  }, [open, initialSeed, initialGroupId])

  if (!open) {
    return null
  }

  async function handleSubmit() {
    const validation = validateCreateStoryForm(form)

    if (!validation.valid) {
      setError(validation.reason)
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      await onSubmit(validation.input)
      setForm({ seed: '', groupId: null, pipelineMode: 'auto' })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось создать историю')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCreateUniverse() {
    const name = newUniverseName.trim()

    if (!name) return

    setCreatingUniverse(true)

    try {
      const created = await api.universes.create({ name, systemPrompt: '.' })

      setUniverses((prev) => [...prev, created])
      saveLastUniverseId(created.id)
      setForm((prev) => ({ ...prev, groupId: created.id }))
      setShowCreateUniverse(false)
      setNewUniverseName('')
    } catch {
      setError('Не удалось создать вселенную')
    } finally {
      setCreatingUniverse(false)
    }
  }

  const canSubmit = !submitting && validateCreateStoryForm(form).valid

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-2xl border border-base-300 bg-base-100 shadow-2xl">
        <h2 className="font-serif text-3xl text-base-content">Новая история</h2>

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <label className="label">
              <span className="label-text text-sm text-base-content/60">Вселенная</span>
            </label>
            {!showCreateUniverse && (
              <button
                type="button"
                className="btn btn-ghost btn-xs text-primary"
                onClick={() => setShowCreateUniverse(true)}
              >
                + Новая вселенная
              </button>
            )}
          </div>

          {showCreateUniverse ? (
            <div className="flex gap-2">
              <input
                type="text"
                className="input input-bordered flex-1 bg-base-100"
                placeholder="Название вселенной..."
                value={newUniverseName}
                onChange={(e) => setNewUniverseName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleCreateUniverse()
                  if (e.key === 'Escape') {
                    setShowCreateUniverse(false)
                    setNewUniverseName('')
                  }
                }}
                autoFocus
              />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!newUniverseName.trim() || creatingUniverse}
                onClick={() => void handleCreateUniverse()}
              >
                {creatingUniverse ? '...' : 'Создать'}
              </button>
              {universes.length > 0 && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setShowCreateUniverse(false)
                    setNewUniverseName('')
                  }}
                >
                  Отмена
                </button>
              )}
            </div>
          ) : (
            <select
              className="select select-bordered w-full bg-base-100"
              value={form.groupId ?? ''}
              onChange={(event) => {
                const value = event.target.value
                const groupId = value === '' ? null : parseInt(value, 10)

                saveLastUniverseId(groupId)
                setForm((prev) => ({ ...prev, groupId }))
              }}
            >
              <option value="" disabled>Выбери вселенную...</option>
              {universes.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="mt-4">
          <p className="text-sm text-base-content/60">
            Задай затравку для следующей сказки — ситуацию, эмоцию или испытание, которое сейчас актуально для Саши.
          </p>
          <textarea
            className="textarea textarea-bordered mt-4 min-h-40 w-full bg-base-100"
            placeholder="Герой нервничает: первый раз ночевать не дома..."
            value={form.seed}
            onChange={(event) => setForm((prev) => ({ ...prev, seed: event.target.value }))}
            autoFocus
          />
          <div className="mt-4">
            <label className="label pb-1">
              <span className="label-text text-sm text-base-content/60">Режим конвейера</span>
            </label>
            <div className="flex gap-4">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="pipelineMode"
                  className="radio radio-sm"
                  checked={form.pipelineMode === 'auto'}
                  onChange={() => setForm((prev) => ({ ...prev, pipelineMode: 'auto' }))}
                />
                <span className="text-sm">Авто</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="pipelineMode"
                  className="radio radio-sm"
                  checked={form.pipelineMode === 'manual'}
                  onChange={() => setForm((prev) => ({ ...prev, pipelineMode: 'manual' }))}
                />
                <span className="text-sm">Ручной</span>
              </label>
            </div>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-error">{error}</p>}

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose}>
            Отмена
          </button>
          <button
            className={`btn btn-primary ${canSubmit ? '' : 'btn-disabled'}`}
            onClick={() => void handleSubmit()}
          >
            {submitting ? 'Создаём...' : 'Создать историю'}
          </button>
        </div>
      </div>
      <button className="modal-backdrop" onClick={onClose}>
        закрыть
      </button>
    </dialog>
  )
}

export default CreateStoryModal
