import { useState, useEffect } from 'react'
import { api, type CreateStoryInput, type StoryGroup } from '../lib/api'
import {
  INITIAL_CREATE_STORY_FORM,
  validateCreateStoryForm,
  type CreateStoryFormState,
  type CreateStoryMode,
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
    /* ignore */
  }
}

function CreateStoryModal({ open, onClose, onSubmit, initialSeed = '', initialGroupId = null }: CreateStoryModalProps) {
  const [form, setForm] = useState<CreateStoryFormState>({
    ...INITIAL_CREATE_STORY_FORM,
    seed: initialSeed,
    groupId: initialGroupId ?? loadLastUniverseId(),
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [universes, setUniverses] = useState<StoryGroup[]>([])

  useEffect(() => {
    if (open) {
      setForm({
        ...INITIAL_CREATE_STORY_FORM,
        seed: initialSeed,
        groupId: initialGroupId ?? loadLastUniverseId(),
      })
      setError(null)

      api.universes.list().then(setUniverses).catch(() => setUniverses([]))
    }
  }, [open, initialSeed, initialGroupId])

  if (!open) {
    return null
  }

  function setMode(mode: CreateStoryMode) {
    setForm((prev) => ({ ...prev, mode }))
    setError(null)
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
      setForm({ ...INITIAL_CREATE_STORY_FORM })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось создать историю')
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = !submitting && validateCreateStoryForm(form).valid

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-2xl border border-base-300 bg-base-100 shadow-2xl">
        <h2 className="font-serif text-3xl text-base-content">Новая история</h2>

        <div role="tablist" className="tabs tabs-boxed mt-4 gap-2">
          <button
            role="tab"
            className={`tab ${form.mode === 'generate' ? 'tab-active' : ''}`}
            onClick={() => setMode('generate')}
          >
            Сгенерировать с ИИ
          </button>
          <button
            role="tab"
            className={`tab ${form.mode === 'paste' ? 'tab-active' : ''}`}
            onClick={() => setMode('paste')}
          >
            Вставить готовую историю
          </button>
        </div>

        <div className="mt-4">
          <label className="label">
            <span className="label-text text-sm text-base-content/60">Вселенная (необязательно)</span>
          </label>
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
            <option value="">Без вселенной</option>
            {universes.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>

        {form.mode === 'generate' && (
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
          </div>
        )}

        {form.mode === 'paste' && (
          <div className="mt-4">
            <p className="text-sm text-base-content/60">
              Вставь историю, которую ты уже написал (или создал в другом месте). Она сохранится как есть, без запуска конвейера генерации.
            </p>
            <input
              type="text"
              className="input input-bordered mt-4 w-full bg-base-100"
              placeholder="Название (необязательно)"
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            />
            <textarea
              className="textarea textarea-bordered mt-3 min-h-60 w-full bg-base-100"
              placeholder="Жили-были..."
              value={form.textFinal}
              onChange={(event) => setForm((prev) => ({ ...prev, textFinal: event.target.value }))}
            />
          </div>
        )}

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
