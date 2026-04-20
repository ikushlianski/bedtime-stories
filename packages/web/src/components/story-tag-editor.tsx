import { useState, useRef } from 'react'

const SUGGESTED_TAGS = [
  'Эмоции', 'Семья', 'Детский сад', 'Страхи', 'Дружба',
  'Юмор', 'Природа', 'Школа', 'Смелость', 'Честность',
]

interface StoryTagEditorProps {
  tags: string[]
  onSave: (tags: string[]) => Promise<void>
}

function StoryTagEditor({ tags, onSave }: StoryTagEditorProps) {
  const [current, setCurrent] = useState<string[]>(tags)
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const suggestions = SUGGESTED_TAGS.filter(
    (t) => !current.includes(t) && t.toLowerCase().includes(input.toLowerCase()),
  )

  function addTag(tag: string) {
    const trimmed = tag.trim()

    if (!trimmed || current.includes(trimmed)) return

    setCurrent((prev) => [...prev, trimmed])
    setInput('')
    inputRef.current?.focus()
  }

  function removeTag(tag: string) {
    setCurrent((prev) => prev.filter((t) => t !== tag))
  }

  async function handleSave() {
    setSaving(true)

    try {
      await onSave(current)
    } finally {
      setSaving(false)
    }
  }

  const dirty = JSON.stringify(current.slice().sort()) !== JSON.stringify(tags.slice().sort())

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {current.map((tag) => (
          <span key={tag} className="badge badge-primary gap-1">
            {tag}
            <button
              className="text-primary-content/60 hover:text-primary-content"
              onClick={() => removeTag(tag)}
              aria-label={`Удалить ${tag}`}
            >
              ✕
            </button>
          </span>
        ))}
        {current.length === 0 && (
          <span className="text-sm text-base-content/40">Категории не выбраны</span>
        )}
      </div>

      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          className="input input-bordered input-sm flex-1 bg-base-200"
          placeholder="Добавить категорию..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && input.trim()) addTag(input)
          }}
        />
        <button
          className="btn btn-sm btn-outline"
          disabled={!input.trim()}
          onClick={() => addTag(input)}
        >
          +
        </button>
      </div>

      {input && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {suggestions.map((tag) => (
            <button
              key={tag}
              className="badge badge-outline cursor-pointer hover:badge-primary"
              onClick={() => addTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {!input && SUGGESTED_TAGS.filter((t) => !current.includes(t)).length > 0 && (
        <div className="flex flex-wrap gap-1">
          <span className="text-xs text-base-content/40 self-center">Предложения:</span>
          {SUGGESTED_TAGS.filter((t) => !current.includes(t)).slice(0, 6).map((tag) => (
            <button
              key={tag}
              className="badge badge-outline badge-sm cursor-pointer hover:badge-primary"
              onClick={() => addTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {dirty && (
        <div className="flex justify-end">
          <button
            className={`btn btn-sm btn-primary ${saving ? 'loading' : ''}`}
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving ? 'Сохраняю...' : 'Сохранить категории'}
          </button>
        </div>
      )}
    </div>
  )
}

export default StoryTagEditor
