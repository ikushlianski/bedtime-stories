import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Story } from '../lib/api'

interface Props {
  currentStoryId: number
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'давно'

  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return 'сегодня'
  if (days === 1) return 'вчера'
  if (days < 7) return `${days} дн. назад`
  if (days < 30) return `${Math.floor(days / 7)} нед. назад`

  return `${Math.floor(days / 30)} мес. назад`
}

export function AttentionStories({ currentStoryId }: Props) {
  const navigate = useNavigate()
  const [stories, setStories] = useState<Story[]>([])

  useEffect(() => {
    api.stories
      .list({ status: 'draft' })
      .then((all) => {
        const others = all
          .filter((s) => s.id !== currentStoryId)
          .sort((a, b) => {
            const aTime = a.updated_at ?? a.created_at
            const bTime = b.updated_at ?? b.created_at
            return new Date(aTime).getTime() - new Date(bTime).getTime()
          })
          .slice(0, 5)

        setStories(others)
      })
      .catch(() => undefined)
  }, [currentStoryId])

  if (stories.length === 0) return null

  return (
    <div className="rounded-box border border-base-300 bg-base-100 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-base-content/40">
        Другие черновики — требуют внимания
      </p>
      <ul className="space-y-2">
        {stories.map((story) => (
          <li key={story.id}>
            <button
              className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-base-200"
              onClick={() => navigate(`/stories/${story.id}/pipeline`)}
            >
              <span className="truncate text-sm text-base-content">{story.title}</span>
              <span className="shrink-0 text-xs text-base-content/40">
                {timeAgo(story.updated_at ?? story.created_at)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
