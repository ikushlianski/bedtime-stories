import { useState, useEffect, useCallback } from 'react'
import { PageHeader, StatusCallout } from '../components'
import { api, type Fragment, type StoryGroup } from '../lib/api'

const GLOBAL_VALUE = ''

export function universeName(universes: StoryGroup[], universeId: number | null): string {
  if (universeId === null) return 'Все вселенные'

  return universes.find((u) => u.id === universeId)?.name ?? `Вселенная #${universeId}`
}

export function FragmentsPage() {
  const [items, setItems] = useState<Fragment[]>([])
  const [universes, setUniverses] = useState<StoryGroup[]>([])
  const [draft, setDraft] = useState('')
  const [draftUniverse, setDraftUniverse] = useState<string>(GLOBAL_VALUE)
  const [draftRank, setDraftRank] = useState('0')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')

  const fetchAll = useCallback(() => {
    setLoading(true)

    Promise.all([api.fragments.list(), api.universes.list()])
      .then(([frags, unis]) => {
        setItems(frags)
        setUniverses(unis)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить фрагменты'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const handleCreate = async () => {
    if (draft.trim().length === 0) return

    setSaving(true)
    setError(null)

    try {
      const created = await api.fragments.create({
        text: draft.trim(),
        universeId: draftUniverse === GLOBAL_VALUE ? null : Number(draftUniverse),
        rank: Number.parseInt(draftRank, 10) || 0,
      })

      setItems((prev) => [created, ...prev])
      setDraft('')
      setDraftRank('0')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить фрагмент')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await api.fragments.delete(id)
      setItems((prev) => prev.filter((f) => f.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить фрагмент')
    }
  }

  const handleRankChange = async (frag: Fragment, rank: number) => {
    try {
      const updated = await api.fragments.update(frag.id, { rank })

      setItems((prev) =>
        prev
          .map((f) => (f.id === frag.id ? { ...f, rank: updated.rank } : f))
          .sort((a, b) => b.rank - a.rank),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось изменить приоритет')
    }
  }

  const handleSaveEdit = async (id: number) => {
    if (editText.trim().length === 0) return

    try {
      const updated = await api.fragments.update(id, { text: editText.trim() })

      setItems((prev) => prev.map((f) => (f.id === id ? { ...f, text: updated.text } : f)))
      setEditingId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось изменить фрагмент')
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Фрагменты"
        title="Фрагменты для историй"
        description="Маленькие забавные, тёплые или поучительные детали, которые ты хочешь иногда видеть в историях. При создании каждой истории агент может органично вплести один подходящий фрагмент — но никогда не строит сюжет вокруг него. Чем выше приоритет, тем охотнее фрагмент будет выбран."
      />

      <section className="mb-6 rounded-box border border-base-300 bg-base-100 p-6 shadow-sm">
        <textarea
          className="textarea textarea-bordered min-h-24 w-full bg-base-200"
          placeholder="Например: пёс, который чихает только по вторникам…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
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
            className={`btn btn-primary btn-sm ml-auto ${saving || draft.trim().length === 0 ? 'btn-disabled' : ''}`}
            onClick={() => void handleCreate()}
          >
            {saving ? 'Сохраняю...' : 'Добавить фрагмент'}
          </button>
        </div>
      </section>

      {error && (
        <div className="mb-4">
          <StatusCallout tone="error" title="Ошибка" message={error} />
        </div>
      )}

      {loading ? (
        <StatusCallout title="Загрузка" message="Получаем фрагменты..." />
      ) : items.length === 0 ? (
        <StatusCallout title="Пока нет фрагментов." message="Добавь первую забавную деталь." />
      ) : (
        <ul className="space-y-3">
          {items.map((frag) => (
            <li
              key={frag.id}
              className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm"
            >
              {editingId === frag.id ? (
                <textarea
                  className="textarea textarea-bordered min-h-20 w-full bg-base-200"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                />
              ) : (
                <p className="whitespace-pre-wrap font-serif text-lg leading-relaxed text-base-content">
                  {frag.text}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="badge badge-ghost badge-sm">{universeName(universes, frag.universeId)}</span>

                {frag.usedCount > 0 && (
                  <span className="badge badge-warning badge-sm">использован {frag.usedCount}×</span>
                )}

                <div className="ml-auto flex items-center gap-1">
                  <span className="text-xs text-base-content/50">приоритет</span>
                  <input
                    type="number"
                    className="input input-bordered input-xs w-16 bg-base-200"
                    defaultValue={frag.rank}
                    onBlur={(e) => {
                      const next = Number.parseInt(e.target.value, 10) || 0
                      if (next !== frag.rank) void handleRankChange(frag, next)
                    }}
                  />

                  {editingId === frag.id ? (
                    <>
                      <button className="btn btn-ghost btn-xs text-success" onClick={() => void handleSaveEdit(frag.id)}>
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
                        setEditingId(frag.id)
                        setEditText(frag.text)
                      }}
                    >
                      Изменить
                    </button>
                  )}

                  <button className="btn btn-ghost btn-xs text-error" onClick={() => void handleDelete(frag.id)}>
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
