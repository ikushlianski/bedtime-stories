import { useState, useEffect } from 'react'
import { api, type StoryGroup } from '../lib/api'
import { UniverseCard, UniverseForm, type UniverseFormValues } from './universe-form'

export function UniversesPage() {
  const [universes, setUniverses] = useState<StoryGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    setLoading(true)

    api.universes
      .list()
      .then((data) => {
        setUniverses(data)
        setLoadError(null)
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : 'Failed to load universes')
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate(values: UniverseFormValues) {
    const created = await api.universes.create(values)

    setUniverses((prev) => [...prev, created])
    setCreating(false)
  }

  async function handleDelete(id: number) {
    await api.universes.delete(id)

    setUniverses((prev) => prev.filter((u) => u.id !== id))
  }

  async function handleUpdate(id: number, values: UniverseFormValues) {
    const updated = await api.universes.update(id, values)

    setUniverses((prev) => prev.map((u) => (u.id === id ? updated : u)))
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl text-base-content">Universes</h1>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setCreating((v) => !v)}
        >
          {creating ? 'Cancel' : 'New Universe'}
        </button>
      </div>

      {creating && (
        <div className="card border border-base-300 bg-base-100 p-4">
          <h2 className="mb-4 text-lg font-semibold">New Universe</h2>
          <UniverseForm
            onSave={handleCreate}
            onCancel={() => setCreating(false)}
            saveLabel="Create"
          />
        </div>
      )}

      {loading && <p className="text-base-content/60">Loading...</p>}

      {loadError && <p className="text-error">{loadError}</p>}

      {!loading && !loadError && universes.length === 0 && (
        <p className="text-base-content/60">No universes yet. Create one to get started.</p>
      )}

      <div className="flex flex-col gap-4">
        {universes.map((universe) => (
          <UniverseCard
            key={universe.id}
            universe={universe}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
          />
        ))}
      </div>
    </div>
  )
}
