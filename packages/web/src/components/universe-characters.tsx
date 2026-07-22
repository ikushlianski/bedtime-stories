import { useEffect, useState } from 'react'
import { api, characterReferenceImageUrl, type CharacterReferenceImage, type UniverseCharacter } from '../lib/api'
import FormField from './form-field'
import CharacterBibleFields, { type CharacterBibleValues } from './character-bible-fields'

function bibleFromCharacter(character: UniverseCharacter): CharacterBibleValues {
  return {
    age: character.age ?? '',
    setting: character.setting ?? '',
    traits: character.traits ?? '',
    relationships: character.relationships ?? '',
    coOccurrenceNote: character.coOccurrenceNote ?? '',
  }
}

const EMPTY_BIBLE: CharacterBibleValues = {
  age: '',
  setting: '',
  traits: '',
  relationships: '',
  coOccurrenceNote: '',
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

const ACCEPTED_REFERENCE_IMAGE_TYPES = 'image/png,image/jpeg,image/webp'

interface CharacterReferenceImagesProps {
  universeId: number
  characterId: number
  onCountChange: (count: number) => void
}

function CharacterReferenceImages({ universeId, characterId, onCountChange }: CharacterReferenceImagesProps) {
  const [images, setImages] = useState<CharacterReferenceImage[] | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    api.universes.listCharacterReferenceImages(universeId, characterId).then((loaded) => {
      if (!cancelled) setImages(loaded)
    }).catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Не удалось загрузить референсы')
    })

    return () => {
      cancelled = true
    }
  }, [universeId, characterId])

  async function handleFileSelected(file: File) {
    setUploading(true)
    setError(null)

    try {
      const created = await api.universes.uploadCharacterReferenceImage(universeId, characterId, file)
      setImages((prev) => {
        const next = [created, ...(prev ?? [])]
        onCountChange(next.length)
        return next
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить изображение')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(refId: number) {
    setError(null)

    try {
      await api.universes.deleteCharacterReferenceImage(universeId, characterId, refId)
      setImages((prev) => {
        const next = (prev ?? []).filter((img) => img.id !== refId)
        onCountChange(next.length)
        return next
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить изображение')
    }
  }

  return (
    <div className="mt-3 border-t border-base-300 pt-3" data-testid="character-reference-images">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-base-content/60">Референсные изображения</span>
        <label className={`btn btn-ghost btn-xs ${uploading ? 'loading' : ''}`}>
          {uploading ? 'Загружаем...' : '+ Загрузить'}
          <input
            type="file"
            accept={ACCEPTED_REFERENCE_IMAGE_TYPES}
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) void handleFileSelected(file)
            }}
          />
        </label>
      </div>

      {error && <p className="mt-1 text-xs text-error">{error}</p>}

      {images === null && <p className="mt-2 text-xs text-base-content/40">Загрузка...</p>}

      {images !== null && images.length === 0 && (
        <p className="mt-2 text-xs text-warning" data-testid="no-reference-images">
          Референсов пока нет — генерация иллюстраций с этим персонажем будет пропущена.
        </p>
      )}

      {images !== null && images.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2" data-testid="reference-image-grid">
          {images.map((img) => (
            <div key={img.id} className="group relative h-16 w-16 shrink-0 overflow-hidden rounded border border-base-300">
              <img
                src={characterReferenceImageUrl(universeId, characterId, img.id)}
                alt="Референсное изображение персонажа"
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-bl bg-error text-xs text-error-content opacity-0 transition-opacity group-hover:opacity-100"
                onClick={() => void handleDelete(img.id)}
                aria-label="Удалить референсное изображение"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
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
  const [bible, setBible] = useState<CharacterBibleValues>(bibleFromCharacter(character))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)

    try {
      const updated = await api.universes.updateCharacter(universeId, character.id, {
        name: name.trim(),
        description: description.trim(),
        age: bible.age.trim(),
        setting: bible.setting.trim(),
        traits: bible.traits.trim(),
        relationships: bible.relationships.trim(),
        coOccurrenceNote: bible.coOccurrenceNote.trim(),
      })

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
          <CharacterBibleFields values={bible} onChange={(patch) => setBible((p) => ({ ...p, ...patch }))} />
          {error && <p className="text-xs text-error">{error}</p>}
          <div className="flex gap-2">
            <button className="btn btn-primary btn-sm" disabled={saving || !name.trim()} onClick={() => void handleSave()}>
              {saving ? 'Сохраняем...' : 'Сохранить'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(false); setName(character.name); setDescription(character.description); setBible(bibleFromCharacter(character)) }}>
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
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm">{character.name}</p>
            <span
              className={`badge badge-xs ${character.referenceImageCount > 0 ? 'badge-success' : 'badge-warning'}`}
              data-testid="reference-image-count"
            >
              {character.referenceImageCount > 0 ? `Референсов: ${character.referenceImageCount}` : 'Нет референсов'}
            </span>
          </div>
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
      <CharacterReferenceImages
        universeId={universeId}
        characterId={character.id}
        onCountChange={(count) => onUpdated({ ...character, referenceImageCount: count })}
      />
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
  const [bible, setBible] = useState<CharacterBibleValues>(EMPTY_BIBLE)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!name.trim()) return

    setSaving(true)
    setError(null)

    try {
      const created = await api.universes.createCharacter(universeId, {
        name: name.trim(),
        description: description.trim(),
        age: bible.age.trim(),
        setting: bible.setting.trim(),
        traits: bible.traits.trim(),
        relationships: bible.relationships.trim(),
        coOccurrenceNote: bible.coOccurrenceNote.trim(),
      })

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
        <CharacterBibleFields values={bible} onChange={(patch) => setBible((p) => ({ ...p, ...patch }))} />
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
