import { useState, useEffect, useCallback } from 'react'
import { PageHeader, StatusCallout } from '../components'
import { api, type Word, type StoryGroup } from '../lib/api'

const GLOBAL_VALUE = ''

export function universeName(universes: StoryGroup[], universeId: number | null): string {
  if (universeId === null) return 'Все вселенные'

  return universes.find((u) => u.id === universeId)?.name ?? `Вселенная #${universeId}`
}

export function WordsPage() {
  const [items, setItems] = useState<Word[]>([])
  const [universes, setUniverses] = useState<StoryGroup[]>([])
  const [draftWord, setDraftWord] = useState('')
  const [draftHint, setDraftHint] = useState('')
  const [draftUniverse, setDraftUniverse] = useState<string>(GLOBAL_VALUE)
  const [draftRank, setDraftRank] = useState('0')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editWord, setEditWord] = useState('')
  const [editHint, setEditHint] = useState('')

  const fetchAll = useCallback(() => {
    setLoading(true)

    Promise.all([api.words.list(), api.universes.list()])
      .then(([wrds, unis]) => {
        setItems(wrds)
        setUniverses(unis)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить слова'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const handleCreate = async () => {
    if (draftWord.trim().length === 0) return

    setSaving(true)
    setError(null)

    try {
      const created = await api.words.create({
        word: draftWord.trim(),
        hint: draftHint.trim().length > 0 ? draftHint.trim() : null,
        universeId: draftUniverse === GLOBAL_VALUE ? null : Number(draftUniverse),
        rank: Number.parseInt(draftRank, 10) || 0,
      })

      setItems((prev) => [created, ...prev])
      setDraftWord('')
      setDraftHint('')
      setDraftRank('0')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить слово')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await api.words.delete(id)
      setItems((prev) => prev.filter((w) => w.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить слово')
    }
  }

  const handleRankChange = async (item: Word, rank: number) => {
    try {
      const updated = await api.words.update(item.id, { rank })

      setItems((prev) =>
        prev
          .map((w) => (w.id === item.id ? { ...w, rank: updated.rank } : w))
          .sort((a, b) => b.rank - a.rank),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось изменить приоритет')
    }
  }

  const handleSaveEdit = async (id: number) => {
    if (editWord.trim().length === 0) return

    try {
      const updated = await api.words.update(id, {
        word: editWord.trim(),
        hint: editHint.trim().length > 0 ? editHint.trim() : null,
      })

      setItems((prev) =>
        prev.map((w) => (w.id === id ? { ...w, word: updated.word, hint: updated.hint } : w)),
      )
      setEditingId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось изменить слово')
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Слова"
        title="Слова для историй"
        description="Слова, которые ты хочешь, чтобы ребёнок выучил. Агент иногда органично вплетает подходящие в истории — только там, где по смыслу уместно, правильно и по-детски понятно. Чем выше приоритет, тем охотнее слово будет выбрано."
      />

      <section className="mb-6 rounded-box border border-base-300 bg-base-100 p-6 shadow-sm">
        <input
          className="input input-bordered w-full bg-base-200"
          placeholder="Например: щедрость"
          value={draftWord}
          onChange={(e) => setDraftWord(e.target.value)}
        />

        <input
          className="input input-bordered mt-3 w-full bg-base-200"
          placeholder="Подсказка (необязательно): готовность делиться, отдавать другим"
          value={draftHint}
          onChange={(e) => setDraftHint(e.target.value)}
        />

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="form-control">
            <span className="label-text mb-1 text-xs text-base-content/60">Вселенная</span>
            <select
              className="select select-bordered select-sm bg-base-200"
              value={draftUniverse}
              onChange={(e) => setDraftUniverse(e.target.value)}
            >
              <option value={GLOBAL_VALUE}>Все вселенные</option>
              {universes.map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>

          <label className="form-control">
            <span className="label-text mb-1 text-xs text-base-content/60">Приоритет</span>
            <input
              type="number"
              className="input input-bordered input-sm w-24 bg-base-200"
              value={draftRank}
              onChange={(e) => setDraftRank(e.target.value)}
            />
          </label>

          <button
            className={`btn btn-primary btn-sm ml-auto ${saving || draftWord.trim().length === 0 ? 'btn-disabled' : ''}`}
            onClick={() => void handleCreate()}
          >
            {saving ? 'Сохраняю...' : 'Добавить слово'}
          </button>
        </div>
      </section>

      {error && (
        <div className="mb-4">
          <StatusCallout tone="error" title="Ошибка" message={error} />
        </div>
      )}

      {loading ? (
        <StatusCallout title="Загрузка" message="Получаем слова..." />
      ) : items.length === 0 ? (
        <StatusCallout title="Пока нет слов." message="Добавь первое целевое слово." />
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm"
            >
              {editingId === item.id ? (
                <div className="space-y-2">
                  <input
                    className="input input-bordered w-full bg-base-200"
                    value={editWord}
                    onChange={(e) => setEditWord(e.target.value)}
                  />
                  <input
                    className="input input-bordered w-full bg-base-200"
                    placeholder="Подсказка (необязательно)"
                    value={editHint}
                    onChange={(e) => setEditHint(e.target.value)}
                  />
                </div>
              ) : (
                <div>
                  <p className="font-serif text-lg font-semibold leading-relaxed text-base-content">
                    {item.word}
                  </p>
                  {item.hint && (
                    <p className="mt-1 text-sm text-base-content/60">{item.hint}</p>
                  )}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="badge badge-ghost badge-sm">{universeName(universes, item.universeId)}</span>

                {item.usedCount > 0 && (
                  <span className="badge badge-warning badge-sm">использовано {item.usedCount}×</span>
                )}

                <div className="ml-auto flex items-center gap-1">
                  <span className="text-xs text-base-content/50">приоритет</span>
                  <input
                    type="number"
                    className="input input-bordered input-xs w-16 bg-base-200"
                    defaultValue={item.rank}
                    onBlur={(e) => {
                      const next = Number.parseInt(e.target.value, 10) || 0
                      if (next !== item.rank) void handleRankChange(item, next)
                    }}
                  />

                  {editingId === item.id ? (
                    <>
                      <button className="btn btn-ghost btn-xs text-success" onClick={() => void handleSaveEdit(item.id)}>
                        Сохранить
                      </button>
                      <button className="btn btn-ghost btn-xs" onClick={() => setEditingId(null)}>
                        Отмена
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => {
                        setEditingId(item.id)
                        setEditWord(item.word)
                        setEditHint(item.hint ?? '')
                      }}
                    >
                      Изменить
                    </button>
                  )}

                  <button className="btn btn-ghost btn-xs text-error" onClick={() => void handleDelete(item.id)}>
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
