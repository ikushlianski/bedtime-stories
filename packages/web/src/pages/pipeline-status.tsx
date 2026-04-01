import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, type PipelineStatus } from '../lib/api'
import { PipelineProgress } from '../components'
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
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load pipeline status')

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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pipeline Status</h1>

        {status && (
          <p className="text-sm text-gray-500 mt-1 capitalize">
            {isRunning ? 'Running...' : status.status}
            {status.current_step && isRunning && (
              <span className="ml-2 text-indigo-600">Step: {status.current_step}</span>
            )}
          </p>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm mb-4">
          {error}
        </div>
      )}

      {!status && !error && (
        <p className="text-gray-500 text-sm">Loading pipeline status...</p>
      )}

      {status && (
        <>
          <div className="mb-8">
            <PipelineProgress steps={toPipelineSteps(status)} />
          </div>

          {isDone && status.status === 'completed' && (
            <div className="flex justify-end">
              <button
                onClick={() => navigate(`/stories/${storyId}/plan-review`)}
                className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
              >
                Review Plan →
              </button>
            </div>
          )}

          {isDone && status.status === 'failed' && (
            <p className="text-red-600 text-sm">
              Pipeline failed. Check server logs for details.
            </p>
          )}
        </>
      )}
    </div>
  )
}
