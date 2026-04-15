import { useState } from 'react'
import { z } from 'zod'

const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1, 'Comment is required'),
})

type FeedbackValues = z.infer<typeof feedbackSchema>

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
          aria-label={`Rate ${star} out of 5`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

function FeedbackForm({ storyId: _storyId, onSubmit }: FeedbackFormProps) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    const result = feedbackSchema.safeParse({ rating, comment })

    if (!result.success) {
      setError(result.error.errors[0]?.message ?? 'Invalid input')
      return
    }

    setError(null)
    setLoading(true)

    try {
      await onSubmit(result.data)
      setComment('')
      setRating(0)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to submit feedback')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-4">
        <div>
          <h2 className="font-serif text-2xl text-base-content">Leave Feedback</h2>
          <p className="text-sm text-base-content/60">
            Capture how the story landed after reading.
          </p>
        </div>

        <div className="space-y-2">
          <span className="text-sm text-base-content/60">Rating</span>
          <StarRating value={rating} onChange={setRating} />
        </div>

        <textarea
          className={`textarea textarea-bordered min-h-28 w-full bg-base-100 ${error ? 'textarea-error' : ''}`}
          placeholder="What did Sasha think?"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />

        {error && <p className="text-sm text-error">{error}</p>}

        <div className="card-actions justify-end">
          <button
            className={`btn btn-primary ${loading ? 'btn-disabled' : ''}`}
            onClick={() => void handleSubmit()}
          >
            Submit Feedback
          </button>
        </div>
      </div>
    </section>
  )
}

export default FeedbackForm
