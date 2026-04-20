import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { FormField, PageHeader, StatusCallout } from '../components'
import { api, type StoryGroup } from '../lib/api'
import {
  EMPTY_STATE,
  addIdea,
  removeIdea,
  setIdeaStatus,
  openIdeas,
  serialize,
  deserialize,
  type IdeasState,
} from './ideas-store'

const STORAGE_KEY = 'bedtime-agent:ideas:v1'
const LAST_UNIVERSE_KEY = 'bedtime-agent:last-universe'

function loadState(): IdeasState {
  if (typeof window === 'undefined') return EMPTY_STATE

  return deserialize(window.localStorage.getItem(STORAGE_KEY))
}

function saveState(state: IdeasState): void {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(STORAGE_KEY, serialize(state))
}

function newIdeaId(): string {
  return `idea-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function IdeasPage() {
  const navigate = useNavigate()
  const [state, setState] = useState<IdeasState>(EMPTY_STATE)
  const [draft, setDraft] = useState('')
  const [universes, setUniverses] = useState<StoryGroup[]>([])
  const [selectedUniverseId, setSelectedUniverseId] = useState<number | null>(() => {
    const stored = localStorage.getItem(LAST_UNIVERSE_KEY)

    return stored ? parseInt(stored, 10) : null
  })

  useEffect(() => {
    setState(loadState())
    api.universes.list().then(setUniverses).catch(() => setUniverses([]))
  }, [])

  const persist = useCallback((next: IdeasState) => {
    setState(next)
    saveState(next)
  }, [])

  const handleAdd = () => {
    if (draft.trim().length === 0) return

    persist(addIdea(state, { id: newIdeaId(), text: draft, createdAt: new Date().toISOString() }))
    setDraft('')
  }

  const handleDelete = (id: string) => {
    persist(removeIdea(state, id))
  }

  const handlePromote = (id: string, text: string) => {
    persist(setIdeaStatus(state, id, 'promoted'))

    const params = new URLSearchParams({ seed: text })

    if (selectedUniverseId !== null) {
      params.set('groupId', String(selectedUniverseId))
      localStorage.setItem(LAST_UNIVERSE_KEY, String(selectedUniverseId))
    } else {
      localStorage.removeItem(LAST_UNIVERSE_KEY)
    }

    navigate(`/?${params.toString()}`)
  }

  const ideas = openIdeas(state)

  return (
    <div>
      <PageHeader
        eyebrow="Входящие"
        title="Идеи для историй"
        description="Записывай сюда незрелые мысли и превращай их в полноценные истории, когда будешь готов запустить конвейер."
      />

      <section className="mb-6 rounded-box border border-base-300 bg-base-100 p-6 shadow-sm">
        <div className="flex flex-col gap-5">
          <FormField label="Идея" hint="Ситуация, эмоция, персонаж — что угодно, что может стать историей." required>
            <textarea
              className="textarea textarea-bordered min-h-28 w-full bg-base-200"
              placeholder="Маленький дракон, который боится огня..."
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
          </FormField>

          {universes.length > 0 && (
            <FormField label="Вселенная">
              <select
                className="select select-bordered w-full bg-base-200"
                value={selectedUniverseId ?? ''}
                onChange={(e) => {
                  const val = e.target.value
                  const id = val === '' ? null : parseInt(val, 10)

                  setSelectedUniverseId(id)

                  if (id !== null) {
                    localStorage.setItem(LAST_UNIVERSE_KEY, String(id))
                  } else {
                    localStorage.removeItem(LAST_UNIVERSE_KEY)
                  }
                }}
              >
                <option value="">Без вселенной</option>
                {universes.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </FormField>
          )}
        </div>

        <div className="mt-3 flex justify-end">
          <button
            className={`btn btn-primary ${draft.trim().length === 0 ? 'btn-disabled' : ''}`}
            onClick={handleAdd}
          >
            Сохранить идею
          </button>
        </div>
      </section>

      {ideas.length === 0 ? (
        <StatusCallout
          title="Идей пока нет"
          message="Запиши всё, что могло бы стать сказкой на ночь — эмоции, ситуации, персонажей."
        />
      ) : (
        <ul className="space-y-3">
          {ideas.map((idea) => (
            <li
              key={idea.id}
              className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm"
            >
              <p className="whitespace-pre-wrap font-serif text-lg leading-relaxed text-base-content">
                {idea.text}
              </p>
              <p className="mt-2 text-xs text-base-content/50">
                {new Date(idea.createdAt).toLocaleString()}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  className="btn btn-primary"
                  onClick={() => handlePromote(idea.id, idea.text)}
                >
                  Превратить в историю →
                </button>
                <button
                  className="btn btn-error btn-sm btn-outline"
                  onClick={() => handleDelete(idea.id)}
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
