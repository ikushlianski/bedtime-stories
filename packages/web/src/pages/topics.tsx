import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, StatusCallout, TopicNudges, PendingTopics } from '../components'
import { TopicCombosPanel } from '../components/topic-combos-panel'
import { api, type Topic, type StoryGroup } from '../lib/api'

const GLOBAL_VALUE = ''

export function TopicsPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<Topic[]>([])
  const [universes, setUniverses] = useState<StoryGroup[]>([])
  const [draftTitle, setDraftTitle] = useState('')
  const [draftNote, setDraftNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editNote, setEditNote] = useState('')
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [targetUniverse, setTargetUniverse] = useState<string>(GLOBAL_VALUE)
  const [generatingKey, setGeneratingKey] = useState<string | null>(null)

  const fetchAll = useCallback(() => {
    setLoading(true)

    Promise.all([api.topics.list('all'), api.universes.list()])
      .then(([tops, unis]) => {
        setItems(tops)
        setUniverses(unis)

        if (unis.length > 0) {
          setTargetUniverse((prev) => (prev === GLOBAL_VALUE ? String(unis[0]!.id) : prev))
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить темы'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const targetUniverseId = targetUniverse === GLOBAL_VALUE ? null : Number(targetUniverse)

  const handleCreate = async () => {
    if (draftTitle.trim().length === 0) return

    setSaving(true)
    setError(null)

    try {
      const created = await api.topics.create({
        title: draftTitle.trim(),
        note: draftNote.trim() || null,
      })

      setItems((prev) => [created, ...prev])
      setDraftTitle('')
      setDraftNote('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить тему')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await api.topics.delete(id)
      setItems((prev) => prev.filter((t) => t.id !== id))
      setSelectedIds((prev) => prev.filter((sid) => sid !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить тему')
    }
  }

  const handleSaveEdit = async (id: number) => {
    if (editTitle.trim().length === 0) return

    try {
      const updated = await api.topics.update(id, { title: editTitle.trim(), note: editNote.trim() || null })

      setItems((prev) => prev.map((t) => (t.id === id ? { ...t, title: updated.title, note: updated.note } : t)))
      setEditingId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось изменить тему')
    }
  }

  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]))
  }

  const handleGenerate = async (topicIds: number[], seed: string | undefined, key: string) => {
    if (targetUniverseId === null) {
      setError('Выбери вселенную, в которой создать историю')
      return
    }

    setGeneratingKey(key)
    setError(null)

    try {
      const { storyId } = await api.topics.generate({
        topicIds,
        universeId: targetUniverseId,
        ...(seed ? { seed } : {}),
      })

      navigate(`/stories/${storyId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать историю')
      setGeneratingKey(null)
    }
  }

  const canGenerateManual = selectedIds.length >= 2 && selectedIds.length <= 3
  const pendingTopics = items.filter((t) => t.status === 'suggested')
  const activeTopics = items.filter((t) => t.status !== 'suggested')

  return (
    <div>
      <PageHeader
        eyebrow="Темы"
        title="Темы для будущих историй"
        description="Собирай то, что хочешь однажды объяснить или показать сыну. Ниже можно вручную собрать 2–3 темы в одну историю прямо сейчас. А ещё сюжетник сам подмешивает 2–3 темы из этого банка почти в каждую новую историю — то, что реально вошло в историю, отмечается здесь автоматически."
      />

      <PendingTopics
        topics={pendingTopics}
        onApproved={(id) => setItems((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'active' } : t)))}
        onRejected={(id) => setItems((prev) => prev.filter((t) => t.id !== id))}
      />

      <TopicNudges topics={activeTopics} universeId={targetUniverseId} />

      <section className="mb-6 rounded-box border border-base-300 bg-base-100 p-6 shadow-sm">
        <input
          className="input input-bordered w-full bg-base-200"
          placeholder="Тема: например, «Как справляться с проигрышем»"
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
        />
        <textarea
          className="textarea textarea-bordered mt-3 min-h-20 w-full bg-base-200"
          placeholder="Заметка (необязательно): что именно хочется донести…"
          value={draftNote}
          onChange={(e) => setDraftNote(e.target.value)}
        />
        <div className="mt-3 flex justify-end">
          <button
            className={`btn btn-primary btn-sm ${saving || draftTitle.trim().length === 0 ? 'btn-disabled' : ''}`}
            onClick={() => void handleCreate()}
          >
            {saving ? 'Сохраняю…' : 'Добавить тему'}
          </button>
        </div>
      </section>

      <section className="mb-6 rounded-box border border-primary/30 bg-primary/5 p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-base-content">Создать историю из тем</h2>

        <label className="form-control mb-4 max-w-xs">
          <span className="label-text mb-1 text-xs text-base-content/60">Вселенная для истории</span>
          <select
            className="select select-bordered select-sm bg-base-200"
            value={targetUniverse}
            onChange={(e) => setTargetUniverse(e.target.value)}
          >
            {universes.length === 0 && <option value={GLOBAL_VALUE}>Нет вселенных</option>}
            {universes.map((u) => (
              <option key={u.id} value={String(u.id)}>
                {u.name}
              </option>
            ))}
          </select>
        </label>

        <TopicCombosPanel
          topics={activeTopics}
          targetUniverseId={targetUniverseId}
          onGenerate={(topicIds, seed) => handleGenerate(topicIds, seed, `combo-${topicIds.join('-')}`)}
          generatingKey={generatingKey}
        />

        <div className="mt-5 border-t border-base-300 pt-4">
          <p className="mb-2 text-sm text-base-content/70">
            …или выбери 2–3 темы вручную из списка ниже и создай историю из них.
          </p>
          <button
            className={`btn btn-secondary btn-sm ${!canGenerateManual || generatingKey !== null ? 'btn-disabled' : ''}`}
            onClick={() => void handleGenerate(selectedIds, undefined, 'manual')}
          >
            {generatingKey === 'manual' ? 'Создаю…' : `Сгенерировать из выбранных (${selectedIds.length})`}
          </button>
        </div>
      </section>

      {error && (
        <div className="mb-4">
          <StatusCallout tone="error" title="Ошибка" message={error} />
        </div>
      )}

      {loading ? (
        <StatusCallout title="Загрузка" message="Получаем темы…" />
      ) : activeTopics.length === 0 ? (
        <StatusCallout title="Пока нет тем." message="Добавь первое, что хочешь однажды рассказать сыну." />
      ) : (
        <ul className="space-y-3">
          {activeTopics.map((topic) => (
            <li key={topic.id} className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm mt-1"
                  checked={selectedIds.includes(topic.id)}
                  onChange={() => toggleSelected(topic.id)}
                />

                <div className="min-w-0 flex-1">
                  {editingId === topic.id ? (
                    <>
                      <input
                        className="input input-bordered input-sm w-full bg-base-200"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                      />
                      <textarea
                        className="textarea textarea-bordered mt-2 min-h-16 w-full bg-base-200"
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                      />
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-base-content">{topic.title}</p>
                      {topic.note && <p className="mt-1 text-sm text-base-content/70">{topic.note}</p>}
                    </>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {topic.usedCount > 0 && (
                      <span className="badge badge-ghost badge-sm">в {topic.usedCount} историях</span>
                    )}

                    <div className="ml-auto flex items-center gap-1">
                      {editingId === topic.id ? (
                        <>
                          <button className="btn btn-ghost btn-xs text-success" onClick={() => void handleSaveEdit(topic.id)}>
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
                            setEditingId(topic.id)
                            setEditTitle(topic.title)
                            setEditNote(topic.note ?? '')
                          }}
                        >
                          Изменить
                        </button>
                      )}

                      <button className="btn btn-ghost btn-xs text-error" onClick={() => void handleDelete(topic.id)}>
                        Удалить
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
