import { useState } from 'react'
import { z } from 'zod'

const structuredFeedbackSchema = z.object({
  enjoyed: z.number().int().min(0).max(5),
  was_funny: z.boolean(),
  was_scary: z.boolean(),
  too_long: z.boolean(),
  favorite_moment: z.string(),
  favorite_character: z.string(),
  understood_moral: z.boolean(),
  want_again: z.boolean(),
  notes: z.string(),
})

const feedbackSchema = z.object({
  rating: z.number().int().min(0).max(5),
  structured_feedback: structuredFeedbackSchema,
})

export type FeedbackValues = z.infer<typeof feedbackSchema>

interface FeedbackFormProps {
  storyId: string
  onSubmit: (values: FeedbackValues) => Promise<void>
}

function StarRating({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className={`btn btn-ghost btn-sm px-1 text-2xl ${
            star <= value ? 'text-warning' : 'text-base-content/25'
          }`}
          aria-label={`Оценить ${star} из 5`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

function ToggleButton({
  value,
  onChange,
}: {
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`btn btn-sm ${value ? 'btn-primary' : 'btn-ghost border border-base-300'}`}
      >
        Да
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`btn btn-sm ${!value ? 'btn-primary' : 'btn-ghost border border-base-300'}`}
      >
        Нет
      </button>
    </div>
  )
}

function FeedbackForm({ storyId: _storyId, onSubmit }: FeedbackFormProps) {
  const [rating, setRating] = useState(0)
  const [enjoyed, setEnjoyed] = useState(0)
  const [wasFunny, setWasFunny] = useState(false)
  const [wasScary, setWasScary] = useState(false)
  const [tooLong, setTooLong] = useState(false)
  const [favoriteMoment, setFavoriteMoment] = useState('')
  const [favoriteCharacter, setFavoriteCharacter] = useState('')
  const [understoodMoral, setUnderstoodMoral] = useState(false)
  const [wantAgain, setWantAgain] = useState(false)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    const result = feedbackSchema.safeParse({
      rating,
      structured_feedback: {
        enjoyed,
        was_funny: wasFunny,
        was_scary: wasScary,
        too_long: tooLong,
        favorite_moment: favoriteMoment,
        favorite_character: favoriteCharacter,
        understood_moral: understoodMoral,
        want_again: wantAgain,
        notes,
      },
    })

    if (!result.success) {
      setError(result.error.errors[0]?.message ?? 'Некорректный ввод')
      return
    }

    setError(null)
    setLoading(true)

    try {
      await onSubmit(result.data)
      setRating(0)
      setEnjoyed(0)
      setWasFunny(false)
      setWasScary(false)
      setTooLong(false)
      setFavoriteMoment('')
      setFavoriteCharacter('')
      setUnderstoodMoral(false)
      setWantAgain(false)
      setNotes('')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось отправить отзыв')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-6">
        <div>
          <h2 className="font-serif text-2xl text-base-content">Оставить отзыв</h2>
          <p className="text-sm text-base-content/60">
            Запиши, как прошло чтение — что понравилось, что нет.
          </p>
        </div>

        <div className="space-y-2">
          <span className="text-sm font-medium text-base-content/70">Общая оценка</span>
          <StarRating value={rating} onChange={setRating} />
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-base-content/60">
            Реакции Саши
          </h3>

          <div className="space-y-2">
            <span className="text-sm text-base-content/70">Насколько понравилось?</span>
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
            <div className="space-y-1">
              <label className="text-sm text-base-content/70">Любимый момент</label>
              <input
                type="text"
                className="input input-bordered w-full bg-base-100"
                placeholder="Момент, который понравился больше всего..."
                value={favoriteMoment}
                onChange={(e) => setFavoriteMoment(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-base-content/70">Любимый персонаж</label>
              <input
                type="text"
                className="input input-bordered w-full bg-base-100"
                placeholder="Любимый персонаж..."
                value={favoriteCharacter}
                onChange={(e) => setFavoriteCharacter(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-base-content/60">
            Твои заметки
          </h3>
          <textarea
            className="textarea textarea-bordered min-h-28 w-full bg-base-100"
            placeholder="Твои общие впечатления..."
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>

        {error && <p className="text-sm text-error">{error}</p>}

        <div className="card-actions justify-end">
          <button
            className="btn btn-primary"
            disabled={loading}
            onClick={() => void handleSubmit()}
          >
            Отправить отзыв
          </button>
        </div>
      </div>
    </section>
  )
}

export default FeedbackForm
