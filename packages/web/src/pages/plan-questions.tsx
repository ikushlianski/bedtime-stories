import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, type PlanQuestion } from '../lib/api'
import { PageHeader, StatusCallout } from '../components'

function usePlanQuestions(storyId: number) {
  const [questions, setQuestions] = useState<PlanQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    api.pipeline
      .questions(storyId)
      .then(setQuestions)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load questions')
      })
      .finally(() => setLoading(false))
  }, [storyId])

  return { questions, loading, error }
}

function usePipelineStatusRedirect(storyId: number, navigate: ReturnType<typeof useNavigate>) {
  useEffect(() => {
    api.pipeline
      .status(storyId)
      .then((status) => {
        if (status.status === 'plan_running' || status.status === 'plan_ready') {
          navigate(`/stories/${storyId}/pipeline`)
        }
      })
      .catch(() => {
        /* non-fatal */
      })
  }, [storyId, navigate])
}

export function PlanQuestionsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const storyId = Number(id)
  const { questions, loading, error } = usePlanQuestions(storyId)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  usePipelineStatusRedirect(storyId, navigate)

  const allAnswered = questions.length > 0 && questions.every((q) => {
    const answer = answers[q.id]
    return answer !== undefined && answer.trim().length > 0
  })

  const handleAnswerChange = (questionId: number, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setSubmitError(null)

    try {
      const answersPayload = questions.map((q) => ({
        id: q.id,
        answer: answers[q.id] ?? '',
      }))

      await api.pipeline.submitAnswers(storyId, answersPayload)

      navigate(`/stories/${storyId}/pipeline`)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit answers')
      setSubmitting(false)
    }
  }

  if (loading) {
    return <StatusCallout title="Loading" message="Fetching clarifying questions." />
  }

  if (error) {
    return <StatusCallout tone="error" title="Failed to load questions" message={error} />
  }

  if (questions.length === 0) {
    return (
      <StatusCallout
        tone="warning"
        title="No questions found"
        message="No clarifying questions were generated for this story."
      />
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow="Planning"
        title="Clarifying Questions"
        description="Answer these questions to help personalize the story before the plan is generated."
        backAction={
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
            ← Back to stories
          </button>
        }
      />

      {submitError && (
        <div className="mb-4">
          <StatusCallout tone="error" title="Submission failed" message={submitError} />
        </div>
      )}

      <div className="space-y-6">
        <div className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body gap-6">
            {questions.map((question, index) => (
              <div key={question.id} className="space-y-2">
                <label className="label">
                  <span className="label-text font-medium">
                    {index + 1}. {question.questionText}
                  </span>
                </label>

                <textarea
                  className="textarea textarea-bordered w-full"
                  rows={3}
                  value={answers[question.id] ?? ''}
                  onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                  placeholder="Your answer..."
                />
              </div>
            ))}

            <div className="flex justify-end pt-2">
              <button
                className="btn btn-primary btn-wide"
                onClick={() => void handleSubmit()}
                disabled={!allAnswered || submitting}
              >
                {submitting ? 'Submitting...' : 'Submit answers'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
