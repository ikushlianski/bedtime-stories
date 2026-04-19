import type { StoryStatus } from './types'

type StoryCardActionTone = 'primary' | 'secondary' | 'tertiary' | 'quiet' | 'destructive'

interface StoryCardAction {
  label: string
  onClick: () => void
  tone?: StoryCardActionTone
  disabled?: boolean
}

interface StoryCardProps {
  title: string
  status: StoryStatus
  createdAt: string
  rating?: number
  actions?: StoryCardAction[]
}

const statusConfig: Record<StoryStatus, { label: string; tone: string }> = {
  draft: { label: 'Черновик', tone: 'badge-ghost' },
  ready: { label: 'Готово', tone: 'badge-primary' },
  read: { label: 'Прочитано', tone: 'badge-success' },
  archived: { label: 'Архив', tone: 'badge-warning' },
}

function renderStars(rating: number): string {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function actionClassName(tone: StoryCardActionTone = 'tertiary'): string {
  const toneClass: Record<StoryCardActionTone, string> = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    tertiary: 'btn-outline',
    quiet: 'btn-ghost',
    destructive: 'btn-error btn-outline',
  }

  return `btn btn-sm ${toneClass[tone]}`
}

function StoryCard({ title, status, createdAt, rating, actions = [] }: StoryCardProps) {
  const config = statusConfig[status]
  const isArchived = status === 'archived'
  const regularActions = actions.filter((action) => action.tone !== 'destructive')
  const destructiveActions = actions.filter((action) => action.tone === 'destructive')

  return (
    <article
      className={`flex h-full flex-col rounded-lg border border-base-content/10 bg-base-100 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        isArchived ? 'opacity-70' : ''
      }`}
    >
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-serif text-xl leading-tight text-base-content">{title}</h3>
          <span className={`badge ${config.tone}`}>{config.label}</span>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 text-sm text-base-content/65">
          <span>{formatDate(createdAt)}</span>

          {rating !== undefined && (
            <span className="font-medium text-warning" aria-label={`Оценка: ${rating} из 5`}>
              {renderStars(rating)}
            </span>
          )}
        </div>
      </div>

      {actions.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-base-content/10 px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {regularActions.map((action) => (
              <button
                key={action.label}
                type="button"
                className={actionClassName(action.tone)}
                onClick={action.onClick}
                disabled={action.disabled}
              >
                {action.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {destructiveActions.map((action) => (
              <button
                key={action.label}
                type="button"
                className={actionClassName(action.tone)}
                onClick={action.onClick}
                disabled={action.disabled}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </article>
  )
}

export default StoryCard
