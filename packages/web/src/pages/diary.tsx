import { useState, useEffect, useCallback } from 'react'
import { PageHeader, StatusCallout } from '../components'
import { api, type DiaryEntry } from '../lib/api'

export const DIARY_CONTENT_MAX_LENGTH = 2000

export function isDiaryDraftValid(draft: string): boolean {
  const trimmed = draft.trim()

  return trimmed.length > 0 && trimmed.length <= DIARY_CONTENT_MAX_LENGTH
}

export function DiaryPage() {
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')

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
    if (!isDiaryDraftValid(draft)) return

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

  const handleSaveEdit = async (id: number) => {
    if (!isDiaryDraftValid(editText)) return

    setError(null)

    try {
      const updated = await api.diary.update(id, editText.trim())

      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, content: updated.content } : e)))
      setEditingId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось изменить запись')
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
          maxLength={DIARY_CONTENT_MAX_LENGTH}
          onChange={(e) => setDraft(e.target.value)}
        />

        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-base-content/50">
            {draft.length} / {DIARY_CONTENT_MAX_LENGTH}
          </span>
          <button
            className={`btn btn-primary ${saving || !isDiaryDraftValid(draft) ? 'btn-disabled' : ''}`}
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
              {editingId === entry.id ? (
                <>
                  <textarea
                    className="textarea textarea-bordered min-h-28 w-full bg-base-200"
                    value={editText}
                    maxLength={DIARY_CONTENT_MAX_LENGTH}
                    onChange={(e) => setEditText(e.target.value)}
                  />
                  <span className="mt-1 block text-xs text-base-content/50">
                    {editText.length} / {DIARY_CONTENT_MAX_LENGTH}
                  </span>
                </>
              ) : (
                <p className="whitespace-pre-wrap font-serif text-lg leading-relaxed text-base-content">
                  {entry.content}
                </p>
              )}
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-base-content/50">
                  {new Date(entry.createdAt).toLocaleString()}
                </p>
                <div className="flex items-center gap-1">
                  {editingId === entry.id ? (
                    <>
                      <button
                        className={`btn btn-ghost btn-sm text-success ${!isDiaryDraftValid(editText) ? 'btn-disabled' : ''}`}
                        onClick={() => void handleSaveEdit(entry.id)}
                      >
                        Сохранить
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>
                        Отмена
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setEditingId(entry.id)
                        setEditText(entry.content)
                      }}
                    >
                      Изменить
                    </button>
                  )}
                  <button
                    className="btn btn-ghost btn-sm text-error"
                    onClick={() => void handleDelete(entry.id)}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
