import { bigint, boolean, integer, jsonb, numeric, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  email: text('email').unique(),
  createdAt: timestamp('created_at').defaultNow(),
})

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
  styleGuideSyncedAt: timestamp('style_guide_synced_at'),
  agentOverrides: jsonb('agent_overrides').default({}),
  createdAt: timestamp('created_at').defaultNow(),
})

export const universeCharacters = pgTable('universe_characters', {
  id: serial('id').primaryKey(),
  universeId: integer('universe_id').references(() => storyGroups.id).notNull(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  age: text('age'),
  setting: text('setting'),
  traits: text('traits'),
  relationships: text('relationships'),
  coOccurrenceNote: text('co_occurrence_note'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const telegramPendingActions = pgTable('telegram_pending_actions', {
  chatId: bigint('chat_id', { mode: 'number' }).primaryKey(),
  universeId: integer('universe_id').references(() => storyGroups.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
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
  status: text('status').$type<'draft' | 'proofreading' | 'ready' | 'read' | 'archived'>().default('draft'),
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
  readyAt: timestamp('ready_at'),
  agentOverrides: jsonb('agent_overrides').default({}),
  activeTextVersionId: integer('active_text_version_id'),
  structureKey: text('structure_key'),
  lensKey: text('lens_key'),
})

export const fragments = pgTable('fragments', {
  id: serial('id').primaryKey(),
  text: text('text').notNull(),
  universeId: integer('universe_id').references(() => storyGroups.id),
  rank: integer('rank').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const storyFragments = pgTable('story_fragments', {
  id: serial('id').primaryKey(),
  storyId: integer('story_id').references(() => stories.id).notNull(),
  fragmentId: integer('fragment_id').references(() => fragments.id).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [unique('story_fragments_story_fragment_unique').on(t.storyId, t.fragmentId)])

export const words = pgTable('words', {
  id: serial('id').primaryKey(),
  word: text('word').notNull(),
  hint: text('hint'),
  universeId: integer('universe_id').references(() => storyGroups.id),
  rank: integer('rank').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const storyWords = pgTable('story_words', {
  id: serial('id').primaryKey(),
  storyId: integer('story_id').references(() => stories.id).notNull(),
  wordId: integer('word_id').references(() => words.id).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [unique('story_words_story_word_unique').on(t.storyId, t.wordId)])

export const topics = pgTable('topics', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  note: text('note'),
  universeId: integer('universe_id').references(() => storyGroups.id),
  rank: integer('rank').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const storyTopics = pgTable('story_topics', {
  id: serial('id').primaryKey(),
  storyId: integer('story_id').references(() => stories.id).notNull(),
  topicId: integer('topic_id').references(() => topics.id).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [unique('story_topics_story_topic_unique').on(t.storyId, t.topicId)])

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
  selectedText: text('selected_text'),
  noteText: text('note_text'),
  positionStart: integer('position_start'),
  positionEnd: integer('position_end'),
  context: text('context').$type<'plan' | 'text'>().default('text'),
  textVersionId: integer('text_version_id'),
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
  context: text('context').$type<'plan' | 'text'>().notNull().default('plan'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const storyComments = pgTable('story_comments', {
  id: serial('id').primaryKey(),
  storyId: integer('story_id').references(() => stories.id).notNull(),
  universeId: integer('universe_id').references(() => storyGroups.id),
  commentText: text('comment_text').notNull(),
  selectedText: text('selected_text'),
  source: text('source').$type<'chat' | 'revision_reason'>().notNull().default('chat'),
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

export const modelCatalog = pgTable('model_catalog', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').default(''),
  createdByProvider: timestamp('created_by_provider'),
  inputUsdPerMillion: numeric('input_usd_per_million'),
  outputUsdPerMillion: numeric('output_usd_per_million'),
  imageUsdPerRequest: numeric('image_usd_per_request'),
  contextLength: integer('context_length'),
  maxOutputTokens: integer('max_output_tokens'),
  modality: text('modality').default('text->text'),
  inputModalities: jsonb('input_modalities').$type<string[]>().default(['text']),
  tokenizer: text('tokenizer'),
  instructType: text('instruct_type'),
  supportsJsonSchema: boolean('supports_json_schema').default(false),
  isFree: boolean('is_free').default(false),
  isModerated: boolean('is_moderated').default(false),
  expirationDate: text('expiration_date'),
  isRecommendedForProse: boolean('is_recommended_for_prose').default(false),
  popularityRank: integer('popularity_rank'),
  lastSyncedAt: timestamp('last_synced_at'),
  deletedAt: timestamp('deleted_at'),
})

export const modelSwapEvents = pgTable('model_swap_events', {
  id: serial('id').primaryKey(),
  storyId: integer('story_id').references(() => stories.id),
  stage: text('stage').notNull(),
  fromModel: text('from_model').references(() => modelCatalog.id),
  toModel: text('to_model').references(() => modelCatalog.id),
  reasonChip: text('reason_chip').$type<'too_verbose' | 'too_short' | 'broke_format' | 'boring_prose' | 'off_topic' | 'repetitive' | 'not_calm' | 'weak_ending' | 'too_slow' | 'failed' | 'other'>(),
  reasonText: text('reason_text'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const valueForMoneyFeedback = pgTable('value_for_money_feedback', {
  id: serial('id').primaryKey(),
  storyId: integer('story_id').references(() => stories.id).notNull(),
  rating: integer('rating').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [unique('value_for_money_feedback_story_id_unique').on(t.storyId)])

export const modelCalls = pgTable('model_calls', {
  id: serial('id').primaryKey(),
  storyId: integer('story_id').references(() => stories.id),
  stage: text('stage').notNull(),
  modelId: text('model_id').references(() => modelCatalog.id),
  attempt: integer('attempt').notNull().default(1),
  fallbackUsed: boolean('fallback_used').notNull().default(false),
  tokensIn: integer('tokens_in'),
  tokensOut: integer('tokens_out'),
  usdMicros: bigint('usd_micros', { mode: 'number' }),
  latencyMs: integer('latency_ms'),
  success: boolean('success').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

export const storyIdeas = pgTable('story_ideas', {
  id: serial('id').primaryKey(),
  universeId: integer('universe_id').references(() => storyGroups.id).notNull(),
  topic: text('topic').notNull(),
  seedText: text('seed_text').notNull(),
  rationale: text('rationale').notNull(),
  status: text('status').$type<'pending' | 'approved' | 'rejected'>().default('pending').notNull(),
  rejectionReason: text('rejection_reason'),
  approvedAt: timestamp('approved_at'),
  rejectedAt: timestamp('rejected_at'),
  ideaSuggesterModel: text('idea_suggester_model').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const storyTextVersions = pgTable('story_text_versions', {
  id: serial('id').primaryKey(),
  storyId: integer('story_id').references(() => stories.id).notNull(),
  versionNumber: integer('version_number').notNull(),
  text: text('text').notNull(),
  modelId: text('model_id'),
  stage: text('stage').$type<'writer_initial' | 'writer_critic' | 'annotated_rewrite' | 'chat_patch'>().notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

export const appSettings = pgTable('app_settings', {
  id: integer('id').primaryKey().default(1),
  stageModels: jsonb('stage_models').$type<Record<string, { model?: string; fallback?: string }>>(),
  updatedAt: timestamp('updated_at').defaultNow(),
})
