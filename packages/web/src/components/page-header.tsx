import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: ReactNode
  description?: string
  eyebrow?: string
  action?: ReactNode
  backAction?: ReactNode
}

function PageHeader({ title, description, eyebrow, action, backAction }: PageHeaderProps) {
  return (
    <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-2">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-secondary">
            {eyebrow}
          </p>
        )}

        <div className="space-y-2">
          {backAction}
          <h1 className="font-serif text-4xl leading-none text-base-content sm:text-5xl inline-block">{title}</h1>
          {description && (
            <p className="max-w-3xl text-sm text-base-content/65 sm:text-base">{description}</p>
          )}
        </div>
      </div>

      {action && <div className="shrink-0">{action}</div>}
    </header>
  )
}

export default PageHeader
