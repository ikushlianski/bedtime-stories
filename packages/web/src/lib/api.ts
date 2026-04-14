const API_BASE = (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env['VITE_API_URL'] ?? 'http://localhost:3001'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`)
  }

  return res.json() as Promise<T>
}

export interface Story {
  id: number
  title: string
  text_final: string | null
  plan_v1: string | null
  plan_final: string | null
  plan_iterations: number | null
  text_v1: string | null
  text_v2: string | null
  plotter_model: string | null
  plotter_prompt_version: string | null
  plot_critic_model: string | null
  plot_critic_prompt_version: string | null
  writer_model: string | null
  writer_prompt_version: string | null
  writer_critic_model: string | null
  writer_critic_prompt_version: string | null
  created_at: string
  status: 'draft' | 'ready' | 'read' | 'archived'
  tags: string[] | null
  source: 'agent' | 'legacy'
  is_legacy: boolean
  discussion_questions: string[] | null
}

export interface RunSnapshot {
  story_id: number
  psychologist_plan_output: PsychologistOutput | null
  psychologist_text_output: PsychologistOutput | null
  plot_critic_output: CriticOutput | null
  writer_critic_output: CriticOutput | null
  plan_iterations_count: number
}

export interface PsychologistOutput {
  safety: {
    verdict: 'safe' | 'concern' | 'block'
    issues: string[]
  }
  therapeutic: {
    score: number
    strengths: string[]
    gaps: string[]
  }
  recommended_changes: string[]
}

export interface CriticOutput {
  issues: Array<{
    prio: 'must' | 'nice'
    description: string
    quote?: string
  }>
  improvement_needed: boolean
}

export interface FeedbackData {
  rating: number
  comment: string
  feedback_type: 'agent_run' | 'retrospective'
}

export interface PipelineStatus {
  story_id: number
  status: 'running' | 'completed' | 'failed' | 'pending'
  current_step: string | null
  steps: Array<{
    name: string
    status: 'pending' | 'running' | 'completed' | 'failed'
    agent?: string
  }>
}

export const api = {
  stories: {
    list: (status?: string) => {
      const query = status ? `?status=${status}` : ''

      return request<Story[]>(`/api/stories${query}`)
    },

    get: (id: number) => request<Story>(`/api/stories/${id}`),

    create: (seed: string) =>
      request<Story>('/api/stories', {
        method: 'POST',
        body: JSON.stringify({ seed }),
      }),

    approvePlan: (id: number) =>
      request<{ ok: boolean }>(`/api/stories/${id}/approve-plan`, {
        method: 'POST',
      }),

    approveText: (id: number) =>
      request<{ ok: boolean }>(`/api/stories/${id}/approve-text`, {
        method: 'POST',
      }),
  },

  feedback: {
    submit: (storyId: number, data: FeedbackData) =>
      request<{ ok: boolean }>(`/api/stories/${storyId}/feedback`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  annotations: {
    create: (storyId: number, data: { text: string; type: string; start: number; end: number }) => {
      console.log('annotation stub', storyId, data)

      return Promise.resolve({ ok: true })
    },
  },

  pipeline: {
    run: (storyId: number, seed: string) =>
      request<{ started: boolean; storyId: number }>('/api/pipeline/run', {
        method: 'POST',
        body: JSON.stringify({ storyId, seed }),
      }),

    status: (storyId: number) => request<PipelineStatus>(`/api/pipeline/status/${storyId}`),

    snapshot: (storyId: number) => request<RunSnapshot>(`/api/pipeline/status/${storyId}`),
  },
}
