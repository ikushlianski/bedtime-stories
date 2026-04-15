import { boolean, integer, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

export const storyGroups = pgTable('story_groups', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  systemPrompt: text('system_prompt').notNull(),
  agentOverrides: jsonb('agent_overrides').default({}),
  createdAt: timestamp('created_at').defaultNow(),
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
  positionStart: integer('position_start'),
  positionEnd: integer('position_end'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const childDiary = pgTable('child_diary', {
  id: serial('id').primaryKey(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
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
