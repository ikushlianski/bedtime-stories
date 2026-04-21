import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type StoryGroup } from '../lib/api'
import FormField from '../components/form-field'

interface CreateUniverseFormProps {
  onSave: (name: string, systemPrompt: string, description: string) => Promise<void>
  onCancel: () => void
}

function CreateUniverseForm({ onSave, onCancel }: CreateUniverseFormProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!name.trim() || !systemPrompt.trim()) {
      setError('Название и системный промпт обязательны')
      return
    }

    setSaving(true)
    setError(null)

    try {
      await onSave(name.trim(), systemPrompt.trim(), description.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать')
      setSaving(false)
    }
  }

  return (
    <div className="card border border-base-300 bg-base-100 p-4">
      <h2 className="mb-4 text-lg font-semibold">Новая вселенная</h2>
      <div className="flex flex-col gap-4">
        <FormField label="Название" required>
          <input
            type="text"
            className="input input-bordered w-full bg-base-200"
            placeholder="Название вселенной"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </FormField>
        <FormField label="Описание">
          <input
            type="text"
            className="input input-bordered w-full bg-base-200"
            placeholder="Необязательно"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </FormField>
        <FormField label="Системный промпт" required>
          <textarea
            className="textarea textarea-bordered min-h-32 w-full bg-base-200"
            placeholder="Персонажи, голос, тон, повторяющиеся места..."
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
          />
        </FormField>
        {error && <p className="text-sm text-error">{error}</p>}
        <div className="flex gap-2">
          <button
            className="btn btn-primary btn-sm"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving ? 'Создаём...' : 'Создать'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}

interface UniverseCardPreviewProps {
  universe: StoryGroup
  onClick: () => void
}

function UniverseCardPreview({ universe, onClick }: UniverseCardPreviewProps) {
  return (
    <button
      className="card border border-base-300 bg-base-200 p-4 text-left hover:border-primary/40 hover:bg-base-100 transition-colors w-full"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">{universe.name}</h3>
            {universe.pendingSuggestionsCount > 0 && (
              <span className="badge badge-warning badge-sm">{universe.pendingSuggestionsCount}</span>
            )}
          </div>
          {universe.description && (
            <p className="mt-1 text-sm text-base-content/60">{universe.description}</p>
          )}
          <p className="mt-2 font-mono text-xs text-base-content/40">
            {universe.systemPrompt.slice(0, 100)}{universe.systemPrompt.length > 100 ? '…' : ''}
          </p>
          {universe.characters.length > 0 && (
            <p className="mt-2 text-xs text-base-content/50">
              Персонажи: {universe.characters.map((c) => c.name).join(', ')}
            </p>
          )}
        </div>
        <span className="text-base-content/30 shrink-0">→</span>
      </div>
    </button>
  )
}

export function UniversesPage() {
  const navigate = useNavigate()
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
        setLoadError(err instanceof Error ? err.message : 'Не удалось загрузить вселенные')
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate(name: string, systemPrompt: string, description: string) {
    const created = await api.universes.create({ name, systemPrompt, description })

    setUniverses((prev) => [...prev, created])
    setCreating(false)
    navigate(`/universes/${created.id}`)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl text-base-content">Вселенные</h1>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setCreating((v) => !v)}
        >
          {creating ? 'Отмена' : 'Новая вселенная'}
        </button>
      </div>

      {creating && (
        <CreateUniverseForm
          onSave={handleCreate}
          onCancel={() => setCreating(false)}
        />
      )}

      {loading && <p className="text-base-content/60">Загрузка...</p>}

      {loadError && <p className="text-error">{loadError}</p>}

      {!loading && !loadError && universes.length === 0 && (
        <p className="text-base-content/60">Вселенных пока нет. Создай первую, чтобы начать.</p>
      )}

      <div className="flex flex-col gap-3">
        {universes.map((universe) => (
          <UniverseCardPreview
            key={universe.id}
            universe={universe}
            onClick={() => navigate(`/universes/${universe.id}`)}
          />
        ))}
      </div>
    </div>
  )
}
