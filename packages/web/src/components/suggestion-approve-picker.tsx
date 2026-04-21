import { useState } from 'react'
import type { UniverseCharacter } from '../lib/api'

type ApproveTarget =
  | { target: 'character'; characterName: string }
  | { target: 'new_character'; characterName: string }
  | { target: 'description' }

interface SuggestionApprovePickerProps {
  factText: string
  characters: UniverseCharacter[]
  onConfirm: (target: ApproveTarget) => void
  onCancel: () => void
}

function SuggestionApprovePicker({ factText, characters, onConfirm, onCancel }: SuggestionApprovePickerProps) {
  const [mode, setMode] = useState<'existing' | 'new' | 'description'>('description')
  const [selectedCharacter, setSelectedCharacter] = useState(characters[0]?.name ?? '')
  const [newCharacterName, setNewCharacterName] = useState('')

  function handleConfirm() {
    if (mode === 'existing') {
      onConfirm({ target: 'character', characterName: selectedCharacter })
    } else if (mode === 'new') {
      if (!newCharacterName.trim()) return
      onConfirm({ target: 'new_character', characterName: newCharacterName.trim() })
    } else {
      onConfirm({ target: 'description' })
    }
  }

  const canConfirm =
    mode === 'description' ||
    (mode === 'existing' && !!selectedCharacter) ||
    (mode === 'new' && !!newCharacterName.trim())

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-md">
        <h3 className="text-base font-semibold mb-1">Куда добавить факт?</h3>
        <p className="text-sm text-base-content/60 mb-4 italic">«{factText}»</p>

        <div className="space-y-2">
          {characters.length > 0 && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                className="radio radio-sm radio-primary"
                checked={mode === 'existing'}
                onChange={() => setMode('existing')}
              />
              <span className="text-sm">Существующий персонаж</span>
            </label>
          )}

          {mode === 'existing' && (
            <select
              className="select select-bordered select-sm w-full ml-6"
              value={selectedCharacter}
              onChange={(e) => setSelectedCharacter(e.target.value)}
            >
              {characters.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              className="radio radio-sm radio-primary"
              checked={mode === 'new'}
              onChange={() => setMode('new')}
            />
            <span className="text-sm">Новый персонаж</span>
          </label>

          {mode === 'new' && (
            <input
              type="text"
              className="input input-bordered input-sm w-full ml-6"
              placeholder="Имя нового персонажа..."
              value={newCharacterName}
              onChange={(e) => setNewCharacterName(e.target.value)}
            />
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              className="radio radio-sm radio-primary"
              checked={mode === 'description'}
              onChange={() => setMode('description')}
            />
            <span className="text-sm">Общее описание вселенной</span>
          </label>
        </div>

        <div className="modal-action">
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>
            Отмена
          </button>
          <button className="btn btn-primary btn-sm" disabled={!canConfirm} onClick={handleConfirm}>
            Добавить
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onCancel} />
    </div>
  )
}

export default SuggestionApprovePicker
export type { ApproveTarget }
