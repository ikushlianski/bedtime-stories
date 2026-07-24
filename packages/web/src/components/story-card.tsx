import type { HTMLAttributes } from 'react'
import type { StoryStatus } from './types'
import { formatMicros } from '@bedtime/shared/money/micros'
import { deriveTitlePreview } from './derive-title-preview'

const PROMPT_PREVIEW_MAX_LENGTH = 100

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
  seriesId?: string | null
  totalUsdMicros?: number | null
  universeName?: string
  seed?: string | null
  actions?: StoryCardAction[]
  onTitleClick?: () => void
  dragHandleProps?: HTMLAttributes<HTMLDivElement>
}

const statusConfig: Record<StoryStatus, { label: string; tone: string }> = {
  draft: { label: 'Черновик', tone: 'badge-ghost' },
  proofreading: { label: 'На вычитке', tone: 'badge-info' },
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

  return `btn btn-xs ${toneClass[tone]}`
}

function GripIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  )
}

function StoryCard({ title, status, createdAt, rating, seriesId, totalUsdMicros, universeName, seed, actions = [], onTitleClick, dragHandleProps }: StoryCardProps) {
  const config = statusConfig[status]
  const isArchived = status === 'archived'
  const regularActions = actions.filter((action) => action.tone !== 'destructive')
  const destructiveActions = actions.filter((action) => action.tone === 'destructive')
  const promptPreview = seed ? deriveTitlePreview(seed, PROMPT_PREVIEW_MAX_LENGTH) : ''

  return (
    <article
      className={`flex flex-col rounded-lg border border-base-content/10 bg-base-100 shadow-sm transition hover:shadow-md ${
        isArchived ? 'opacity-70' : ''
      }`}
    >
      <div className="flex flex-1 items-start gap-2 p-3">
        {dragHandleProps && (
          <div
            {...dragHandleProps}
            className="mt-0.5 cursor-grab touch-none text-base-content/30 hover:text-base-content/60 active:cursor-grabbing"
            aria-label="Перетащить"
          >
            <GripIcon />
          </div>
        )}

        <div className="flex flex-1 flex-col gap-2">
          <div className="flex items-start justify-between gap-3">
            {onTitleClick ? (
              <button
                type="button"
                onClick={onTitleClick}
                className="cursor-pointer text-left font-serif text-base leading-tight text-base-content hover:underline"
              >
                {title}
              </button>
            ) : (
              <h3 className="font-serif text-base leading-tight text-base-content">{title}</h3>
            )}
            <div className="flex shrink-0 gap-1">
              {seriesId && (
                <span className="badge badge-sm badge-outline" title="Часть серии историй">Серия</span>
              )}
              <span className={`badge badge-sm ${config.tone}`}>{config.label}</span>
            </div>
          </div>

          {promptPreview && (
            <p className="text-sm leading-snug text-base-content/70">{promptPreview}</p>
          )}

          <div className="flex items-center justify-between gap-3 text-xs text-base-content/65">
            <span>
              {formatDate(createdAt)}
              {universeName && <span className="ml-1.5 text-base-content/40">{universeName}</span>}
            </span>

            <span className="flex items-center gap-3">
              <span className="font-mono" title="Стоимость генерации">
                {totalUsdMicros !== undefined && totalUsdMicros !== null ? `$${formatMicros(totalUsdMicros)}` : '—'}
              </span>
              {rating !== undefined && (
                <span className="font-medium text-warning" aria-label={`Оценка: ${rating} из 5`}>
                  {renderStars(rating)}
                </span>
              )}
            </span>
          </div>
        </div>
      </div>

      {actions.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-base-content/10 px-3 py-2">
          <div className="flex flex-wrap gap-1.5">
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

          <div className="flex flex-wrap gap-1.5">
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
