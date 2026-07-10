import { useState } from 'react'
import { api, type Topic, type TopicCombo } from '../lib/api'
import { StatusCallout } from '../components'

interface TopicCombosPanelProps {
  topics: Topic[]
  targetUniverseId: number | null
  onGenerate: (topicIds: number[], seed: string) => Promise<void>
  generatingKey: string | null
}

function comboTitles(combo: TopicCombo, topics: Topic[]): string {
  return combo.topicIds
    .map((id) => topics.find((t) => t.id === id)?.title ?? `#${id}`)
    .join(' + ')
}

export function TopicCombosPanel({ topics, targetUniverseId, onGenerate, generatingKey }: TopicCombosPanelProps) {
  const [combos, setCombos] = useState<TopicCombo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggested, setSuggested] = useState(false)

  const handleSuggest = async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await api.topics.suggestCombos({ universeId: targetUniverseId })
      setCombos(result.combos)
      setSuggested(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось предложить комбинации')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        className={`btn btn-outline btn-sm ${loading || topics.length < 2 ? 'btn-disabled' : ''}`}
        onClick={() => void handleSuggest()}
      >
        {loading ? 'Подбираю…' : 'Предложить комбинации тем'}
      </button>

      {topics.length < 2 && (
        <p className="mt-2 text-xs text-base-content/50">Нужно как минимум 2 темы, чтобы предложить комбинацию.</p>
      )}

      {error && (
        <div className="mt-3">
          <StatusCallout tone="error" title="Ошибка" message={error} />
        </div>
      )}

      {suggested && combos.length === 0 && !loading && !error && (
        <p className="mt-3 text-sm text-base-content/60">Не удалось собрать подходящие комбинации — попробуй ещё раз.</p>
      )}

      {combos.length > 0 && (
        <ul className="mt-4 space-y-3">
          {combos.map((combo, i) => {
            const key = `combo-${combo.topicIds.join('-')}`

            return (
              <li key={i} className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-base-content">{combo.title}</p>
                    <p className="mt-0.5 text-xs text-primary">{comboTitles(combo, topics)}</p>
                  </div>
                  <button
                    className={`btn btn-primary btn-sm ${generatingKey !== null ? 'btn-disabled' : ''}`}
                    onClick={() => void onGenerate(combo.topicIds, combo.seed)}
                  >
                    {generatingKey === key ? 'Создаю…' : 'Сгенерировать'}
                  </button>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-base-content/80">{combo.seed}</p>
                <p className="mt-1 text-xs text-base-content/50">{combo.rationale}</p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
