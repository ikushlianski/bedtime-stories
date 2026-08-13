import { useState, useRef, useEffect } from 'react'
import { api } from '../lib/api'
import { useToast } from '../lib/use-toast'

interface EditableStoryTitleProps {
  storyId: number
  initialTitle: string
  onTitleUpdated?: (newTitle: string) => void
}

export function EditableStoryTitle({ storyId, initialTitle, onTitleUpdated }: EditableStoryTitleProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(initialTitle)
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { showToast } = useToast()

  useEffect(() => {
    setTitle(initialTitle)
  }, [initialTitle])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleSave = async () => {
    const trimmedTitle = title.trim()

    if (!trimmedTitle) {
      showToast('Название не может быть пустым')
      setTitle(initialTitle)
      setIsEditing(false)
      return
    }

    if (trimmedTitle === initialTitle) {
      setIsEditing(false)
      return
    }

    setIsSaving(true)
    try {
      const updated = await api.stories.updateTitle(storyId, trimmedTitle)
      setTitle(updated.title)
      onTitleUpdated?.(updated.title)
      setIsEditing(false)
      showToast('Название обновлено')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Не удалось обновить название')
      setTitle(initialTitle)
    } finally {
      setIsSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      setTitle(initialTitle)
      setIsEditing(false)
    }
  }

  const handleBlur = () => {
    handleSave()
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={isSaving}
        className="font-serif text-4xl leading-none text-base-content outline-none sm:text-5xl bg-transparent border-b-2 border-primary/40 focus:border-primary/70 disabled:opacity-50"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className="group relative font-serif text-4xl leading-none text-base-content hover:text-primary/70 transition-colors sm:text-5xl"
      title="Нажмите, чтобы отредактировать название"
    >
      {title}
      <span className="absolute right-0 top-0 -translate-y-1/2 translate-x-full opacity-0 group-hover:opacity-100 transition-opacity pl-2 text-lg">
        ✎
      </span>
    </button>
  )
}
