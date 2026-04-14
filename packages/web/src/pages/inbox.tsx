import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Story } from '../lib/api'
import { PageHeader, StatusCallout } from '../components'
import {
  buildInbox,
  groupInboxByAction,
  actionLabel,
  actionHref,
  type InboxAction,
  type InboxItem,
} from './inbox-derivation'

const ACTIONABLE: InboxAction[] = ['review_plan', 'review_text', 'read_to_sasha']
const SECONDARY: InboxAction[] = ['pending_plan', 'leave_feedback']

function Section({
  title,
  items,
  onPick,
  tone,
}: {
  title: string
  items: InboxItem[]
  onPick: (href: string) => void
  tone: 'primary' | 'secondary'
}) {
  if (items.length === 0) return null

  return (
    <section className="mb-8">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-base-content/60">
        {title} ({items.length})
      </h3>
      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.story.id}
            className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-serif text-lg text-base-content">{item.story.title}</p>
                <p className="mt-1 text-xs text-base-content/50">
                  Created {new Date(item.story.created_at).toLocaleString()}
                </p>
              </div>
              <button
                className={`btn btn-sm ${tone === 'primary' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => onPick(actionHref(item.action, item.story.id))}
              >
                {actionLabel(item.action)} →
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function InboxPage() {
  const navigate = useNavigate()
  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStories = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await api.stories.list()
      setStories(data)
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load stories')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchStories()
  }, [fetchStories])

  const inbox = buildInbox(stories)
  const groups = groupInboxByAction(inbox)
  const actionable = ACTIONABLE.flatMap((action) => groups[action] ?? [])
  const secondary = SECONDARY.flatMap((action) => groups[action] ?? [])
  const totalActionable = actionable.length

  return (
    <div>
      <PageHeader
        eyebrow="Inbox"
        title="What needs you next"
        description="Stories waiting for your attention, grouped by the next step the bedtime pipeline needs from you."
      />

      {loading && <StatusCallout title="Loading" message="Pulling the story list." />}

      {!loading && error && (
        <StatusCallout tone="error" title="Inbox unavailable" message={error} />
      )}

      {!loading && !error && totalActionable === 0 && secondary.length === 0 && (
        <StatusCallout
          title="All clear"
          message="Nothing waiting. Add an idea or create a new story to get going."
        />
      )}

      {!loading && !error && (
        <>
          {totalActionable === 0 && secondary.length > 0 && (
            <div className="mb-6">
              <StatusCallout
                title="Nothing actionable right now"
                message="No plans or texts are waiting for review. Check back after the next pipeline run finishes."
              />
            </div>
          )}

          <Section
            title="Needs review"
            items={groups.review_plan ?? []}
            onPick={(href) => navigate(href)}
            tone="primary"
          />
          <Section
            title="Needs final sign-off"
            items={groups.review_text ?? []}
            onPick={(href) => navigate(href)}
            tone="primary"
          />
          <Section
            title="Ready to read"
            items={groups.read_to_sasha ?? []}
            onPick={(href) => navigate(href)}
            tone="primary"
          />
          <Section
            title="In the pipeline"
            items={groups.pending_plan ?? []}
            onPick={(href) => navigate(href)}
            tone="secondary"
          />
          <Section
            title="Waiting on your feedback"
            items={groups.leave_feedback ?? []}
            onPick={(href) => navigate(href)}
            tone="secondary"
          />
        </>
      )}
    </div>
  )
}
