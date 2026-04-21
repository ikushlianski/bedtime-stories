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

export interface UniverseCharacter {
  id: number
  universeId: number
  name: string
  description: string
  createdAt: string | null
  updatedAt: string | null
}

export interface UniverseSuggestion {
  id: number
  universeId: number
  factText: string
  sourceStoryId: number | null
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string | null
  updatedAt: string | null
}

export interface StoryGroup {
  id: number
  name: string
  description: string
  systemPrompt: string
  universeContext: string | null
  styleGuide: string | null
  styleGuideWorks: string | null
  styleGuideDoesntWork: string | null
  styleGuideTechniques: string | null
  styleGuideMinimize: string | null
  agentOverrides: Record<string, string> | null
  createdAt: string
  characters: UniverseCharacter[]
  pendingSuggestionsCount: number
}

export interface Story {
  id: number
  title: string
  seed: string | null
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
  plan_change_summary: string | null
  mode: 'auto' | 'manual'
  text_change_summary: string | null
  story_analysis: string | null
  sort_order: number | null
  series_id: string | null
  updated_at: string | null
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

export interface ParentReview {
  id: number
  storyId: number
  rating: number | null
  pacingOk: boolean | null
  wouldReuse: boolean | null
  notes: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface ChildReaction {
  id: number
  storyId: number
  enjoyed: number | null
  wasFunny: boolean | null
  wasScary: boolean | null
  tooLong: boolean | null
  understoodMoral: boolean | null
  wantAgain: boolean | null
  favoriteMoment: string | null
  favoriteCharacter: string | null
  notes: string | null
  createdAt: string | null
  updatedAt: string | null
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

export interface ChildProfile {
  id: number
  name: string
  age: number | null
  activities: string | null
  interests: string | null
  dislikes: string | null
  favourites: string | null
  notes: string | null
  updatedAt: string | null
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
  resolvedAt: string | null
  resolvedSummary: string | null
  createdAt: string
}

export interface PlanQuestion {
  id: number
  questionText: string
  answerOptions: string[] | null
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
  | { seed: string; groupId?: number; pipelineMode?: 'auto' | 'manual' }
  | { title?: string; textFinal: string; groupId?: number; source?: 'user' | 'legacy'; addToReadingList?: boolean }

export interface CreateSeriesInput {
  seed: string
  groupId?: number
}

export interface CreateSeriesResult {
  seriesId: string
  stories: Array<{ id: number; title: string; status: string; series_id: string; created_at: string }>
}

export interface CreateAnnotationInput {
  type: AnnotationType
  selectedText: string
  noteText?: string
  positionStart: number
  positionEnd: number
  context?: 'plan' | 'text'
}

export type PipelineStatusValue =
  | 'questions_pending'
  | 'questions_answered'
  | 'plan_running'
  | 'plan_ready'
  | 'text_running'
  | 'text_ready'
  | 'text_review'
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
    summary?: string
  }>
}

export const api = {
  stories: {
    list: (filters?: { status?: string; groupId?: number; tag?: string; readSort?: string }) => {
      const params = new URLSearchParams()

      if (filters?.status) params.set('status', filters.status)
      if (filters?.groupId != null) params.set('groupId', String(filters.groupId))
      if (filters?.tag) params.set('tag', filters.tag)
      if (filters?.readSort && filters.readSort !== 'default') params.set('readSort', filters.readSort)

      const query = params.toString() ? `?${params.toString()}` : ''

      return request<Story[]>(`/api/stories${query}`)
    },

    get: (id: number) => request<Story>(`/api/stories/${id}`),

    create: (input: CreateStoryInput) =>
      request<Story>('/api/stories', {
        method: 'POST',
        body: JSON.stringify(input),
      }),

    createSeries: (input: CreateSeriesInput) =>
      request<CreateSeriesResult>('/api/stories/series', {
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

    redoText: (id: number) =>
      request<{ started: boolean; storyId: number }>(`/api/stories/${id}/redo-text`, { method: 'POST' }),

    delete: (id: number) =>
      requestEmpty(`/api/stories/${id}`, {
        method: 'DELETE',
      }),

    critiqueText: (id: number) =>
      request<{ started: boolean; storyId: number }>(`/api/stories/${id}/critique-text`, { method: 'POST' }),

    analyze: (id: number) =>
      request<{ storyAnalysis: string; reactionsExtracted: number; styleGuideUpdated: boolean }>(
        `/api/stories/${id}/analyze`,
        { method: 'POST' },
      ),

    updateAnalysis: (id: number, storyAnalysis: string) =>
      request<Story>(`/api/stories/${id}/analysis`, {
        method: 'PATCH',
        body: JSON.stringify({ storyAnalysis }),
      }),

    updateTags: (id: number, tags: string[]) =>
      request<Story>(`/api/stories/${id}/tags`, {
        method: 'PATCH',
        body: JSON.stringify({ tags }),
      }),

    updateText: (id: number, text: string) =>
      request<Story>(`/api/stories/${id}/text`, {
        method: 'PATCH',
        body: JSON.stringify({ text }),
      }),

    getParentReview: (id: number) =>
      request<ParentReview | null>(`/api/stories/${id}/parent-review`),

    saveParentReview: (id: number, data: Partial<Omit<ParentReview, 'id' | 'storyId' | 'createdAt' | 'updatedAt'>>) =>
      request<ParentReview>(`/api/stories/${id}/parent-review`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    getChildReaction: (id: number) =>
      request<ChildReaction | null>(`/api/stories/${id}/child-reaction`),

    saveChildReaction: (id: number, data: Partial<Omit<ChildReaction, 'id' | 'storyId' | 'createdAt' | 'updatedAt'>>) =>
      request<ChildReaction>(`/api/stories/${id}/child-reaction`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    reorder: (orders: Array<{ id: number; sort_order: number }>) =>
      request<{ ok: boolean }>('/api/stories/reorder', {
        method: 'POST',
        body: JSON.stringify({ orders }),
      }),

    addReading: (id: number) =>
      request<{ ok: boolean; readAt: string; statusUpdated: boolean }>(`/api/stories/${id}/readings`, {
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
    create: (storyId: number, data: CreateAnnotationInput) =>
      request<Annotation>(`/api/stories/${storyId}/annotations`, {
        method: 'POST',
        body: JSON.stringify({
          type: data.type,
          selected_text: data.selectedText,
          note_text: data.noteText,
          position_start: data.positionStart,
          position_end: data.positionEnd,
          context: data.context ?? 'text',
        }),
      }),

    list: (storyId: number, context?: 'plan' | 'text') =>
      request<Annotation[]>(`/api/stories/${storyId}/annotations${context ? `?context=${context}` : ''}`),

    redoPlan: (storyId: number) =>
      request<{ started: boolean; storyId: number }>(`/api/stories/${storyId}/redo-plan`, { method: 'POST' }),
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

    retryPlan: (storyId: number) =>
      request<{ started: boolean; storyId: number }>(`/api/pipeline/questions/${storyId}/retry-plan`, { method: 'POST' }),

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

  childProfile: {
    get: () => request<ChildProfile | null>('/api/child-profile'),
    update: (data: Partial<Omit<ChildProfile, 'id' | 'updatedAt'>>) =>
      request<ChildProfile>('/api/child-profile', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
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
        universeContext: string
        styleGuide: string
        styleGuideWorks: string | null
        styleGuideDoesntWork: string | null
        styleGuideTechniques: string | null
        styleGuideMinimize: string | null
        agentOverrides: Record<string, string>
      }>,
    ) =>
      request<StoryGroup>(`/api/universes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    delete: (id: number) => requestEmpty(`/api/universes/${id}`, { method: 'DELETE' }),

    createCharacter: (universeId: number, data: { name: string; description?: string }) =>
      request<UniverseCharacter>(`/api/universes/${universeId}/characters`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updateCharacter: (universeId: number, charId: number, data: { name?: string; description?: string }) =>
      request<UniverseCharacter>(`/api/universes/${universeId}/characters/${charId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    deleteCharacter: (universeId: number, charId: number) =>
      requestEmpty(`/api/universes/${universeId}/characters/${charId}`, { method: 'DELETE' }),

    listSuggestions: (universeId: number) =>
      request<UniverseSuggestion[]>(`/api/universes/${universeId}/suggestions`),

    approveSuggestion: (
      universeId: number,
      suggestionId: number,
      body: { target: 'character' | 'new_character'; characterName: string } | { target: 'description' },
    ) =>
      requestEmpty(`/api/universes/${universeId}/suggestions/${suggestionId}/approve`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    rejectSuggestion: (universeId: number, suggestionId: number) =>
      requestEmpty(`/api/universes/${universeId}/suggestions/${suggestionId}/reject`, { method: 'POST' }),
  },
}
