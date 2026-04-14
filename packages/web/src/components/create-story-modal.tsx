import { useState } from 'react'

interface CreateStoryModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (seed: string) => Promise<void>
}

function CreateStoryModal({ open, onClose, onSubmit }: CreateStoryModalProps) {
  const [seed, setSeed] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) {
    return null
  }

  async function handleSubmit() {
    if (!seed.trim()) {
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      await onSubmit(seed.trim())
      setSeed('')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to create story')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-2xl border border-base-300 bg-base-100 shadow-2xl">
        <h2 className="font-serif text-3xl text-base-content">New Story</h2>
        <p className="mt-2 text-sm text-base-content/60">
          Seed the next bedtime story with a situation, emotion, or challenge Sasha is working through.
        </p>

        <textarea
          className="textarea textarea-bordered mt-6 min-h-40 w-full bg-base-100"
          placeholder="The hero is nervous about sleeping away from home for the first time..."
          value={seed}
          onChange={(event) => setSeed(event.target.value)}
          autoFocus
        />

        {error && <p className="mt-3 text-sm text-error">{error}</p>}

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`btn btn-primary ${submitting || !seed.trim() ? 'btn-disabled' : ''}`}
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
