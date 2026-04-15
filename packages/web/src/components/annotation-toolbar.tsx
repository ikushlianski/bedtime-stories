import type { AnnotationType } from './types'

interface AnnotationToolbarProps {
  onAnnotate: (type: AnnotationType, selectedText: string) => void
  selectedText: string
}

const REACTION_BUTTONS: Array<{ type: AnnotationType; label: string }> = [
  { type: 'sasha_laughed', label: 'Laughed' },
  { type: 'sasha_loved', label: 'Loved' },
  { type: 'sasha_disliked', label: 'Disliked' },
]

function AnnotationToolbar({ onAnnotate, selectedText }: AnnotationToolbarProps) {
  if (!selectedText) {
    return null
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-neutral/20 bg-neutral px-3 py-2 text-neutral-content shadow-xl">
      <span className="max-w-32 truncate text-xs text-neutral-content/70">
        &ldquo;{selectedText}&rdquo;
      </span>

      {REACTION_BUTTONS.map(({ type, label }) => (
        <button
          key={type}
          className="btn btn-secondary btn-xs"
          onClick={() => onAnnotate(type, selectedText)}
        >
          {label}
        </button>
      ))}

      <button className="btn btn-primary btn-xs" onClick={() => onAnnotate('my_note', selectedText)}>
        My note
      </button>
    </div>
  )
}

export default AnnotationToolbar
