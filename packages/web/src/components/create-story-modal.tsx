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
}

function CreateStoryModal({ open, onClose, onSubmit, initialSeed = '' }: CreateStoryModalProps) {
  const [form, setForm] = useState<CreateStoryFormState>({
    ...INITIAL_CREATE_STORY_FORM,
    seed: initialSeed,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [universes, setUniverses] = useState<StoryGroup[]>([])

  useEffect(() => {
    if (open) {
      setForm({ ...INITIAL_CREATE_STORY_FORM, seed: initialSeed })
      setError(null)

      api.universes.list().then(setUniverses).catch(() => setUniverses([]))
    }
  }, [open, initialSeed])

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
      setError(submitError instanceof Error ? submitError.message : 'Failed to create story')
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = !submitting && validateCreateStoryForm(form).valid

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-2xl border border-base-300 bg-base-100 shadow-2xl">
        <h2 className="font-serif text-3xl text-base-content">New Story</h2>

        <div role="tablist" className="tabs tabs-boxed mt-4">
          <button
            role="tab"
            className={`tab ${form.mode === 'generate' ? 'tab-active' : ''}`}
            onClick={() => setMode('generate')}
          >
            Generate with AI
          </button>
          <button
            role="tab"
            className={`tab ${form.mode === 'paste' ? 'tab-active' : ''}`}
            onClick={() => setMode('paste')}
          >
            Paste existing story
          </button>
        </div>

        <div className="mt-4">
          <label className="label">
            <span className="label-text text-sm text-base-content/60">Universe (optional)</span>
          </label>
          <select
            className="select select-bordered w-full bg-base-100"
            value={form.groupId ?? ''}
            onChange={(event) => {
              const value = event.target.value

              setForm((prev) => ({ ...prev, groupId: value === '' ? null : parseInt(value, 10) }))
            }}
          >
            <option value="">No universe</option>
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
              Seed the next bedtime story with a situation, emotion, or challenge Sasha is working through.
            </p>
            <textarea
              className="textarea textarea-bordered mt-4 min-h-40 w-full bg-base-100"
              placeholder="The hero is nervous about sleeping away from home for the first time..."
              value={form.seed}
              onChange={(event) => setForm((prev) => ({ ...prev, seed: event.target.value }))}
              autoFocus
            />
          </div>
        )}

        {form.mode === 'paste' && (
          <div className="mt-4">
            <p className="text-sm text-base-content/60">
              Paste a story you already wrote (or produced elsewhere). It will be saved as-is and skip the generation pipeline.
            </p>
            <input
              type="text"
              className="input input-bordered mt-4 w-full bg-base-100"
              placeholder="Title (optional)"
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            />
            <textarea
              className="textarea textarea-bordered mt-3 min-h-60 w-full bg-base-100"
              placeholder="Once upon a time..."
              value={form.textFinal}
              onChange={(event) => setForm((prev) => ({ ...prev, textFinal: event.target.value }))}
            />
          </div>
        )}

        {error && <p className="mt-3 text-sm text-error">{error}</p>}

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`btn btn-primary ${canSubmit ? '' : 'btn-disabled'}`}
            onClick={() => void handleSubmit()}
          >
            {submitting ? 'Creating...' : 'Create Story'}
          </button>
        </div>
      </div>
      <button className="modal-backdrop" onClick={onClose}>
        close
      </button>
    </dialog>
  )
}

export default CreateStoryModal
