import { useState, useEffect } from 'react'
import { api, type CreateStoryInput, type StoryGroup } from '../lib/api'
import {
  validateCreateStoryForm,
  type CreateStoryFormState,
} from './create-story-form'
import FormField from './form-field'
import ModelPicker from './model-picker'

interface CreateStoryModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (input: CreateStoryInput) => Promise<void>
  onSeriesCreated?: (count: number) => void
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

function CreateStoryModal({ open, onClose, onSubmit, onSeriesCreated, initialSeed = '', initialGroupId = null }: CreateStoryModalProps) {
  const [form, setForm] = useState<CreateStoryFormState>({
    seed: initialSeed,
    groupId: initialGroupId ?? loadLastUniverseId(),
    pipelineMode: 'manual',
  })
  const [submitting, setSubmitting] = useState(false)
  const [creatingSeries, setCreatingSeries] = useState(false)
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
        pipelineMode: 'manual',
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
      setForm({ seed: '', groupId: null, pipelineMode: 'manual', perStageOverrides: {} })
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

  async function handleCreateSeries() {
    const validation = validateCreateStoryForm(form)

    if (!validation.valid) {
      setError(validation.reason)
      return
    }

    if (!('seed' in validation.input) || form.groupId === null) {
      setError('Укажи затравку и вселенную')
      return
    }

    setCreatingSeries(true)
    setError(null)

    try {
      const result = await api.stories.createSeries({ seed: form.seed.trim(), groupId: form.groupId })

      setForm({ seed: '', groupId: null, pipelineMode: 'manual', perStageOverrides: {} })
      onSeriesCreated?.(result.stories.length)
      onClose()
    } catch (seriesError) {
      setError(seriesError instanceof Error ? seriesError.message : 'Не удалось создать серию историй')
    } finally {
      setCreatingSeries(false)
    }
  }

  const canSubmit = !submitting && !creatingSeries && validateCreateStoryForm(form).valid

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-2xl border border-base-300 bg-base-200 shadow-2xl">
        <h2 className="font-serif text-3xl text-base-content">Новая история</h2>

        <div className="mt-5 space-y-5">
          <FormField label="Вселенная" required>
            {showCreateUniverse ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input input-bordered flex-1 bg-base-200"
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
              <div className="flex gap-2">
                <select
                  className="select select-bordered flex-1 bg-base-200"
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
                <button
                  type="button"
                  className="btn btn-ghost btn-sm text-primary"
                  onClick={() => setShowCreateUniverse(true)}
                >
                  + Новая
                </button>
              </div>
            )}
          </FormField>

          <FormField
            label="Затравка"
            hint="Ситуация, эмоция или испытание, которое сейчас актуально для Саши."
            required
          >
            <textarea
              className="textarea textarea-bordered min-h-40 w-full bg-base-200"
              placeholder="Герой нервничает: первый раз ночевать не дома..."
              value={form.seed}
              onChange={(event) => setForm((prev) => ({ ...prev, seed: event.target.value }))}
              autoFocus
            />
          </FormField>

          <FormField label="Режим конвейера">
            <div className="join" role="radiogroup" aria-label="Режим конвейера">
              <button
                type="button"
                role="radio"
                aria-checked={form.pipelineMode === 'auto'}
                className={`btn join-item ${form.pipelineMode === 'auto' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setForm((prev) => ({ ...prev, pipelineMode: 'auto' }))}
              >
                Авто
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={form.pipelineMode === 'manual'}
                className={`btn join-item ${form.pipelineMode === 'manual' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setForm((prev) => ({ ...prev, pipelineMode: 'manual' }))}
              >
                Ручной
              </button>
            </div>
          </FormField>

          <FormField
            label="Модели по стадиям"
            hint="Выбери модель для каждой стадии: сюжетник, писатель и вопросы к семени"
            required
          >
            <ModelPicker
              value={form.perStageOverrides ?? {}}
              onChange={(next) => setForm((prev) => ({ ...prev, perStageOverrides: next }))}
              required={true}
            />
          </FormField>
        </div>

        {error && <p className="mt-3 text-sm text-error">{error}</p>}

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className={`btn btn-outline ${canSubmit ? '' : 'btn-disabled'}`}
            onClick={() => void handleCreateSeries()}
            title="Сгенерировать 3 разных черновика сюжета на основе затравки"
          >
            {creatingSeries ? 'Генерируем серию...' : 'Создать серию'}
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
