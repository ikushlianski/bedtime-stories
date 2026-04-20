import { useState, useEffect, useCallback } from 'react'
import { PageHeader, StatusCallout } from '../components'
import { api, type DiaryEntry } from '../lib/api'

export function DiaryPage() {
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchEntries = useCallback(() => {
    setLoading(true)

    api.diary
      .list()
      .then(setEntries)
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить записи'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  const handleSave = async () => {
    if (draft.trim().length === 0) return

    setSaving(true)
    setError(null)

    try {
      const created = await api.diary.create(draft.trim())

      setEntries((prev) => [created, ...prev])
      setDraft('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить запись')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await api.diary.delete(id)
      setEntries((prev) => prev.filter((e) => e.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить запись')
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Дневник"
        title="Заметки о Саше"
        description="Записывай наблюдения о Саше — что его увлекает, что произошло. Агенты будут учитывать это при создании историй."
      />

      <section className="mb-6 rounded-box border border-base-300 bg-base-100 p-6 shadow-sm">
        <textarea
          className="textarea textarea-bordered min-h-28 w-full bg-base-200"
          placeholder="Сегодня Саша заинтересовался..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />

        <div className="mt-3 flex justify-end">
          <button
            className={`btn btn-primary ${saving || draft.trim().length === 0 ? 'btn-disabled' : ''}`}
            onClick={() => void handleSave()}
          >
            {saving ? 'Сохраняю...' : 'Сохранить'}
          </button>
        </div>
      </section>

      {error && (
        <div className="mb-4">
          <StatusCallout tone="error" title="Ошибка" message={error} />
        </div>
      )}

      {loading ? (
        <StatusCallout title="Загрузка" message="Получаем записи..." />
      ) : entries.length === 0 ? (
        <StatusCallout title="Пока нет заметок." message="Добавь первое наблюдение о Саше." />
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm"
            >
              <p className="whitespace-pre-wrap font-serif text-lg leading-relaxed text-base-content">
                {entry.content}
              </p>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-base-content/50">
                  {new Date(entry.createdAt).toLocaleString()}
                </p>
                <button
                  className="btn btn-ghost btn-sm text-error"
                  onClick={() => void handleDelete(entry.id)}
                >
                  Удалить
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
