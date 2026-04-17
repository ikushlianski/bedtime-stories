import { useState } from 'react'
import type { AnnotationType } from './types'

interface AnnotationToolbarProps {
  onAnnotate: (type: AnnotationType, selectedText: string, noteText?: string) => void
  selectedText: string
}

const REACTION_BUTTONS: Array<{ type: AnnotationType; label: string }> = [
  { type: 'sasha_laughed', label: 'Смеялся' },
  { type: 'sasha_loved', label: 'Понравилось' },
  { type: 'sasha_disliked', label: 'Не понравилось' },
]

function AnnotationToolbar({ onAnnotate, selectedText }: AnnotationToolbarProps) {
  const [noteMode, setNoteMode] = useState(false)
  const [noteText, setNoteText] = useState('')

  if (!selectedText) return null

  if (noteMode) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-neutral/20 bg-neutral px-3 py-2 text-neutral-content shadow-xl">
        <input
          autoFocus
          type="text"
          className="rounded-full border border-neutral-content/20 bg-neutral px-3 py-1 text-sm text-neutral-content placeholder-neutral-content/40 outline-none"
          placeholder="Ваша заметка..."
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && noteText.trim()) {
              onAnnotate('my_note', selectedText, noteText.trim())
            }

            if (e.key === 'Escape') {
              setNoteMode(false)
              setNoteText('')
            }
          }}
        />

        <button
          className="btn btn-primary btn-xs"
          disabled={!noteText.trim()}
          onClick={() => {
            if (noteText.trim()) {
              onAnnotate('my_note', selectedText, noteText.trim())
            }
          }}
        >
          Сохранить
        </button>

        <button
          className="btn btn-ghost btn-xs"
          onClick={() => {
            setNoteMode(false)
            setNoteText('')
          }}
        >
          ✕
        </button>
      </div>
    )
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-neutral/20 bg-neutral px-3 py-2 text-neutral-content shadow-xl">
      <span className="max-w-32 truncate text-xs text-neutral-content/70">
        &ldquo;{selectedText}&rdquo;
      </span>

      {REACTION_BUTTONS.map(({ type, label }) => (
        <button
          key={type}
          className="btn btn-ghost btn-xs"
          onClick={() => onAnnotate(type, selectedText)}
        >
          {label}
        </button>
      ))}

      <button className="btn btn-primary btn-xs" onClick={() => setNoteMode(true)}>
        Заметка
      </button>
    </div>
  )
}

export default AnnotationToolbar
