import { useState, useEffect, useRef } from 'react'
import { api, type CreateStoryInput, type StoryGroup, type LiveTopicSuggestion } from '../lib/api'
import {
  validateCreateStoryForm,
  buildAccumulatedSeed,
  MAX_UNIVERSES_PER_STORY,
  type CreateStoryFormState,
} from './create-story-form'
import FormField from './form-field'
import { STORY_STRUCTURES } from '@bedtime/core/pipeline/stages/story-structures'
import { CHARACTER_LENSES } from '@bedtime/core/pipeline/stages/character-lenses'

const LIVE_TOPIC_SUGGESTION_DEBOUNCE_MS = 700
const LIVE_TOPIC_SUGGESTION_MIN_LENGTH = 20

interface CreateStoryModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (input: CreateStoryInput) => Promise<void>
  onSeriesCreated?: (count: number) => void
  initialSeed?: string
  initialGroupId?: number | null
}

const LAST_UNIVERSE_KEY = 'create-story-last-universe-id'

function toDisplayLabel(title: string): string {
  return title.charAt(0) + title.slice(1).toLowerCase()
}

function loadLastUniverseIds(): number[] {
  try {
    const raw = localStorage.getItem(LAST_UNIVERSE_KEY)

    if (!raw) return []

    const parsed: unknown = JSON.parse(raw)

    if (Array.isArray(parsed)) return parsed.filter((id): id is number => typeof id === 'number')

    if (typeof parsed === 'number') return [parsed]

    return []
  } catch {
    return []
  }
}

function saveLastUniverseIds(ids: number[]) {
  try {
    if (ids.length === 0) {
      localStorage.removeItem(LAST_UNIVERSE_KEY)
    } else {
      localStorage.setItem(LAST_UNIVERSE_KEY, JSON.stringify(ids))
    }
  } catch {
  }
}

function CreateStoryModal({ open, onClose, onSubmit, onSeriesCreated, initialSeed = '', initialGroupId = null }: CreateStoryModalProps) {
  const [form, setForm] = useState<CreateStoryFormState>({
    seed: initialSeed,
    groupIds: initialGroupId != null ? [initialGroupId] : loadLastUniverseIds(),
    structureKey: null,
    lensKey: null,
    manualTopicIds: [],
  })
  const [contextMessages, setContextMessages] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [creatingSeries, setCreatingSeries] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [universes, setUniverses] = useState<StoryGroup[]>([])
  const [showCreateUniverse, setShowCreateUniverse] = useState(false)
  const [newUniverseName, setNewUniverseName] = useState('')
  const [creatingUniverse, setCreatingUniverse] = useState(false)
  const [liveTopicSuggestionsEnabled, setLiveTopicSuggestionsEnabled] = useState(false)
  const [suggestedTopics, setSuggestedTopics] = useState<LiveTopicSuggestion[]>([])
  const [suggestingTopics, setSuggestingTopics] = useState(false)
  const topicCacheRef = useRef<Map<number, LiveTopicSuggestion>>(new Map())

  useEffect(() => {
    if (open) {
      setForm({
        seed: initialSeed,
        groupIds: initialGroupId != null ? [initialGroupId] : loadLastUniverseIds(),
        structureKey: null,
        lensKey: null,
        manualTopicIds: [],
      })
      setContextMessages([])
      setError(null)
      setShowCreateUniverse(false)
      setNewUniverseName('')
      setSuggestedTopics([])
      setSuggestingTopics(false)
      topicCacheRef.current = new Map()

      api.universes.list().then((list) => {
        setUniverses(list)

        if (list.length === 0) {
          setShowCreateUniverse(true)
        }
      }).catch(() => setUniverses([]))

      api.settings
        .get()
        .then((data) => setLiveTopicSuggestionsEnabled(data.featureFlags?.liveTopicSuggestions ?? false))
        .catch(() => setLiveTopicSuggestionsEnabled(false))
    }
  }, [open, initialSeed, initialGroupId])

  const outlineForSuggestions = buildAccumulatedSeed(contextMessages, form.seed)
  const primaryUniverseId = form.groupIds[0]

  useEffect(() => {
    if (!open || !liveTopicSuggestionsEnabled) return
    if (primaryUniverseId === undefined) return
    if (outlineForSuggestions.trim().length < LIVE_TOPIC_SUGGESTION_MIN_LENGTH) return

    const controller = new AbortController()

    const timer = setTimeout(() => {
      setSuggestingTopics(true)

      api.topicLiveSuggestions
        .suggest(primaryUniverseId, outlineForSuggestions, controller.signal)
        .then((result) => {
          for (const topic of result.suggestions) {
            topicCacheRef.current.set(topic.id, topic)
          }
          setSuggestedTopics(result.suggestions)
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === 'AbortError') return
          console.warn('Live topic suggestion failed:', err)
        })
        .finally(() => setSuggestingTopics(false))
    }, LIVE_TOPIC_SUGGESTION_DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [open, liveTopicSuggestionsEnabled, primaryUniverseId, outlineForSuggestions])

  function toggleManualTopic(topicId: number) {
    setForm((prev) => ({
      ...prev,
      manualTopicIds: prev.manualTopicIds.includes(topicId)
        ? prev.manualTopicIds.filter((id) => id !== topicId)
        : [...prev.manualTopicIds, topicId],
    }))
  }

  if (!open) {
    return null
  }

  const displayedTopicChips = [
    ...suggestedTopics,
    ...form.manualTopicIds
      .filter((id) => !suggestedTopics.some((t) => t.id === id))
      .map((id) => topicCacheRef.current.get(id))
      .filter((t): t is LiveTopicSuggestion => t !== undefined),
  ]

  function addContextMessage() {
    const message = form.seed.trim()

    if (!message) return

    setContextMessages((prev) => [...prev, message])
    setForm((prev) => ({ ...prev, seed: '' }))
  }

  function removeContextMessage(index: number) {
    setContextMessages((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit() {
    const seed = buildAccumulatedSeed(contextMessages, form.seed)
    const validation = validateCreateStoryForm({ ...form, seed })

    if (!validation.valid) {
      setError(validation.reason)
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      await onSubmit(validation.input)
      setForm({ seed: '', groupIds: [], structureKey: null, lensKey: null, manualTopicIds: [] })
      setContextMessages([])
      setSuggestedTopics([])
      topicCacheRef.current = new Map()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось создать историю')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCreateUniverse() {
    const name = newUniverseName.trim()

    if (!name) return

    setCreatingUniverse(true)

    try {
      const created = await api.universes.create({ name, systemPrompt: '.' })

      setUniverses((prev) => [...prev, created])

      setForm((prev) => {
        const groupIds = prev.groupIds.includes(created.id) ? prev.groupIds : [...prev.groupIds, created.id]
        saveLastUniverseIds(groupIds)
        return { ...prev, groupIds }
      })
      setShowCreateUniverse(false)
      setNewUniverseName('')
    } catch {
      setError('Не удалось создать вселенную')
    } finally {
      setCreatingUniverse(false)
    }
  }

  async function handleCreateSeries() {
    const seed = buildAccumulatedSeed(contextMessages, form.seed)
    const validation = validateCreateStoryForm({ ...form, seed })

    if (!validation.valid) {
      setError(validation.reason)
      return
    }

    if (form.groupIds.length > 1) {
      setError('Серия пока поддерживает только одну вселенную — оставь только одну галочку')
      return
    }

    const [primaryGroupId] = form.groupIds

    if (!('seed' in validation.input) || primaryGroupId === undefined) {
      setError('Укажи затравку и вселенную')
      return
    }

    setCreatingSeries(true)
    setError(null)

    try {
      const result = await api.stories.createSeries({ seed, groupId: primaryGroupId })

      setForm({ seed: '', groupIds: [], structureKey: null, lensKey: null, manualTopicIds: [] })
      setContextMessages([])
      setSuggestedTopics([])
      topicCacheRef.current = new Map()
      onSeriesCreated?.(result.stories.length)
      onClose()
    } catch (seriesError) {
      setError(seriesError instanceof Error ? seriesError.message : 'Не удалось создать серию историй')
    } finally {
      setCreatingSeries(false)
    }
  }

  const canSubmit =
    !submitting && !creatingSeries && validateCreateStoryForm({ ...form, seed: buildAccumulatedSeed(contextMessages, form.seed) }).valid

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-2xl border border-base-300 bg-base-200 shadow-2xl">
        <h2 className="font-serif text-3xl text-base-content">Новая история</h2>

        <div className="mt-5 space-y-5">
          <FormField label="Вселенная" hint="Необязательно. Можно выбрать несколько — их персонажи и стиль смешаются в истории.">
            {showCreateUniverse ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input input-bordered flex-1 bg-base-200"
                  placeholder="Название вселенной..."
                  value={newUniverseName}
                  onChange={(e) => setNewUniverseName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleCreateUniverse()

                    if (e.key === 'Escape') {
                      setShowCreateUniverse(false)
                      setNewUniverseName('')
                    }
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!newUniverseName.trim() || creatingUniverse}
                  onClick={() => void handleCreateUniverse()}
                >
                  {creatingUniverse ? '...' : 'Создать'}
                </button>
                {universes.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setShowCreateUniverse(false)
                      setNewUniverseName('')
                    }}
                  >
                    Отмена
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-1 rounded-lg border border-base-300 bg-base-200 p-2 max-h-48 overflow-y-auto">
                  {universes.length === 0 && (
                    <p className="px-1 py-1 text-sm text-base-content/50">Нет ни одной вселенной</p>
                  )}
                  {universes.map((u) => {
                    const checked = form.groupIds.includes(u.id)
                    const atLimit = !checked && form.groupIds.length >= MAX_UNIVERSES_PER_STORY

                    return (
                      <label
                        key={u.id}
                        className={`label cursor-pointer justify-start gap-2 rounded px-1 py-1 hover:bg-base-300 ${atLimit ? 'opacity-50' : ''}`}
                      >
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm"
                          checked={checked}
                          disabled={atLimit}
                          onChange={(event) => {
                            const groupIds = event.target.checked
                              ? [...form.groupIds, u.id]
                              : form.groupIds.filter((id) => id !== u.id)

                            saveLastUniverseIds(groupIds)
                            setForm((prev) => ({ ...prev, groupIds }))
                          }}
                        />
                        <span className="label-text">{u.name}</span>
                      </label>
                    )
                  })}
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm self-start text-primary"
                  onClick={() => setShowCreateUniverse(true)}
                >
                  + Новая
                </button>
              </div>
            )}
          </FormField>

          <FormField
            label="Затравка"
            hint="Ситуация, эмоция или испытание, которое сейчас актуально для Саши. Можно добавить несколько сообщений по очереди — нажми «Добавить» после каждого — или просто написать всё сразу и нажать «Создать историю»."
            required
          >
            {contextMessages.length > 0 && (
              <ul className="mb-3 space-y-2">
                {contextMessages.map((message, index) => (
                  <li
                    key={index}
                    className="flex items-start justify-between gap-2 rounded-lg bg-base-300/50 px-3 py-2 text-sm text-base-content/80"
                  >
                    <span className="whitespace-pre-wrap">{message}</span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs shrink-0"
                      aria-label="Убрать сообщение"
                      onClick={() => removeContextMessage(index)}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <textarea
                className="textarea textarea-bordered min-h-40 w-full bg-base-200"
                placeholder="Герой нервничает: первый раз ночевать не дома..."
                value={form.seed}
                onChange={(event) => setForm((prev) => ({ ...prev, seed: event.target.value }))}
                autoFocus
              />
              <button
                type="button"
                className="btn btn-outline btn-sm self-start"
                disabled={!form.seed.trim()}
                onClick={addContextMessage}
              >
                Добавить
              </button>
            </div>
            {liveTopicSuggestionsEnabled && (suggestingTopics || displayedTopicChips.length > 0) && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {suggestingTopics && (
                  <span className="text-xs text-base-content/50">Подбираем темы...</span>
                )}
                {displayedTopicChips.map((topic) => {
                  const selected = form.manualTopicIds.includes(topic.id)

                  return (
                    <button
                      key={topic.id}
                      type="button"
                      className={`badge badge-lg cursor-pointer ${selected ? 'badge-primary' : 'badge-outline'}`}
                      title={topic.note ?? undefined}
                      onClick={() => toggleManualTopic(topic.id)}
                    >
                      {topic.title}
                    </button>
                  )
                })}
              </div>
            )}
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              label="Структура сюжета"
              hint="По умолчанию — авто-ротация структур. Действует только для «Создать историю», не для «Создать серию»."
            >
              <select
                className="select select-bordered w-full bg-base-200"
                value={form.structureKey ?? ''}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, structureKey: event.target.value || null }))
                }
              >
                <option value="">Авто</option>
                {STORY_STRUCTURES.map((structure) => (
                  <option key={structure.key} value={structure.key} title={structure.description}>
                    {toDisplayLabel(structure.title)}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField
              label="Ракурс на персонажей"
              hint="По умолчанию — авто-ротация ракурсов. Действует только для «Создать историю», не для «Создать серию»."
            >
              <select
                className="select select-bordered w-full bg-base-200"
                value={form.lensKey ?? ''}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, lensKey: event.target.value || null }))
                }
              >
                <option value="">Авто</option>
                {CHARACTER_LENSES.map((lens) => (
                  <option key={lens.key} value={lens.key} title={lens.guidance}>
                    {toDisplayLabel(lens.title)}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

        </div>

        {error && <p className="mt-3 text-sm text-error">{error}</p>}

        <div className="modal-action flex-wrap">
          <button className="btn btn-ghost" onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className={`btn btn-outline ${canSubmit ? '' : 'btn-disabled'}`}
            onClick={() => void handleCreateSeries()}
            title="Сгенерировать 3 разных черновика сюжета на основе затравки"
          >
            {creatingSeries ? 'Генерируем серию...' : 'Создать серию'}
          </button>
          <button
            className={`btn btn-primary ${canSubmit ? '' : 'btn-disabled'}`}
            onClick={() => void handleSubmit()}
          >
            {submitting ? 'Создаём...' : 'Создать историю'}
          </button>
        </div>
      </div>
      <button className="modal-backdrop" onClick={onClose}>
        закрыть
      </button>
    </dialog>
  )
}

export default CreateStoryModal
