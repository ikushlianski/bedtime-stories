# bedtime-agent wishlist

Priority order — top is highest priority. `/grand-loop` picks the first `- [ ]` item.

- [ ] Add a real deployed dev environment (separate Cloud Run service + Pulumi stack), auto-deployed
      on merge to main; prod becomes manual-dispatch-only.
      Why: today there is only one deployed environment (prod, auto-deployed on every push to main)
      and one local dev setup (Docker Compose + a Neon dev DB branch, no deployed service). When
      asked to "deploy to dev first," the only safe substitute right now is a local Docker Compose
      run — there's no actual staging URL to click through before prod sees a change.
      Pointers: a full plan already exists at `.planning/unassigned/dev-deploy-environment/` (spec,
      scenarios, architecture — state: draft, not yet reviewed by you) — written 2026-07-24 by an
      agent working on an unrelated feature, surfaced here rather than discarded. It proposes: one
      GCP project hosts two Cloud Run services (`bedtime-api` prod, `bedtime-api-dev` new), a second
      Pulumi stack (`dev`) for the incremental per-environment resources only, a GitHub Actions
      rewrite so push-to-main auto-deploys dev while prod becomes `workflow_dispatch`-only, and a
      persistent Neon `dev` branch. Real cost/complexity: a second always-on Cloud Run service, a
      second DNS record, new OAuth/OpenRouter dev credentials you'd need to provide.
      Done when: pushing to main deploys `dev.bedtime-agent.ilya.online` automatically without
      touching prod; deploying to prod requires an explicit manual dispatch exactly like today.
      Constraints: read the existing draft plan before replanning from scratch — it may already
      answer most of the design questions.

- [x] Turn universe memory into a persistent, nightly-synthesized store fed by all feedback. (#292) [→ done: reviewed, fixed, merged to main and deployed to prod 2026-07-18 — see .planning/LOG.md]
      Why: `synthesizeUniverseMemory` only runs synchronously when a single story is approved, and
      it overwrites the universe's style-guide fields rather than accumulating — nothing runs
      periodically to fold in everything the user left that day (ratings, and eventually chat
      comments from the item below).
      Pointers: `packages/core/src/pipeline/synthesize-universe-memory.ts`,
      `storyGroups.styleGuide*` fields in `packages/core/src/db/schema.ts:11-22`,
      `packages/api/src/routes/story-analysis.ts` (`analyzeStoryAndLearn`, current trigger point),
      `packages/api/src/routes/pipeline-dispatch.ts` (Cloud Tasks dispatch pattern to model a
      scheduled worker on), `infra/index.ts:183-209` (existing Cloud Scheduler `catalog-sync` job
      — pattern to copy for a new nightly per-universe job).
      Done when: every universe has a memory record that updates automatically overnight without
      needing a story approval as the trigger; a day where the user leaves feedback on any story
      in a universe shows up in that universe's memory the next day; running the job twice with no
      new feedback in between doesn't lose anything already captured.
      Constraints: should also ingest whatever the chat feature below produces — build this before
      or alongside that item so chat comments have somewhere to land.

- [x] Add a chat interface for commenting on any story — patches drafts, captures feedback on read stories. (#293) [→ done: merged to main and deployed to prod 2026-07-18 — see .planning/LOG.md]
      Why: only the plan phase has a chat today, scoped to pre-approval plan text. The user wants
      to comment on any story regardless of state, with different behavior depending on it: on a
      draft (plan or text), a comment about a specific piece returns just that piece rewritten; a
      comment about the whole story is banked, not applied, until the user explicitly asks to
      regenerate, at which point every banked comment is folded into one regeneration pass; on an
      already-approved/read story the chat can never change the text — it only records the comment
      into that universe's memory.
      Pointers: `packages/core/src/db/schema.ts:240-246` (`planConversations`, closest existing
      analog), `packages/api/src/routes/pipeline-questions.ts:157-180` (existing patch/summary-
      marker conversation endpoint — check whether it already does per-piece patching, since the
      new "accumulate whole-story comments, apply only on regenerate" branch doesn't exist yet),
      `packages/web/src/pages/plan-conversation-panel.tsx` (existing chat UI to generalize beyond
      the plan phase).
      Done when: the user can open a chat on a draft plan, a draft text, or a finished story; a
      targeted comment on a draft returns only the affected passage changed; a whole-story comment
      on a draft is acknowledged but leaves the text untouched until "regenerate" is invoked, which
      then applies every banked comment at once; a comment on a finished/read story never changes
      the story and instead shows up in that universe's memory.

- [ ] Run character/trait extraction as a nightly batch job with a user approval flow instead of silent per-story extraction. (#294)
      Why: `universeFactExtractor` already infers characters/facts and writes them to
      `universeSuggestions` for moderation, but it only fires synchronously when a single story is
      approved — there's no batch job walking stories in order, and no notification tells the user
      a suggestion is waiting. The user wants a nightly pass, an incoming notification per
      suggestion, and the option to attach a reason when accepting/rejecting that feeds into
      universe memory.
      Pointers: `packages/core/src/pipeline/stages/universe-fact-extractor.ts` (existing extraction
      logic to reuse for the batch pass), `universeSuggestions` table
      (`packages/core/src/db/schema.ts:40-48`, already has pending/approved/rejected status — the
      approval data model may already be enough as-is), `infra/index.ts:183-209` (Cloud Scheduler
      pattern for the nightly trigger), `packages/api/src/routes/universes.ts:217-301` (existing
      character CRUD/moderation routes to extend). No notification channel exists in the app yet —
      needs a decision during planning (in-app only vs. push via the existing Telegram bot
      integration).
      Done when: a nightly job processes stories not yet scanned for characters and writes
      suggestions the same way approval-time extraction does today; the user gets a notification
      when a new suggestion is waiting; accepting or rejecting works like today's moderation flow,
      and an optional comment on the reaction is captured into universe memory.

- [x] Add a two-step /new flow in Telegram — pick a universe, then send the story outline. (#295) [→ done: merged to main and deployed to prod 2026-07-18 — see .planning/LOG.md]
      Why: today's Telegram story creation is stateless and has no universe-picking step — free
      text either matches an existing story ID or silently becomes a new story's seed under
      whatever `resolveDefaultUniverseId()` resolves to (most-recently-used or first universe).
      The user wants to explicitly choose the universe before typing the outline, the same way
      the web UI's create-story modal already works.
      Pointers: `packages/api/src/routes/telegram.ts` (bot commands incl. `/new`, inline-keyboard
      callback handlers at ~266-306 — same pattern to reuse for a universe-picker keyboard,
      `createStoryAndFire(seedText)` at ~45-79, `resolveDefaultUniverseId()` at ~28-43),
      `packages/api/src/routes/telegram-utils.ts` (`deriveIsAuthorizedUser` — single-user bot, no
      multi-tenant concept, so new state only needs to key by chat_id),
      `packages/web/src/components/create-story-modal.tsx` (the web equivalent: universe select +
      seed textarea, for parity reference). No multi-step conversation state exists in the
      Telegram integration today — every handler is stateless per-update (confirmed: no pending-
      state map, no DB table, grammy's own `session`/`@grammyjs/conversations` plugins aren't
      used) — this item requires adding that state (an in-memory `Map<chatId, PendingAction>` is
      probably enough given it's a single-user bot, but a DB table is the safer choice if the API
      process can restart/scale).
      Done when: sending `/new` in Telegram replies with an inline keyboard listing all universes;
      tapping one stores that choice against the chat and prompts for the outline; the next text
      message from that chat is treated as the seed for the chosen universe (not run through the
      existing ID-lookup-or-fallback heuristic) and fires the pipeline via the same
      `createStoryAndFire`-style path, but with the explicitly chosen `groupId`; any interaction
      that doesn't go through `/new` first keeps today's existing behavior unchanged.

- [x] Have the writer agent recall memorable moments from past stories in the same universe. (#296) [→ done: merged to main and deployed to prod 2026-07-18 — see .planning/LOG.md]
      Why: `sasha_laughed`/`sasha_loved` reactions on annotations already mark which passages
      landed well, but nothing feeds them back into new stories — every story is written in
      isolation from what's come before, even within the same universe/characters.
      Pointers: `annotations.type` enum (`packages/core/src/db/schema.ts:171`) already has
      `sasha_laughed`/`sasha_loved`; `packages/core/src/pipeline/synthesize-universe-memory.ts`
      and `style-guide-updater.ts` are the existing per-universe memory pipeline to extend;
      `packages/core/src/pipeline/stages/plotter.ts` (beat/structure planning) and
      `stages/writer.ts` (prose generation) are where a callback would actually get planted.
      Done when: a new story in a universe that has an earlier `sasha_laughed`/`sasha_loved`
      moment on record sometimes (not always — only when the new story's theme genuinely fits)
      references that earlier moment, through Gosha or another recurring character, or by
      engineering a situation that calls back to it. Forcing a callback into every story, or
      referencing a moment that doesn't thematically fit, both count as not done.
      Constraints: the model must judge thematic fit itself rather than the system always
      injecting the top memorable moment — a mismatched callback is worse than no callback.

- [x] Add a UI control to optionally pick a specific plot structure and character lens per story. [→ done: merged to main and deployed to prod 2026-07-18 — see .planning/LOG.md]
      Why: story generation already rotates through 10 plot structures and ~10 character lenses
      deterministically by storyId, but the user has no way to explicitly choose one instead of
      leaving it to rotation, and today only the Plotter receives the chosen structure/lens — the
      Writer has zero awareness of it at all.
      Pointers: `packages/core/src/pipeline/stages/story-structures.ts`,
      `packages/core/src/pipeline/stages/character-lenses.ts`, `packages/web/src/components/
      create-story-modal.tsx` (UI to extend), `packages/api/src/routes/create-story-schema.ts`.
      Done when: the create-story UI lets the user optionally pick a specific structure/lens
      (default stays "Auto" = today's rotation); the choice is persisted per story and reused on
      every redo/regenerate; both the Plotter AND the Writer receive and respect the same
      resolved choice, not just the Plotter.

- [ ] Wrap `DELETE /stories/:id` in a database transaction — a failed delete currently leaves
      orphaned partial state instead of rolling back cleanly.
      Why: found while verifying #297 (story-retrieval): the handler in
      `packages/api/src/routes/stories.ts` deletes across many dependent tables (annotations,
      feedback, story_text_versions, and now story_embeddings) in sequence with no surrounding
      transaction. It already fails outright with a foreign-key violation today for any story
      referenced by `model_swap_events` or `child_reactions` — those two tables are never cleared
      by the handler. Because the delete sequence isn't atomic, a failed attempt against such a
      story leaves every table that was deleted before the failing one gone, while the story row
      itself (and everything after the failure point) survives — silent partial corruption instead
      of a clean no-op failure. Reproduced directly: two real stories on a test branch ended up
      with their `story_embeddings` row deleted but the story itself intact, after a delete attempt
      that failed on the `model_swap_events`/`child_reactions` FK.
      Pointers: `packages/api/src/routes/stories.ts` (`DELETE /:id` handler, ~line 1088-1112 as of
      this writing), `packages/core/src/db/client.ts` (check whether a `db.transaction(...)` helper
      is already used elsewhere in this codebase — if so, match that pattern).
      Done when: `DELETE /stories/:id` either fully succeeds (every dependent table cleared, story
      gone) or fully fails (nothing changed) — never a partial state in between. Also clear
      `model_swap_events` and `child_reactions` rows for the story so the delete stops failing for
      stories that have them.

- [ ] Give the plotter/writer real retrieval capability over past stories, not just pre-fetched context. (#297)
      [→ in progress: built and independently verified overnight in
      ~/orca/workspaces/bedtime-agent/story-retrieval (branch story-retrieval, commit 7c4992b) —
      NOT yet merged to main or deployed, needs human review first (new secret + new pgvector
      dependency). See .planning/LOG.md 2026-07-21 01:34 entry and the worktree's todo.md.]
      Why: today the orchestrator only pre-fetches a fixed, small set of context (memorable
      moments, style guide) via plain SQL before the prompt is built — the model itself never
      decides to look something up. There's no tool-calling/function-calling infrastructure
      anywhere in the OpenRouter runner, and no vector/embedding search over story text at all
      (confirmed: zero hits for either in the codebase). A real retrieval capability — either a
      tool call the model can invoke mid-generation, or a vector search over past story text —
      would let the writer pull relevant history on demand instead of everything being pushed to
      it ahead of time and capped small for cost reasons.
      Pointers: `packages/core/src/openrouter/` (the runner — no tool-calling support exists
      here yet, this would be new infrastructure), `packages/core/src/pipeline/load-memorable-
      moments.ts` and `pipeline/synthesize-universe-memory.ts` (today's pre-fetch pattern to
      contrast against), no existing vector/pgvector setup in `packages/core/src/db/schema.ts`.
      Done when: the writer (or plotter) can retrieve specific past-story content relevant to
      the current story that wasn't already pre-fetched, on its own initiative — via a tool call
      or a semantic search — rather than only ever seeing what the orchestrator decided to push
      in advance.
      Constraints: this is meaningfully bigger than the other pipeline tweaks done so far today —
      it likely needs either OpenRouter tool-calling support added to the runner, or a new
      embeddings/vector-search pipeline (model choice, indexing strategy, storage). Needs real
      design work before building, not a same-day build like the other items in this session.

- [ ] Wire banked `story_comments` into universe memory synthesis.
      Why: wishlist #293's own "Done when" promises a comment on a finished/read story shows up in
      that universe's memory, but `syncUniverseMemory` only reads `annotations`/`feedback`/
      `parentReviews`/`childReactions` — it never queries `story_comments`. A parent's comment on a
      read story is stored and displayed back in the same panel, then goes nowhere; it never
      shapes a future story.
      Pointers: `packages/core/src/pipeline/synthesize-universe-memory.ts:46-118` (add a
      `story_comments` delta query alongside the existing four), `packages/api/src/routes/
      story-comments.ts` (existing write path), `storyComments` table in `schema.ts`.
      Done when: a comment recorded via `POST /api/stories/:id/comments` on a `ready`/`read`/
      `archived` story visibly changes `styleGuideWorks`/`doesntWork`/etc. on that universe's next
      sync.

- [ ] Wrap chat/comment text in the existing data-only prompt delimiter before it reaches
      Plotter/Writer.
      Why: `writer.ts:109-110` and `plotter.ts:143-144` concatenate raw user-typed
      `userAnnotations`/`userFeedback` directly into the prompt with an "apply ALL of these
      without exception" framing — the most injection-friendly shape possible. The plan-chat
      endpoint (`pipeline-questions.ts:270-298`) does the same with no delimiter. The same
      codebase already solved this correctly next door: `memorable-moments.ts:59-71` and
      `synthesize-universe-memory.ts:287-301` wrap comparable user-derived content in a labeled
      `=== НАЧАЛО ДАННЫХ ===` block with an explicit "this is data, not instructions" instruction.
      The one place a user's own typed words reach a real generation call skipped that guard.
      Pointers: `packages/core/src/pipeline/stages/writer.ts:109-110`, `stages/plotter.ts:143-144`,
      `packages/api/src/routes/pipeline-questions.ts:270-298`; reuse the pattern from
      `memorable-moments.ts:59-71`.
      Done when: `userAnnotations`/`userFeedback`/the plan-chat prompt are wrapped in the same
      data-only delimiter, with a test proving a comment containing an instruction-like string
      doesn't change output structure.

- [ ] Bound plan/text chat conversation history sent per turn.
      Why: `pipeline-questions.ts:261-272` fetches every prior message with no limit and resends
      the full history plus the entire current draft on every single turn — no summarization,
      pruning, or turn cap anywhere in this path. Not a problem yet (largest real thread seen in
      production is 4 messages), but cost per turn has no ceiling as conversations grow longer,
      and a long enough thread on a long story could approach context-window limits with nothing
      to fall back on.
      Pointers: `packages/api/src/routes/pipeline-questions.ts:261-272` (`priorMessages` query,
      `conversationContext` join).
      Done when: conversation history sent per turn is capped (last N turns, or a rolling summary
      of older ones), with a test proving turn N+1 doesn't grow prompt size past the cap.

- [ ] Cap the number of banked comments folded into one regenerate call.
      Why: `gather-redo-feedback.ts:52-68` selects every unresolved annotation with no `LIMIT`,
      and `format-comments-as-feedback.ts` concatenates all of them verbatim into one Plotter/
      Writer call. Today's usage is tiny (max 2 seen in production) but nothing stops one
      regenerate call from folding in dozens of comments at once with no relevance filtering.
      Pointers: `packages/api/src/routes/gather-redo-feedback.ts:52-56`, `packages/core/src/
      pipeline/format-comments-as-feedback.ts`.
      Done when: `gatherRedoFeedback` caps how many annotations get folded into one prompt (most
      recent N, or a size budget) and surfaces when comments were dropped for exceeding it.

- [ ] Universe memory sync silently drops feedback on stories outside the newest-50 window.
      Why: `syncUniverseMemory` (`synthesize-universe-memory.ts:46-51`) scopes every delta query
      to the 50 most-recently-created stories in the universe. Feedback on any older story is
      invisible to the sync forever, regardless of the cursor. Verified directly in production:
      universe 1 has 96 stories, 46 fall outside the window, carrying 137 annotations (some as
      recent as 2026-07-04) that have never been and never will be folded into that universe's
      style guide. This compounds as universes grow — more history permanently ages out with no
      code path that ever revisits it.
      Pointers: `packages/core/src/pipeline/synthesize-universe-memory.ts:46-51` (the `LIMIT 50`
      story query), same file lines 60-118 (delta queries scoped to that story-id set).
      Done when: feedback tied to any story is guaranteed to be considered by the next sync at
      least once, regardless of how many newer stories exist — e.g. scope the delta query by
      feedback `createdAt > cursor` across the whole universe, not a fixed story-count window.

- [ ] Editing a parent review or child reaction after its universe has synced never reaches the
      style guide.
      Why: the delta queries in `synthesize-universe-memory.ts:96-100, 113-117` filter on
      `createdAt`, but `PUT /stories/:id/parent-review` and `/child-reaction`
      (`stories.ts:872-897, 917-942`) upsert in place and only bump `updatedAt`. Once a story's
      review has been included in one sync, any later correction (changed rating, changed pacing
      note) is invisible to every future sync — the style guide keeps citing the original,
      possibly reversed, judgment. Confirmed real edits happen in production days-to-weeks after
      creation (e.g. story 37's review edited 2026-07-03, created 2026-05-15); the specific
      failure hasn't fired yet only because no edited row has coincided with a completed sync so
      far — it's latent, not hypothetical.
      Pointers: `packages/core/src/pipeline/synthesize-universe-memory.ts:87-117` (delta queries),
      `packages/api/src/routes/stories.ts:872-942` (upsert endpoints).
      Done when: an edit made after its story was already synced is reflected in the next sync —
      filter on `updatedAt` instead of/in addition to `createdAt`.

- [ ] Nightly universe-memory sync has no cross-instance concurrency guard.
      Why: the reentrancy guard in `internal-universe-memory-sync.ts:9-24` is an in-memory
      boolean, invisible to Cloud Run's other instances (`maxScale: 3`, `infra/index.ts:124`).
      Combined with a 300-second Scheduler deadline and 3 retries (`infra/index.ts:224-231`)
      against a sequential per-universe loop, a slow run can trigger an overlapping retry on a
      different instance, double-billing the LLM call for whichever universes are still
      in-progress at that moment. Not corrupting today (the cursor makes already-finished
      universes idempotent) but the collision window grows as universe count grows and the loop
      takes longer to finish. Worth fixing once since #294's planned nightly batch is likely to
      copy this same pattern.
      Pointers: `packages/api/src/routes/internal-universe-memory-sync.ts:9-24` (the guard),
      `infra/index.ts:215-240` (scheduler config).
      Done when: two overlapping invocations cannot both process the same universe — a DB-backed
      lock (row lock, advisory lock, or a `syncing` flag on `story_groups`) instead of a
      process-local boolean.

- [ ] Give the plotter/writer memory blocks a single reconciliation pass instead of independent
      concatenation.
      Why: `plotter.ts:133-134`/`writer.ts:99-100` concatenate the style guide (says what to
      avoid), memorable moments (encourages callbacks to liked passages), and — once
      story-retrieval merges — arbitrary retrieved past-story text, with no step checking whether
      a moment or retrieved story actually respects the style guide's current `doesntWork`/
      `minimize` conclusions. Not an observed failure yet (the mechanisms don't overlap in
      trigger conditions today), but it's the natural next place a contradiction surfaces once
      retrieval ships, and it's cheap to close now versus after a user notices a story referencing
      something the style guide says to stop doing.
      Pointers: `packages/core/src/pipeline/stages/plotter.ts:106-134`, `stages/writer.ts:60-100`,
      `load-memorable-moments.ts`, `search-past-stories-tool.ts` (story-retrieval branch,
      unmerged).
      Done when: a memorable moment or retrieved story that directly conflicts with an active
      `doesntWork`/`minimize` line is filtered out or flagged as superseded before reaching the
      prompt, rather than presented as equally-weighted guidance.

- [ ] Writer idiom examples are being copied instead of varied from.
      Why: `WRITER_SYSTEM_PROMPT_DEFAULT`'s `idiomRuleBlock` (`writer.ts`, ~line 93) lists 8
      sample idioms as illustrations with an instruction to vary which ones get used — but real
      generated text in universe #1 shows the model reusing the *same examples* verbatim across
      different stories for the same emotional beat (e.g. "как снег на голову", "душа ушла в
      пятки", "на мокром месте" each appear in 2+ of 8 stories read, always for fear/being moved).
      Illustrative examples baked into a prompt are anchoring the model instead of just
      demonstrating the category.
      Pointers: `packages/core/src/pipeline/stages/writer.ts` (`idiomRuleBlock`).
      Done when: a fresh sample of stories in one universe shows no idiom repeated across two or
      more stories — consider tracking recently-used idioms per universe and excluding them from
      the prompt, the same way `recentTitles` already tracks recent titles in
      `synthesizer-prompt-builder.ts`.

- [ ] Adult-delivers-the-lesson resolutions are slipping past the "no explicit moral" rule.
      Why: both Plotter and Writer system prompts forbid an adult stating the lesson outright, but
      3 of 8 real stories read in universe #1 resolve their core conflict via an adult's
      explanatory monologue dressed as dialogue (clearest case: story 105's dad explains love via
      a Wi-Fi metaphor, line by line). Two other stories in the same sample (96, 97) prove the
      pipeline can resolve through the child's own lived experience with zero adult explanation —
      so the rule is achievable, just not consistently enforced.
      Pointers: `packages/core/src/pipeline/stages/writer.ts` (moral-avoidance rule), `stages/
      plotter.ts` (РАЗВЯЗКА section — could require the plan itself to specify a non-verbal
      resolution event).
      Done when: a critic-stage or plotter-stage check flags plans/drafts whose resolution
      mechanism is "adult explains via extended dialogue exchange," the way anti-pattern rules
      already flag postscript-only humor.

- [ ] No mechanism prevents reusing the same conflict/resolution-mechanism shape across a
      universe's recent stories.
      Why: `story-structures.ts`/`character-lenses.ts` rotate plot skeleton and cast framing, but
      nothing tracks the underlying *emotional conflict type* (fear-soothed, jealousy-soothed,
      embarrassment-soothed) or *resolution mechanism* (adult explains vs. child self-resolves vs.
      peer helps). Confirmed via `synthesizer-prompt-builder.ts`'s `recentTitles` block (~line
      195): it only tracks titles, nothing about conflict-type or resolution history. Real effect
      in universe #1: 4 of 8 stories share the identical "child feels bad → adult reassures" arc
      despite four different assigned plot structures.
      Pointers: `packages/core/src/pipeline/synthesizer-prompt-builder.ts` (`recentTitles` block),
      `packages/core/src/pipeline/stages/plotter.ts` (where a "recent conflict-types/resolution-
      mechanisms to avoid" block would get injected, alongside the existing memorable-moments
      block).
      Done when: the plotter/writer prompt includes the last N stories' conflict-type and
      resolution-mechanism for that universe, with an instruction to pick a different resolution
      mechanism this time when thematically reasonable.

- [ ] Recurring secondary character (Artyom) is reused as a single stock function across stories.
      Why: real text in two different stories (97, 103) shows Artyom delivering the same "flat
      denial of the fanciful idea" beat in near-identical wording — the model appears to reach
      for a generic "skeptic" role for this character rather than drawing on anything specific to
      him.
      Pointers: character-bible entry for Artyom if one exists (may need a richer trait
      description beyond "skeptical"), `packages/core/src/pipeline/stages/character-lenses.ts`
      (rotation is meant to vary who plays which function).
      Done when: sampling 3+ stories featuring Artyom shows him doing something other than flatly
      denying another character's idea at least once.

- [~] Generated story illustrations default to photorealistic, not the requested cartoon/comic
      style. [→ addressed differently: instead of a text style-guide fallback, the user opted for
      admin-uploaded canonical reference images per character (see story-images-character-
      references work, same `story-images` branch, unmerged) — the uploaded images themselves now
      define the target style/appearance, superseding the text-fallback approach this item
      originally proposed. Still not fully closed: a scene with no named characters (a pure
      setting shot) has no style anchor either way — revisit once real reference images are
      uploaded and this can be checked against real output.]
      Why: found on real inspection while verifying the new story-images feature (built in
      `~/orca/workspaces/bedtime-agent/story-images`, unmerged). `deriveIllustrationPrompt`
      (`packages/core/src/pipeline/derivers/illustration-prompt.ts`) only adds a style directive
      when `visualStyleGuide` is non-empty — every universe currently has `visualStyleGuide =
      null` (brand-new field, never populated), so every universe's first-ever illustration has
      zero style guidance and the model (`google/gemini-2.5-flash-image`) falls back to its
      natural photorealistic/painterly default. Confirmed directly: a real generated image for
      story 114 is a realistic rendered scene, not cartoon/comic art, despite that being the
      explicit original ask.
      Pointers: `packages/core/src/pipeline/derivers/illustration-prompt.ts`, `character_reference_
      images` table (from the story-images-character-references migration).
      Done when: once the user uploads real character reference images and a story is actually
      generated end-to-end, confirm the output matches the intended style — if a pure
      no-character setting shot still looks wrong, that's the remaining gap to close.
