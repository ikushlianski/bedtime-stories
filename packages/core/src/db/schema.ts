import { boolean, integer, jsonb, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core'

export const storyGroups = pgTable('story_groups', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  systemPrompt: text('system_prompt').notNull(),
  universeContext: text('universe_context'),
  styleGuide: text('style_guide'),
  styleGuideWorks: text('style_guide_works'),
  styleGuideDoesntWork: text('style_guide_doesnt_work'),
  styleGuideTechniques: text('style_guide_techniques'),
  styleGuideMinimize: text('style_guide_minimize'),
  agentOverrides: jsonb('agent_overrides').default({}),
  createdAt: timestamp('created_at').defaultNow(),
})

export const universeCharacters = pgTable('universe_characters', {
  id: serial('id').primaryKey(),
  universeId: integer('universe_id').references(() => storyGroups.id).notNull(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const universeSuggestions = pgTable('universe_suggestions', {
  id: serial('id').primaryKey(),
  universeId: integer('universe_id').references(() => storyGroups.id).notNull(),
  factText: text('fact_text').notNull(),
  sourceStoryId: integer('source_story_id').references(() => stories.id),
  status: text('status').$type<'pending' | 'approved' | 'rejected'>().default('pending').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const stories = pgTable('stories', {
  id: serial('id').primaryKey(),
  title: text('title').notNull().default(''),
  textFinal: text('text_final'),
  planV1: text('plan_v1'),
  planFinal: text('plan_final'),
  planIterations: integer('plan_iterations').default(1),
  textV1: text('text_v1'),
  textV2: text('text_v2'),
  plotterModel: text('plotter_model'),
  plotterPromptVersion: integer('plotter_prompt_version'),
  plotCriticModel: text('plot_critic_model'),
  plotCriticPromptVersion: integer('plot_critic_prompt_version'),
  writerModel: text('writer_model'),
  writerPromptVersion: integer('writer_prompt_version'),
  writerCriticModel: text('writer_critic_model'),
  writerCriticPromptVersion: integer('writer_critic_prompt_version'),
  createdAt: timestamp('created_at').defaultNow(),
  status: text('status').$type<'draft' | 'ready' | 'read' | 'archived'>().default('draft'),
  tags: jsonb('tags').default([]),
  source: text('source').$type<'agent' | 'legacy' | 'user'>().default('agent'),
  isLegacy: boolean('is_legacy').default(false),
  discussionQuestions: jsonb('discussion_questions').default([]),
  seed: text('seed'),
  groupId: integer('group_id').references(() => storyGroups.id),
  planChangeSummary: text('plan_change_summary'),
  mode: text('mode').$type<'auto' | 'manual'>().notNull().default('auto'),
  textChangeSummary: text('text_change_summary'),
  storyAnalysis: text('story_analysis'),
  sortOrder: integer('sort_order'),
  seriesId: text('series_id'),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const feedback = pgTable('feedback', {
  id: serial('id').primaryKey(),
  storyId: integer('story_id').references(() => stories.id),
  rating: integer('rating'),
  comment: text('comment'),
  feedbackType: text('feedback_type').$type<'agent_run' | 'retrospective'>(),
  createdAt: timestamp('created_at').defaultNow(),
  structuredFeedback: jsonb('structured_feedback').$type<{
    enjoyed: number
    was_funny: boolean
    was_scary: boolean
    too_long: boolean
    favorite_moment: string
    favorite_character: string
    understood_moral: boolean
    want_again: boolean
    notes: string
  } | null>().default(null),
})

export const prompts = pgTable('prompts', {
  id: serial('id').primaryKey(),
  agent: text('agent').$type<'plotter' | 'plot_critic' | 'writer' | 'writer_critic' | 'improver'>(),
  version: integer('version').notNull(),
  text: text('text').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  changeReason: text('change_reason'),
  sourceFeedbacks: jsonb('source_feedbacks').default([]),
})

export const annotations = pgTable('annotations', {
  id: serial('id').primaryKey(),
  storyId: integer('story_id').references(() => stories.id),
  type: text('type')
    .$type<'sasha_reaction' | 'my_note' | 'sasha_laughed' | 'sasha_loved' | 'sasha_disliked'>()
    .notNull(),
  selectedText: text('selected_text').notNull(),
  noteText: text('note_text'),
  positionStart: integer('position_start'),
  positionEnd: integer('position_end'),
  context: text('context').$type<'plan' | 'text'>().default('text'),
  resolvedAt: timestamp('resolved_at'),
  resolvedSummary: text('resolved_summary'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const childDiary = pgTable('child_diary', {
  id: serial('id').primaryKey(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

export const childProfiles = pgTable('child_profiles', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().default(''),
  age: integer('age'),
  activities: text('activities'),
  interests: text('interests'),
  dislikes: text('dislikes'),
  favourites: text('favourites'),
  notes: text('notes'),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const runSnapshots = pgTable('run_snapshots', {
  id: serial('id').primaryKey(),
  storyId: integer('story_id').references(() => stories.id),
  plotterModel: text('plotter_model'),
  plotterPromptVersion: integer('plotter_prompt_version'),
  psychologistPlanModel: text('psychologist_plan_model'),
  psychologistPlanPromptVersion: integer('psychologist_plan_prompt_version'),
  plotCriticModel: text('plot_critic_model'),
  plotCriticPromptVersion: integer('plot_critic_prompt_version'),
  writerModel: text('writer_model'),
  writerPromptVersion: integer('writer_prompt_version'),
  psychologistTextModel: text('psychologist_text_model'),
  psychologistTextPromptVersion: integer('psychologist_text_prompt_version'),
  writerCriticModel: text('writer_critic_model'),
  writerCriticPromptVersion: integer('writer_critic_prompt_version'),
  planIterationsCount: integer('plan_iterations_count'),
  planV1: text('plan_v1'),
  planFinal: text('plan_final'),
  psychologistPlanOutput: jsonb('psychologist_plan_output'),
  plotCriticOutput: jsonb('plot_critic_output'),
  textV1: text('text_v1'),
  textV2: text('text_v2'),
  psychologistTextOutput: jsonb('psychologist_text_output'),
  writerCriticOutput: jsonb('writer_critic_output'),
  createdAt: timestamp('created_at').defaultNow(),
  sashaContext: text('sasha_context'),
})

export const planQuestions = pgTable('plan_questions', {
  id: serial('id').primaryKey(),
  storyId: integer('story_id').references(() => stories.id),
  questionText: text('question_text').notNull(),
  answerOptions: jsonb('answer_options').$type<string[]>().default([]),
  answerText: text('answer_text'),
  createdAt: timestamp('created_at').defaultNow(),
  answeredAt: timestamp('answered_at'),
})

export const planConversations = pgTable('plan_conversations', {
  id: serial('id').primaryKey(),
  storyId: integer('story_id').references(() => stories.id),
  role: text('role').$type<'user' | 'assistant'>().notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

export const parentReviews = pgTable('parent_reviews', {
  id: serial('id').primaryKey(),
  storyId: integer('story_id').references(() => stories.id).notNull(),
  rating: integer('rating'),
  pacingOk: boolean('pacing_ok'),
  wouldReuse: boolean('would_reuse'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (t) => [unique('parent_reviews_story_id_unique').on(t.storyId)])

export const childReactions = pgTable('child_reactions', {
  id: serial('id').primaryKey(),
  storyId: integer('story_id').references(() => stories.id).notNull(),
  enjoyed: integer('enjoyed'),
  wasFunny: boolean('was_funny'),
  wasScary: boolean('was_scary'),
  tooLong: boolean('too_long'),
  understoodMoral: boolean('understood_moral'),
  wantAgain: boolean('want_again'),
  favoriteMoment: text('favorite_moment'),
  favoriteCharacter: text('favorite_character'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (t) => [unique('child_reactions_story_id_unique').on(t.storyId)])

export const storyReadings = pgTable('story_readings', {
  id: serial('id').primaryKey(),
  storyId: integer('story_id').references(() => stories.id).notNull(),
  readAt: timestamp('read_at').defaultNow().notNull(),
})
