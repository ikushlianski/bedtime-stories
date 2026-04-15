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
        setError(err instanceof Error ? err.message : 'Не удалось загрузить вопросы')
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
      setSubmitError(err instanceof Error ? err.message : 'Не удалось отправить ответы')
      setSubmitting(false)
    }
  }

  if (loading) {
    return <StatusCallout title="Загрузка" message="Получаем уточняющие вопросы." />
  }

  if (error) {
    return <StatusCallout tone="error" title="Не удалось загрузить вопросы" message={error} />
  }

  if (questions.length === 0) {
    return (
      <StatusCallout
        tone="warning"
        title="Вопросов нет"
        message="Для этой истории уточняющие вопросы не были сгенерированы."
      />
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow="Планирование"
        title="Уточняющие вопросы"
        description="Ответь на эти вопросы, чтобы история стала более личной, прежде чем будет создан план."
        backAction={
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
            ← К историям
          </button>
        }
      />

      {submitError && (
        <div className="mb-4">
          <StatusCallout tone="error" title="Ошибка отправки" message={submitError} />
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
                  placeholder="Твой ответ..."
                />
              </div>
            ))}

            <div className="flex justify-end pt-2">
              <button
                className="btn btn-primary btn-wide"
                onClick={() => void handleSubmit()}
                disabled={!allAnswered || submitting}
              >
                {submitting ? 'Отправляем...' : 'Отправить ответы'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
