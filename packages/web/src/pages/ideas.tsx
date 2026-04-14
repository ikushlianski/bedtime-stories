import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, StatusCallout } from '../components'
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

  useEffect(() => {
    setState(loadState())
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
    navigate(`/?seed=${encodeURIComponent(text)}`)
  }

  const ideas = openIdeas(state)

  return (
    <div>
      <PageHeader
        eyebrow="Inbox"
        title="Story Ideas"
        description="Dump half-baked thoughts here and promote them to full stories when you're ready to run the pipeline."
      />

      <section className="mb-6 rounded-box border border-base-300 bg-base-100 p-6 shadow-sm">
        <textarea
          className="textarea textarea-bordered min-h-28 w-full bg-base-100"
          placeholder="A little dragon who is afraid of fire..."
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <div className="mt-3 flex justify-end">
          <button
            className={`btn btn-primary ${draft.trim().length === 0 ? 'btn-disabled' : ''}`}
            onClick={handleAdd}
          >
            Save idea
          </button>
        </div>
      </section>

      {ideas.length === 0 ? (
        <StatusCallout
          title="No open ideas"
          message="Write down anything that could become a bedtime story — emotions, situations, characters."
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
                  className="btn btn-primary btn-sm"
                  onClick={() => handlePromote(idea.id, idea.text)}
                >
                  Promote to story →
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleDelete(idea.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
