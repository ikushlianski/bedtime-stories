import { useState } from 'react'
import { api, type Topic } from '../lib/api'

interface PendingTopicsProps {
  topics: Topic[]
  onApproved: (id: number) => void
  onRejected: (id: number) => void
}

export function PendingTopics({ topics, onApproved, onRejected }: PendingTopicsProps) {
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [errors, setErrors] = useState<Record<number, string>>({})

  if (topics.length === 0) {
    return null
  }

  async function handleApprove(id: number) {
    setProcessingId(id)
    setErrors((prev) => { const next = { ...prev }; delete next[id]; return next })

    try {
      await api.topics.update(id, { status: 'active' })
      onApproved(id)
    } catch (err) {
      setErrors((prev) => ({ ...prev, [id]: err instanceof Error ? err.message : 'Ошибка' }))
    } finally {
      setProcessingId(null)
    }
  }

  async function handleReject(id: number) {
    setProcessingId(id)
    setErrors((prev) => { const next = { ...prev }; delete next[id]; return next })

    try {
      await api.topics.delete(id)
      onRejected(id)
    } catch (err) {
      setErrors((prev) => ({ ...prev, [id]: err instanceof Error ? err.message : 'Ошибка' }))
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <section className="mb-6 rounded-box border border-secondary/30 bg-secondary/5 p-6 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-base-content">
        Предложенные темы
        <span className="badge badge-secondary badge-sm">{topics.length}</span>
      </h2>
      <div className="space-y-2">
        {topics.map((t) => (
          <div key={t.id} className="rounded-box border border-base-300 bg-base-200 p-3">
            <p className="text-sm font-medium text-base-content">{t.title}</p>
            {t.note && <p className="mt-1 text-xs text-base-content/70">{t.note}</p>}
            {errors[t.id] && <p className="mt-1 text-xs text-error">{errors[t.id]}</p>}
            <div className="mt-2 flex gap-2">
              <button
                className="btn btn-primary btn-xs"
                disabled={processingId === t.id}
                onClick={() => void handleApprove(t.id)}
              >
                Принять
              </button>
              <button
                className="btn btn-ghost btn-xs"
                disabled={processingId === t.id}
                onClick={() => void handleReject(t.id)}
              >
                Отклонить
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
