import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'

interface InboxRow {
  storyId: number
  title: string
  status: string
  readyAt: string | null
}

interface RowFormState {
  rating: number
  note: string
  submitting: boolean
  done: boolean
  error: string | null
}

export default function AdminAwaitingFeedbackInbox() {
  const [rows, setRows] = useState<InboxRow[]>([])
  const [loading, setLoading] = useState(true)
  const [state, setState] = useState<Record<number, RowFormState>>({})

  const load = useCallback(() => {
    setLoading(true)
    api.admin.awaitingFeedback().then(setRows).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  function getRow(id: number): RowFormState {
    return state[id] ?? { rating: 0, note: '', submitting: false, done: false, error: null }
  }

  function update(id: number, patch: Partial<RowFormState>) {
    setState((s) => ({ ...s, [id]: { ...getRow(id), ...patch } }))
  }

  async function submit(id: number) {
    const row = getRow(id)
    if (row.rating < 1 || row.rating > 5) {
      update(id, { error: 'Поставьте оценку 1–5' })
      return
    }

    update(id, { submitting: true, error: null })
    try {
      await api.vfm.submit(id, { rating: row.rating, ...(row.note.trim() ? { note: row.note.trim() } : {}) })
      update(id, { done: true, submitting: false })
      setRows((rs) => rs.filter((r) => r.storyId !== id))
    } catch (e) {
      update(id, { error: e instanceof Error ? e.message : 'Не удалось сохранить', submitting: false })
    }
  }

  if (loading) return <p className="text-sm text-base-content/60">Загрузка…</p>
  if (rows.length === 0) return <p className="text-sm text-base-content/60">Все истории оценены.</p>

  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const row = getRow(r.storyId)
        return (
          <li key={r.storyId} id={`story-${r.storyId}`} className="border border-base-300 rounded p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="font-medium">{r.title}</p>
                <p className="text-xs text-base-content/60">
                  {r.status} • {r.readyAt ? new Date(r.readyAt).toLocaleDateString() : '—'}
                </p>
              </div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`btn btn-xs ${row.rating === n ? 'btn-primary' : 'btn-ghost border border-base-300'}`}
                    onClick={() => update(r.storyId, { rating: n })}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              className="textarea textarea-bordered w-full"
              rows={2}
              placeholder="Стоило ли своих денег? (можно надиктовать)"
              value={row.note}
              onChange={(e) => update(r.storyId, { note: e.target.value })}
            />
            {row.error && <p className="text-sm text-error mt-1">{row.error}</p>}
            <div className="text-right mt-2">
              <button
                className="btn btn-sm btn-primary"
                disabled={row.submitting || row.rating < 1}
                onClick={() => submit(r.storyId)}
              >
                {row.submitting ? 'Сохраняю…' : 'Отправить'}
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
