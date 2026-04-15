import { formatApiError } from './format-api-error'

const API_BASE = (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env['VITE_API_URL'] ?? 'http://localhost:8020'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })

  if (!res.ok) {
    let body: unknown = null

    try {
      body = await res.json()
    } catch {
      body = null
    }

    throw new Error(formatApiError(res.status, res.statusText, body))
  }

  return res.json() as Promise<T>
}

async function requestEmpty(path: string, init?: RequestInit): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })

  if (!res.ok) {
    let body: unknown = null

    try {
      body = await res.json()
    } catch {
      body = null
    }

    throw new Error(formatApiError(res.status, res.statusText, body))
  }
}

export interface StoryGroup {
  id: number
  name: string
  description: string
  systemPrompt: string
  agentOverrides: Record<string, string> | null
  createdAt: string
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
  plotter_prompt_version: number | null
  plot_critic_model: string | null
  plot_critic_prompt_version: number | null
  writer_model: string | null
  writer_prompt_version: number | null
  writer_critic_model: string | null
  writer_critic_prompt_version: number | null
  created_at: string
  status: 'draft' | 'ready' | 'read' | 'archived'
  tags: string[] | null
  source: 'agent' | 'legacy' | 'user'
  is_legacy: boolean
  discussion_questions: string[] | null
  group_id: number | null
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

export interface StructuredFeedback {
  enjoyed: number
  was_funny: boolean
  was_scary: boolean
  too_long: boolean
  favorite_moment: string
  favorite_character: string
  understood_moral: boolean
  want_again: boolean
  notes: string
}

export interface FeedbackData {
  rating: number
  comment?: string
  feedback_type: 'agent_run' | 'retrospective'
  structured_feedback?: StructuredFeedback | null
}

export interface DiaryEntry {
  id: number
  content: string
  createdAt: string
}

export type AnnotationType =
  | 'sasha_reaction'
  | 'my_note'
  | 'sasha_laughed'
  | 'sasha_loved'
  | 'sasha_disliked'

export const REACTION_ANNOTATION_TYPES: readonly AnnotationType[] = [
  'sasha_reaction',
  'sasha_laughed',
  'sasha_loved',
  'sasha_disliked',
] as const

export function isReactionAnnotation(type: AnnotationType): boolean {
  return type !== 'my_note'
}

export interface Annotation {
  id: number
  storyId: number
  type: AnnotationType
  selectedText: string
  noteText: string | null
  positionStart: number | null
  positionEnd: number | null
  createdAt: string
}

export interface PlanQuestion {
  id: number
  questionText: string
  answerText: string | null
  createdAt: string
  answeredAt: string | null
}

export interface ConversationMessage {
  id: number
  storyId: number
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export type CreateStoryInput =
  | { seed: string; groupId?: number }
  | { title?: string; textFinal: string; groupId?: number }

export interface CreateAnnotationInput {
  type: AnnotationType
  selectedText: string
  noteText?: string
  positionStart: number
  positionEnd: number
}

export type PipelineStatusValue =
  | 'questions_pending'
  | 'plan_running'
  | 'plan_ready'
  | 'text_running'
  | 'text_ready'
  | 'failed'
  | 'pending'

export interface PipelineStatus {
  story_id: number
  status: PipelineStatusValue
  phase: 'plan' | 'text' | null
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

    create: (input: CreateStoryInput) =>
      request<Story>('/api/stories', {
        method: 'POST',
        body: JSON.stringify(input),
      }),

    approvePlan: (id: number, approved = true) =>
      request<Story>(`/api/stories/${id}/approve-plan`, {
        method: 'POST',
        body: JSON.stringify({ approved }),
      }),

    approveText: (id: number, approved = true) =>
      request<Story>(`/api/stories/${id}/approve-text`, {
        method: 'POST',
        body: JSON.stringify({ approved }),
      }),

    updateStatus: (id: number, status: 'draft' | 'ready' | 'read' | 'archived') =>
      request<Story>(`/api/stories/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),

    delete: (id: number) =>
      requestEmpty(`/api/stories/${id}`, {
        method: 'DELETE',
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
    create: (storyId: number, data: CreateAnnotationInput) =>
      request<Annotation>(`/api/stories/${storyId}/annotations`, {
        method: 'POST',
        body: JSON.stringify({
          type: data.type,
          selected_text: data.selectedText,
          note_text: data.noteText,
          position_start: data.positionStart,
          position_end: data.positionEnd,
        }),
      }),

    list: (storyId: number) => request<Annotation[]>(`/api/stories/${storyId}/annotations`),
  },

  pipeline: {
    run: (storyId: number, seed: string) =>
      request<{ started: boolean; storyId: number; phase: 'plan' | 'questions' }>('/api/pipeline/run', {
        method: 'POST',
        body: JSON.stringify({ storyId, seed }),
      }),

    status: (storyId: number) => request<PipelineStatus>(`/api/pipeline/status/${storyId}`),

    snapshot: (storyId: number) => request<RunSnapshot>(`/api/pipeline/snapshot/${storyId}`),

    questions: (storyId: number) => request<PlanQuestion[]>(`/api/pipeline/questions/${storyId}`),

    submitAnswers: (storyId: number, answers: Array<{ id: number; answer: string }>) =>
      request<{ ok: boolean }>(`/api/pipeline/questions/${storyId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers }),
      }),

    conversations: (storyId: number) => request<ConversationMessage[]>(`/api/pipeline/conversations/${storyId}`),

    sendConversationMessage: (storyId: number, message: string) =>
      request<{ userMessage: ConversationMessage; assistantMessage: ConversationMessage }>(
        `/api/pipeline/conversations/${storyId}`,
        { method: 'POST', body: JSON.stringify({ message }) },
      ),
  },

  diary: {
    list: () => request<DiaryEntry[]>('/api/diary'),
    create: (content: string) =>
      request<DiaryEntry>('/api/diary', {
        method: 'POST',
        body: JSON.stringify({ content }),
      }),
    delete: (id: number) => requestEmpty(`/api/diary/${id}`, { method: 'DELETE' }),
  },

  universes: {
    list: () => request<StoryGroup[]>('/api/universes'),

    get: (id: number) => request<StoryGroup>(`/api/universes/${id}`),

    create: (data: {
      name: string
      systemPrompt: string
      description?: string
      agentOverrides?: Record<string, string>
    }) =>
      request<StoryGroup>('/api/universes', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (
      id: number,
      data: Partial<{
        name: string
        systemPrompt: string
        description: string
        agentOverrides: Record<string, string>
      }>,
    ) =>
      request<StoryGroup>(`/api/universes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    delete: (id: number) => requestEmpty(`/api/universes/${id}`, { method: 'DELETE' }),
  },
}
