import { useState } from 'react'
import type { StoryGroup } from '../lib/api'

export interface UniverseFormValues {
  name: string
  description: string
  systemPrompt: string
  universeContext: string
  styleGuide: string
}

interface UniverseFormProps {
  initial?: Partial<UniverseFormValues>
  onSave: (values: UniverseFormValues) => Promise<void>
  onCancel: () => void
  saveLabel?: string
}

function UniverseForm({ initial, onSave, onCancel, saveLabel = 'Сохранить' }: UniverseFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [systemPrompt, setSystemPrompt] = useState(initial?.systemPrompt ?? '')
  const [universeContext, setUniverseContext] = useState(initial?.universeContext ?? '')
  const [styleGuide, setStyleGuide] = useState(initial?.styleGuide ?? '')
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
      await onSave({
        name: name.trim(),
        description: description.trim(),
        systemPrompt: systemPrompt.trim(),
        universeContext: universeContext.trim(),
        styleGuide: styleGuide.trim(),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        type="text"
        className="input input-bordered bg-base-200"
        placeholder="Название вселенной"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        type="text"
        className="input input-bordered bg-base-200"
        placeholder="Описание (необязательно)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <textarea
        className="textarea textarea-bordered min-h-40 bg-base-200"
        placeholder="Системный промпт — персонажи, голос, тон, повторяющиеся места..."
        value={systemPrompt}
        onChange={(e) => setSystemPrompt(e.target.value)}
      />
      <div className="space-y-1">
        <p className="text-xs text-base-content/50">
          Живой контекст вселенной — AI поддерживает автоматически, но можно редактировать вручную
        </p>
        <textarea
          className="textarea textarea-bordered min-h-48 w-full bg-base-200 font-mono text-xs"
          placeholder="## Персонажи&#10;- ...&#10;&#10;## События&#10;- ...&#10;&#10;## Чувства и темы&#10;- ..."
          value={universeContext}
          onChange={(e) => setUniverseContext(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <p className="text-xs text-base-content/50">
          Гайд по стилю — накапливается при анализе примерных историй. Можно редактировать вручную
        </p>
        <textarea
          className="textarea textarea-bordered min-h-36 w-full bg-base-200 font-mono text-xs"
          placeholder="## Что работает&#10;- ...&#10;&#10;## Что не работает&#10;- ..."
          value={styleGuide}
          onChange={(e) => setStyleGuide(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-error">{error}</p>}
      <div className="flex gap-2">
        <button
          className={`btn btn-primary btn-sm ${saving ? 'loading' : ''}`}
          onClick={() => void handleSave()}
          disabled={saving}
        >
          {saving ? 'Сохраняем...' : saveLabel}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>
          Отмена
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
    if (!window.confirm(`Удалить вселенную «${universe.name}»?`)) {
      return
    }

    setDeleting(true)
    setDeleteError(null)

    try {
      await onDelete(universe.id)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Не удалось удалить')
    } finally {
      setDeleting(false)
    }
  }

  if (editing) {
    return (
      <div className="card border border-base-300 bg-base-200 p-4">
        <UniverseForm
          initial={{
            name: universe.name,
            description: universe.description,
            systemPrompt: universe.systemPrompt,
            universeContext: universe.universeContext ?? '',
            styleGuide: universe.styleGuide ?? '',
          }}
          onSave={async (values) => {
            await onUpdate(universe.id, values)
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
          saveLabel="Обновить"
        />
      </div>
    )
  }

  return (
    <div className="card border border-base-300 bg-base-200 p-4">
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
          {universe.universeContext && (
            <p className="mt-2 text-xs text-base-content/40 italic">
              Живой контекст: {universe.universeContext.slice(0, 80)}…
            </p>
          )}
          {universe.styleGuide && (
            <p className="mt-1 text-xs text-base-content/40 italic">
              Гайд по стилю: {universe.styleGuide.slice(0, 80)}…
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
            Изменить
          </button>
          <button
            className={`btn btn-error btn-sm btn-outline ${deleting ? 'loading' : ''}`}
            onClick={() => void handleDelete()}
            disabled={deleting}
          >
            Удалить
          </button>
        </div>
      </div>
      {deleteError && <p className="mt-2 text-sm text-error">{deleteError}</p>}
    </div>
  )
}

export { UniverseForm }
