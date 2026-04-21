import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import FormField from './form-field'

function StarRating({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className={`btn btn-ghost btn-sm px-1 text-2xl ${star <= (value ?? 0) ? 'text-warning' : 'text-base-content/25'}`}
          aria-label={`Оценить ${star} из 5`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

function ToggleButton({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`btn btn-sm ${value === true ? 'btn-primary' : 'btn-ghost border border-base-300'}`}
      >
        Да
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`btn btn-sm ${value === false ? 'btn-primary' : 'btn-ghost border border-base-300'}`}
      >
        Нет
      </button>
    </div>
  )
}

interface ChildReactionFormProps {
  storyId: number
}

function ChildReactionForm({ storyId }: ChildReactionFormProps) {
  const [enjoyed, setEnjoyed] = useState<number | null>(null)
  const [wasFunny, setWasFunny] = useState<boolean | null>(null)
  const [wasScary, setWasScary] = useState<boolean | null>(null)
  const [tooLong, setTooLong] = useState<boolean | null>(null)
  const [understoodMoral, setUnderstoodMoral] = useState<boolean | null>(null)
  const [wantAgain, setWantAgain] = useState<boolean | null>(null)
  const [favoriteMoment, setFavoriteMoment] = useState('')
  const [favoriteCharacter, setFavoriteCharacter] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.stories.getChildReaction(storyId)
      .then((reaction) => {
        if (reaction) {
          setEnjoyed(reaction.enjoyed)
          setWasFunny(reaction.wasFunny)
          setWasScary(reaction.wasScary)
          setTooLong(reaction.tooLong)
          setUnderstoodMoral(reaction.understoodMoral)
          setWantAgain(reaction.wantAgain)
          setFavoriteMoment(reaction.favoriteMoment ?? '')
          setFavoriteCharacter(reaction.favoriteCharacter ?? '')
          setNotes(reaction.notes ?? '')
        }
      })
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [storyId])

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)

    try {
      await api.stories.saveChildReaction(storyId, {
        enjoyed,
        wasFunny,
        wasScary,
        tooLong,
        understoodMoral,
        wantAgain,
        favoriteMoment: favoriteMoment || undefined,
        favoriteCharacter: favoriteCharacter || undefined,
        notes: notes || undefined,
      })
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-base-content/50">Загружаем...</p>
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <span className="text-sm font-medium text-base-content/70">Насколько понравилось?</span>
        <StarRating value={enjoyed} onChange={setEnjoyed} />
      </div>

      <div className="flex flex-wrap gap-6">
        <div className="space-y-1">
          <span className="text-sm text-base-content/70">Было смешно?</span>
          <ToggleButton value={wasFunny} onChange={setWasFunny} />
        </div>

        <div className="space-y-1">
          <span className="text-sm text-base-content/70">Было страшно?</span>
          <ToggleButton value={wasScary} onChange={setWasScary} />
        </div>

        <div className="space-y-1">
          <span className="text-sm text-base-content/70">Слишком длинная?</span>
          <ToggleButton value={tooLong} onChange={setTooLong} />
        </div>

        <div className="space-y-1">
          <span className="text-sm text-base-content/70">Понял мораль?</span>
          <ToggleButton value={understoodMoral} onChange={setUnderstoodMoral} />
        </div>

        <div className="space-y-1">
          <span className="text-sm text-base-content/70">Хочет снова?</span>
          <ToggleButton value={wantAgain} onChange={setWantAgain} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Любимый момент">
          <input
            type="text"
            className="input input-bordered w-full bg-base-200"
            placeholder="Момент, который понравился больше всего..."
            value={favoriteMoment}
            onChange={(e) => setFavoriteMoment(e.target.value)}
          />
        </FormField>

        <FormField label="Любимый персонаж">
          <input
            type="text"
            className="input input-bordered w-full bg-base-200"
            placeholder="Любимый персонаж..."
            value={favoriteCharacter}
            onChange={(e) => setFavoriteCharacter(e.target.value)}
          />
        </FormField>
      </div>

      <FormField label="Заметки">
        <textarea
          className="textarea textarea-bordered min-h-20 w-full bg-base-200"
          placeholder="Что Саша сказал, запомнившиеся реакции..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </FormField>

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-sm text-success">Сохранено</span>}
        <button className="btn btn-primary btn-sm" disabled={saving} onClick={() => void handleSave()}>
          {saving ? 'Сохраняем...' : 'Сохранить'}
        </button>
      </div>
    </div>
  )
}

export default ChildReactionForm
