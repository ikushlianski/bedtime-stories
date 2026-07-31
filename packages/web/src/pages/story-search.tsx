import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, StatusCallout } from '../components'
import { api, type StoryGroup, type StorySearchResult } from '../lib/api'

export function StorySearchPage() {
  const [universes, setUniverses] = useState<StoryGroup[]>([])
  const [universeId, setUniverseId] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<StorySearchResult[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.universes
      .list()
      .then((unis) => {
        setUniverses(unis)
        setUniverseId((prev) => prev ?? unis[0]?.id ?? null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить вселенные'))
  }, [])

  const handleSearch = useCallback(async () => {
    if (query.trim().length === 0 || universeId == null) return

    setSearching(true)
    setError(null)

    try {
      const found = await api.stories.search({ q: query.trim(), universeId })
      setResults(found)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось выполнить поиск')
    } finally {
      setSearching(false)
    }
  }, [query, universeId])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Поиск"
        title="Поиск по историям"
        description="Найдите прошлую историю этой вселенной по смыслу, а не по точным словам."
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <select
          className="select select-bordered w-full sm:w-56"
          value={universeId ?? ''}
          onChange={(e) => setUniverseId(e.target.value ? Number(e.target.value) : null)}
        >
          {universes.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>

        <input
          type="text"
          className="input input-bordered w-full"
          placeholder="Например: история про дружбу и дележ игрушками"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSearch()
          }}
        />

        <button
          className="btn btn-primary shrink-0"
          onClick={handleSearch}
          disabled={searching || query.trim().length === 0 || universeId == null}
        >
          {searching ? 'Ищу…' : 'Искать'}
        </button>
      </div>

      {error && <StatusCallout tone="error" message={error} />}

      {universes.length === 0 && !error && (
        <StatusCallout tone="info" message="Сначала создайте вселенную, чтобы искать по её историям." />
      )}

      {results !== null && results.length === 0 && !searching && (
        <StatusCallout tone="info" message="Ничего не нашлось в этой вселенной по такому запросу." />
      )}

      {results !== null && results.length > 0 && (
        <ul className="space-y-3">
          {results.map((r) => (
            <li key={r.storyId} className="rounded-box border border-base-300 bg-base-100 p-4">
              <div className="flex items-center justify-between gap-3">
                <Link to={`/stories/${r.storyId}`} className="font-serif text-lg text-base-content hover:text-primary">
                  {r.title}
                </Link>
                <span className="badge badge-ghost shrink-0">{Math.round(r.similarity * 100)}% совпадение</span>
              </div>
              <p className="mt-2 text-sm text-base-content/70">{r.excerpt}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
