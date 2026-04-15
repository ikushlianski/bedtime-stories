import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, type PipelineStatus, type PipelineStatusValue, type Story } from '../lib/api'
import { PageHeader, PipelineProgress, StatusCallout } from '../components'
import type { PipelineStep, AgentName, AgentStatus } from '../components/types'
import { decidePipelineRetry } from './pipeline-retry'

const POLL_INTERVAL_MS = 3000

const API_STATUS_MAP: Record<string, AgentStatus> = {
  pending: 'idle',
  running: 'running',
  completed: 'done',
  failed: 'error',
}

const KNOWN_AGENT_NAMES = new Set<AgentName>([
  'Plotter',
  'Psychologist',
  'PlotCritic',
  'Writer',
  'WriterCritic',
  'Improver',
])

function toAgentName(raw: string): AgentName {
  if (KNOWN_AGENT_NAMES.has(raw as AgentName)) {
    return raw as AgentName
  }

  return 'Plotter'
}

function toPipelineSteps(status: PipelineStatus): PipelineStep[] {
  return status.steps.map((step) => ({
    agentName: toAgentName(step.agent ?? step.name),
    status: API_STATUS_MAP[step.status] ?? 'idle',
  }))
}

function isActivePolling(status: PipelineStatusValue): boolean {
  return status === 'plan_running' || status === 'text_running' || status === 'pending'
}

function describeStatus(status: PipelineStatusValue): string {
  switch (status) {
    case 'plan_running':
      return 'Plan phase is running.'
    case 'plan_ready':
      return 'Plan is ready for review.'
    case 'text_running':
      return 'Text phase is running.'
    case 'text_ready':
      return 'Text is ready for review.'
    case 'failed':
      return 'Pipeline failed.'
    case 'pending':
      return 'Waiting for pipeline to start.'
    default:
      return 'Unknown status.'
  }
}

export function PipelineStatusPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const storyId = Number(id)
  const [status, setStatus] = useState<PipelineStatus | null>(null)
  const [story, setStory] = useState<Story | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (isNaN(storyId)) return

    api.stories
      .get(storyId)
      .then(setStory)
      .catch(() => {
        /* non-fatal — retry button will hide until story loads */
      })
  }, [storyId])

  const handleRetry = useCallback(async (seed: string) => {
    setRetrying(true)
    setRetryError(null)

    try {
      await api.pipeline.run(storyId, seed)
      setError(null)

      if (intervalRef.current === null) {
        intervalRef.current = setInterval(async () => {
          try {
            const data = await api.pipeline.status(storyId)
            setStatus(data)
          } catch {
            /* polling will self-heal on next tick */
          }
        }, POLL_INTERVAL_MS)
      }
    } catch (err) {
      setRetryError(err instanceof Error ? err.message : 'Failed to restart pipeline')
    } finally {
      setRetrying(false)
    }
  }, [storyId])

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await api.pipeline.status(storyId)

        setStatus(data)

        if (!isActivePolling(data.status)) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
        }
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load pipeline status')

        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      }
    }

    void fetchStatus()

    intervalRef.current = setInterval(() => void fetchStatus(), POLL_INTERVAL_MS)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [storyId])

  return (
    <div>
      <PageHeader
        eyebrow="Pipeline"
        title="Pipeline Status"
        description={
          status
            ? `${describeStatus(status.status)}${status.current_step ? ` Current step: ${status.current_step}.` : ''}`
            : 'Polling the current generation pipeline.'
        }
      />

      {error && (
        <StatusCallout tone="error" title="Pipeline request failed" message={error} />
      )}

      {!status && !error && (
        <StatusCallout title="Loading" message="Fetching the latest pipeline status." />
      )}

      {status && (
        <div className="space-y-6">
          <PipelineProgress steps={toPipelineSteps(status)} />

          {status.status === 'plan_ready' && (
            <div className="flex justify-end">
              <button className="btn btn-primary" onClick={() => navigate(`/stories/${storyId}/plan-review`)}>
                Review Plan →
              </button>
            </div>
          )}

          {status.status === 'text_ready' && (
            <div className="flex justify-end">
              <button className="btn btn-primary" onClick={() => navigate(`/stories/${storyId}/text-review`)}>
                Review Text →
              </button>
            </div>
          )}

          {status.status === 'failed' && (
            <StatusCallout
              tone="error"
              title={status.phase === 'text' ? 'Text phase failed' : 'Plan phase failed'}
              message="Check the API logs for the failing stage before retrying the story."
            />
          )}

          {(() => {
            const retryDecision = decidePipelineRetry(status.status, story)

            if (retryDecision.action === 'hidden') return null

            if (retryDecision.action === 'blocked') {
              return (
                <StatusCallout
                  tone="warning"
                  title="Cannot retry"
                  message="The story is missing its seed text, so the pipeline can't be restarted from here."
                />
              )
            }

            const label =
              retryDecision.action === 'retry_plan'
                ? retryDecision.reason === 'pending'
                  ? 'Start pipeline'
                  : 'Retry plan phase'
                : 'Retry text phase'

            const onClick = () => {
              if (retryDecision.action === 'retry_plan') {
                void handleRetry(retryDecision.seed)
              }
            }

            return (
              <div className="space-y-2">
                {retryError && <StatusCallout tone="error" title="Retry failed" message={retryError} />}
                <div className="flex justify-end">
                  <button
                    className="btn btn-primary"
                    onClick={onClick}
                    disabled={retrying || retryDecision.action !== 'retry_plan'}
                  >
                    {retrying ? 'Starting…' : label}
                  </button>
                </div>
                {retryDecision.action === 'retry_text' && (
                  <p className="text-right text-xs text-base-content/60">
                    Text-phase retry must be started from the plan-review page for now.
                  </p>
                )}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
