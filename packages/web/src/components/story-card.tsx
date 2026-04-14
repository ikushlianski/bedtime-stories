import type { StoryStatus } from './types'

interface StoryCardProps {
  title: string
  status: StoryStatus
  createdAt: string
  rating?: number
}

const statusConfig: Record<StoryStatus, { label: string; tone: string }> = {
  draft: { label: 'Draft', tone: 'badge-ghost' },
  ready: { label: 'Ready', tone: 'badge-primary' },
  read: { label: 'Read', tone: 'badge-success' },
  archived: { label: 'Archived', tone: 'badge-warning' },
}

function renderStars(rating: number): string {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function StoryCard({ title, status, createdAt, rating }: StoryCardProps) {
  const config = statusConfig[status]
  const isArchived = status === 'archived'

  return (
    <article
      className={`card h-full border border-base-300 bg-base-100 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        isArchived ? 'opacity-70' : ''
      }`}
    >
      <div className="card-body gap-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-serif text-xl leading-tight text-base-content">{title}</h3>
          <span className={`badge ${config.tone} badge-outline border-none`}>{config.label}</span>
        </div>

        <div className="flex items-center justify-between gap-3 text-sm text-base-content/65">
          <span>{formatDate(createdAt)}</span>

          {rating !== undefined && (
            <span className="font-medium text-warning" aria-label={`Rating: ${rating} out of 5`}>
              {renderStars(rating)}
            </span>
          )}
        </div>
      </div>
    </article>
  )
}

export default StoryCard
