import { useState, useEffect } from 'react'
import { api, type ParentReview } from '../lib/api'
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

interface ParentReviewFormProps {
  storyId: number
}

function ParentReviewForm({ storyId }: ParentReviewFormProps) {
  const [rating, setRating] = useState<number | null>(null)
  const [pacingOk, setPacingOk] = useState<boolean | null>(null)
  const [wouldReuse, setWouldReuse] = useState<boolean | null>(null)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.stories.getParentReview(storyId)
      .then((review) => {
        if (review) {
          setRating(review.rating)
          setPacingOk(review.pacingOk)
          setWouldReuse(review.wouldReuse)
          setNotes(review.notes ?? '')
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
      await api.stories.saveParentReview(storyId, { rating, pacingOk, wouldReuse, notes: notes || undefined })
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
        <span className="text-sm font-medium text-base-content/70">Общая оценка истории</span>
        <StarRating value={rating} onChange={setRating} />
      </div>

      <div className="flex flex-wrap gap-6">
        <div className="space-y-1">
          <span className="text-sm text-base-content/70">Темп и длина норм?</span>
          <ToggleButton value={pacingOk} onChange={setPacingOk} />
        </div>

        <div className="space-y-1">
          <span className="text-sm text-base-content/70">Использовал бы снова?</span>
          <ToggleButton value={wouldReuse} onChange={setWouldReuse} />
        </div>
      </div>

      <FormField label="Заметки">
        <textarea
          className="textarea textarea-bordered min-h-24 w-full bg-base-200"
          placeholder="Что удалось, что нет, на что обратить внимание..."
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

export default ParentReviewForm
