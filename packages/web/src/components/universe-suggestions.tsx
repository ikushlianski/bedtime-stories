import { useState } from 'react'
import { api, type UniverseSuggestion, type UniverseCharacter } from '../lib/api'
import SuggestionApprovePicker, { type ApproveTarget } from './suggestion-approve-picker'

interface UniverseSuggestionsProps {
  universeId: number
  suggestions: UniverseSuggestion[]
  characters: UniverseCharacter[]
  onSuggestionsChange: (suggestions: UniverseSuggestion[]) => void
  onCharactersChange: (characters: UniverseCharacter[]) => void
}

function UniverseSuggestions({ universeId, suggestions, characters, onSuggestionsChange, onCharactersChange }: UniverseSuggestionsProps) {
  const [approvingId, setApprovingId] = useState<number | null>(null)
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [errors, setErrors] = useState<Record<number, string>>({})

  if (suggestions.length === 0) {
    return <p className="text-sm text-base-content/40">Новых фактов нет.</p>
  }

  async function handleApprove(suggestion: UniverseSuggestion, target: ApproveTarget) {
    setApprovingId(null)
    setProcessingId(suggestion.id)
    setErrors((prev) => { const next = { ...prev }; delete next[suggestion.id]; return next })

    try {
      await api.universes.approveSuggestion(universeId, suggestion.id, target)

      onSuggestionsChange(suggestions.filter((s) => s.id !== suggestion.id))

      if (target.target === 'character' || target.target === 'new_character') {
        const updated = await api.universes.listSuggestions(universeId)

        onSuggestionsChange(updated)

        const updatedChars = await fetch(`/api/universes/${universeId}/characters`).then((r) => r.json() as Promise<UniverseCharacter[]>)

        onCharactersChange(updatedChars)
      }
    } catch (err) {
      setErrors((prev) => ({ ...prev, [suggestion.id]: err instanceof Error ? err.message : 'Ошибка' }))
    } finally {
      setProcessingId(null)
    }
  }

  async function handleReject(id: number) {
    setProcessingId(id)
    setErrors((prev) => { const next = { ...prev }; delete next[id]; return next })

    try {
      await api.universes.rejectSuggestion(universeId, id)
      onSuggestionsChange(suggestions.filter((s) => s.id !== id))
    } catch (err) {
      setErrors((prev) => ({ ...prev, [id]: err instanceof Error ? err.message : 'Ошибка' }))
    } finally {
      setProcessingId(null)
    }
  }

  const pendingSuggestion = suggestions.find((s) => s.id === approvingId)

  return (
    <div className="space-y-2">
      {suggestions.map((s) => (
        <div key={s.id} className="rounded-box border border-base-300 bg-base-200 p-3">
          <p className="text-sm">{s.factText}</p>
          {errors[s.id] && <p className="mt-1 text-xs text-error">{errors[s.id]}</p>}
          <div className="mt-2 flex gap-2">
            <button
              className="btn btn-primary btn-xs"
              disabled={processingId === s.id}
              onClick={() => setApprovingId(s.id)}
            >
              Принять
            </button>
            <button
              className="btn btn-ghost btn-xs"
              disabled={processingId === s.id}
              onClick={() => void handleReject(s.id)}
            >
              Отклонить
            </button>
          </div>
        </div>
      ))}

      {approvingId !== null && pendingSuggestion && (
        <SuggestionApprovePicker
          factText={pendingSuggestion.factText}
          characters={characters}
          onConfirm={(target) => void handleApprove(pendingSuggestion, target)}
          onCancel={() => setApprovingId(null)}
        />
      )}
    </div>
  )
}

export default UniverseSuggestions
