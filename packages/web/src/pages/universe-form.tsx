import { useState } from 'react'
import type { StoryGroup } from '../lib/api'

export interface UniverseFormValues {
  name: string
  description: string
  systemPrompt: string
}

interface UniverseFormProps {
  initial?: Partial<UniverseFormValues>
  onSave: (values: UniverseFormValues) => Promise<void>
  onCancel: () => void
  saveLabel?: string
}

function UniverseForm({ initial, onSave, onCancel, saveLabel = 'Save' }: UniverseFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [systemPrompt, setSystemPrompt] = useState(initial?.systemPrompt ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!name.trim() || !systemPrompt.trim()) {
      setError('Name and system prompt are required')
      return
    }

    setSaving(true)
    setError(null)

    try {
      await onSave({ name: name.trim(), description: description.trim(), systemPrompt: systemPrompt.trim() })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        type="text"
        className="input input-bordered bg-base-100"
        placeholder="Universe name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        type="text"
        className="input input-bordered bg-base-100"
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <textarea
        className="textarea textarea-bordered min-h-40 bg-base-100"
        placeholder="System prompt — characters, voice, tone, recurring places..."
        value={systemPrompt}
        onChange={(e) => setSystemPrompt(e.target.value)}
      />
      {error && <p className="text-sm text-error">{error}</p>}
      <div className="flex gap-2">
        <button
          className={`btn btn-primary btn-sm ${saving ? 'loading' : ''}`}
          onClick={() => void handleSave()}
          disabled={saving}
        >
          {saving ? 'Saving...' : saveLabel}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

export interface UniverseCardProps {
  universe: StoryGroup
  onDelete: (id: number) => Promise<void>
  onUpdate: (id: number, values: UniverseFormValues) => Promise<void>
}

export function UniverseCard({ universe, onDelete, onUpdate }: UniverseCardProps) {
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleDelete() {
    if (!window.confirm(`Delete universe "${universe.name}"?`)) {
      return
    }

    setDeleting(true)
    setDeleteError(null)

    try {
      await onDelete(universe.id)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  if (editing) {
    return (
      <div className="card border border-base-300 bg-base-100 p-4">
        <UniverseForm
          initial={{ name: universe.name, description: universe.description, systemPrompt: universe.systemPrompt }}
          onSave={async (values) => {
            await onUpdate(universe.id, values)
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
          saveLabel="Update"
        />
      </div>
    )
  }

  return (
    <div className="card border border-base-300 bg-base-100 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold">{universe.name}</h3>
          {universe.description && (
            <p className="mt-1 text-sm text-base-content/60">{universe.description}</p>
          )}
          <p className="mt-2 font-mono text-xs text-base-content/50">
            {universe.systemPrompt.slice(0, 100)}
            {universe.systemPrompt.length > 100 ? '…' : ''}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button
            className={`btn btn-error btn-sm btn-outline ${deleting ? 'loading' : ''}`}
            onClick={() => void handleDelete()}
            disabled={deleting}
          >
            Delete
          </button>
        </div>
      </div>
      {deleteError && <p className="mt-2 text-sm text-error">{deleteError}</p>}
    </div>
  )
}

export { UniverseForm }
