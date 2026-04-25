import { useState } from 'react'
import { api, type UniverseCharacter } from '../lib/api'
import FormField from './form-field'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

interface CharacterCardProps {
  character: UniverseCharacter
  universeId: number
  onUpdated: (updated: UniverseCharacter) => void
  onDeleted: (id: number) => void
}

function CharacterCard({ character, universeId, onUpdated, onDeleted }: CharacterCardProps) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(character.name)
  const [description, setDescription] = useState(character.description)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)

    try {
      const updated = await api.universes.updateCharacter(universeId, character.id, { name: name.trim(), description: description.trim() })

      onUpdated(updated)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Удалить персонажа «${character.name}»?`)) return

    setDeleting(true)

    try {
      await api.universes.deleteCharacter(universeId, character.id)
      onDeleted(character.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить')
      setDeleting(false)
    }
  }

  if (editing) {
    return (
      <div className="card border border-primary/30 bg-base-200 p-4">
        <div className="flex flex-col gap-3">
          <FormField label="Имя">
            <input
              type="text"
              className="input input-bordered input-sm w-full bg-base-100"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>
          <FormField label="Описание">
            <textarea
              className="textarea textarea-bordered min-h-20 w-full bg-base-100 text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormField>
          {error && <p className="text-xs text-error">{error}</p>}
          <div className="flex gap-2">
            <button className="btn btn-primary btn-sm" disabled={saving || !name.trim()} onClick={() => void handleSave()}>
              {saving ? 'Сохраняем...' : 'Сохранить'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(false); setName(character.name); setDescription(character.description) }}>
              Отмена
            </button>
          </div>
        </div>
      </div>
    )
  }

  const dateLabel = character.updatedAt
    ? `Изменён ${formatDate(character.updatedAt)}`
    : character.createdAt
      ? `Создан ${formatDate(character.createdAt)}`
      : null

  return (
    <div className="card border border-base-300 bg-base-200 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{character.name}</p>
          {character.description && (
            <p className="mt-1 whitespace-pre-wrap text-xs text-base-content/60">{character.description}</p>
          )}
          {dateLabel && (
            <p className="mt-2 text-xs text-base-content/30">{dateLabel}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <button className="btn btn-ghost btn-xs" onClick={() => setEditing(true)}>
            Изменить
          </button>
          <button
            className={`btn btn-error btn-xs btn-outline ${deleting ? 'loading' : ''}`}
            onClick={() => void handleDelete()}
            disabled={deleting}
          >
            Удалить
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-error">{error}</p>}
    </div>
  )
}

interface AddCharacterFormProps {
  universeId: number
  onAdded: (character: UniverseCharacter) => void
  onCancel: () => void
}

function AddCharacterForm({ universeId, onAdded, onCancel }: AddCharacterFormProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!name.trim()) return

    setSaving(true)
    setError(null)

    try {
      const created = await api.universes.createCharacter(universeId, { name: name.trim(), description: description.trim() })

      onAdded(created)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать')
      setSaving(false)
    }
  }

  return (
    <div className="card border border-primary/30 bg-base-200 p-4">
      <div className="flex flex-col gap-3">
        <FormField label="Имя" required>
          <input
            type="text"
            className="input input-bordered input-sm w-full bg-base-100"
            placeholder="Имя персонажа..."
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </FormField>
        <FormField label="Описание">
          <textarea
            className="textarea textarea-bordered min-h-16 w-full bg-base-100 text-sm"
            placeholder="Черты характера, особенности, привычки..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </FormField>
        {error && <p className="text-xs text-error">{error}</p>}
        <div className="flex gap-2">
          <button className="btn btn-primary btn-sm" disabled={saving || !name.trim()} onClick={() => void handleSave()}>
            {saving ? 'Создаём...' : 'Добавить'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}

interface UniverseCharactersProps {
  universeId: number
  characters: UniverseCharacter[]
  onChange: (characters: UniverseCharacter[]) => void
}

function UniverseCharacters({ universeId, characters, onChange }: UniverseCharactersProps) {
  const [adding, setAdding] = useState(false)

  function handleUpdated(updated: UniverseCharacter) {
    onChange(characters.map((c) => (c.id === updated.id ? updated : c)))
  }

  function handleDeleted(id: number) {
    onChange(characters.filter((c) => c.id !== id))
  }

  function handleAdded(character: UniverseCharacter) {
    onChange([...characters, character])
    setAdding(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-base-content/70">Персонажи</span>
        {!adding && (
          <button className="btn btn-ghost btn-xs" onClick={() => setAdding(true)}>
            + Добавить
          </button>
        )}
      </div>

      {characters.length === 0 && !adding && (
        <p className="text-sm text-base-content/40">Персонажей пока нет.</p>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {characters.map((c) => (
          <CharacterCard
            key={c.id}
            character={c}
            universeId={universeId}
            onUpdated={handleUpdated}
            onDeleted={handleDeleted}
          />
        ))}
      </div>

      {adding && (
        <AddCharacterForm
          universeId={universeId}
          onAdded={handleAdded}
          onCancel={() => setAdding(false)}
        />
      )}
    </div>
  )
}

export default UniverseCharacters
