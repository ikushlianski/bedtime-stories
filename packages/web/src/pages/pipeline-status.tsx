import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, type PipelineStatus } from '../lib/api'
import { PageHeader, PipelineProgress, StatusCallout } from '../components'
import type { PipelineStep, AgentName, AgentStatus } from '../components/types'

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

export function PipelineStatusPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const storyId = Number(id)
  const [status, setStatus] = useState<PipelineStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await api.pipeline.status(storyId)

        setStatus(data)

        if (data.status !== 'running' && data.status !== 'pending') {
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

  const isRunning = status?.status === 'running' || status?.status === 'pending'
  const isDone = status && !isRunning

  return (
    <div>
      <PageHeader
        eyebrow="Pipeline"
        title="Pipeline Status"
        description={
          status
            ? `${isRunning ? 'Pipeline is running.' : `Pipeline ${status.status}.`}${status.current_step ? ` Current step: ${status.current_step}.` : ''}`
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

          {isDone && status.status === 'completed' && (
            <div className="flex justify-end">
              <button className="btn btn-primary" onClick={() => navigate(`/stories/${storyId}/plan-review`)}>
                Review Plan →
              </button>
            </div>
          )}

          {isDone && status.status === 'failed' && (
            <StatusCallout
              tone="error"
              title="Pipeline failed"
              message="Check the API logs for the failing stage before retrying the story."
            />
          )}
        </div>
      )}
    </div>
  )
}
