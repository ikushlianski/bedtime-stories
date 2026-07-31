# bedtime-agent build log

Append-only. One entry per unit completed by `/grand-loop`.

- **2026-07-25 01:43 — adversarial review of the 3 merged features + fixes** — 4 parallel
  read-only reviewers each covered a disjoint slice (Telegram intake, diff view/patch flow,
  title variety, prompt preview). Every finding was independently re-verified by me (ran the
  actual repro in Node/vitest, read the flagged code myself) before deciding to fix.
  - **Confirmed and fixed (commits `f483ac7`, `5650a3e`, `d327ce6`)**:
    - Telegram: re-picking the universe mid-conversation silently wiped accumulated text
      (deterministic, no timing luck needed) — now carries it forward and tells the user.
    - Telegram: the pending row was deleted before the story insert was confirmed to succeed —
      a DB failure permanently lost the user's typed text with no retry path — now restores the
      row on failure instead.
    - Telegram: `appendPendingSeedText` was a racy read-then-write — replaced with a single
      atomic SQL `UPDATE ... CASE`. Added a 4000-char accumulation cap (previously unbounded).
    - Web: `derive-title-preview.ts`'s naive `.!?` regex broke on real Russian text — "А. С.
      Пушкин" previewed as just "А.", an ellipsis was read as a sentence end, and truncation
      could split an emoji into a broken glyph. Replaced with `Intl.Segmenter` (sentence +
      grapheme granularity) plus a short-fragment-merge heuristic for initials.
    - Web: `vitest.config.ts`'s jsdom glob matched all of `packages/web`, not just the new
      component test — silently moved every pre-existing web test onto jsdom. Narrowed to
      `*.test.tsx`.
    - Web: the hand-written `Intl.Segmenter` ambient type was missing `| undefined` on
      `.containing()` vs. the real lib — fixed, plus a note to delete the shim if `lib` is ever
      bumped to ES2022+.
  - **Reviewed and accepted as-is (no fix)**: title-generator's unchecked retry output and the
    `/тайн/i` regex matching unrelated words like "тайник" — both real but low-impact, bounded
    tradeoffs. A no-op-patch UX gap (no "nothing changed" indicator) — cosmetic, deferred.
  - Full suite re-verified after fixes: 76 files / 542 tests, both `tsc --noEmit` clean (root and
    `packages/web`). Still local-only on `main`, not pushed.

- **2026-07-25 01:17 — three moonshine features merged locally to `main` (not pushed)** —
  (1) interactive story-intake chat: Telegram `/new` and the web create-story modal now accumulate
  multiple messages before generating, with an explicit finalize step; story chat patches now render
  a real word-level diff (Cyrillic-aware via `Intl.Segmenter`) instead of raw replacement text.
  (2) story titles fed the universe's recent titles as anti-repetition context, with "Тайна"/
  "Волшебный" (and inflections) hard-forbidden plus a one-shot retry guard. (3) story cards now show
  a truncated first-sentence preview of the seed/prompt. All three independently re-verified by me
  after merge: `npx tsc --noEmit` clean (both root and `packages/web`, which needed a local
  `Intl.Segmenter` ambient-type shim — commit `aa9eef3` — since bumping `packages/web/tsconfig.json`'s
  `lib` is off-limits per CLAUDE.md), full suite 76 files / 537 tests green.
  - **Critical finding, fixed**: the main checkout's `.env` had `DATABASE_URL` pointing at
    **production** (`ep-sparkling-cherry-akone1cr`, confirmed via Neon MCP to belong to the
    primary/`main` branch), not a dev branch — the same misconfiguration pattern as the prior
    BEDTIME-AGENT-J incident. No migration was run against it. Created a new persistent Neon branch
    `local-dev` (`br-little-star-ak7r9lr2`, no expiry) and repointed `.env` at it before running
    `npm run db:migrate` (migration 0044, `accumulated_seed` column) — confirmed applied on
    `local-dev` and confirmed absent on prod via direct queries against both branches.
  - **Not pushed to `origin/main`** — pushing triggers this repo's CI/CD, which auto-deploys to prod
    Cloud Run with no separate deployed dev/staging target (confirmed: only one Pulumi stack, `prod`,
    exists). User asked to deploy to a dev environment first; the closest existing equivalent is
    local Docker Compose against the new `local-dev` branch. A full plan for an actual deployed dev
    Cloud Run environment already exists (drafted incidentally by the chat-feature agent, not
    reviewed) — see the top wishlist item and `.planning/unassigned/dev-deploy-environment/`.

- **2026-07-18 12:49 — universe-memory-nightly-sync** — Built and verified in an isolated
  worktree: `/private/tmp/claude-501/-Users-ikushlianski-webdata-ilya-projects-bedtime-agent/90987502-a1a3-400d-90a4-6fa366306fb3/scratchpad/worktrees/universe-memory-nightly-sync`
  (branch `universe-memory-nightly-sync`, uncommitted — review and commit manually). Plan at
  `.planning/unassigned/universe-memory-nightly-sync/` (spec.md, scenarios.md, architecture.md,
  todo.md).
  - **Backend** — proven: `npx vitest run packages/core/src/pipeline/synthesize-universe-memory.test.ts`
    passed (6/6); full suite `npx vitest run` passed (404/404, 57 files). Migration
    (`styleGuideSyncedAt` on `storyGroups`) applied to the dev DB via `npm run db:migrate`. Live
    curl against the running image: wrong secret → 401 `{"error":"Unauthorized"}`; correct secret
    → 200 `{"ok":true,"universesProcessed":4,"universesUpdated":3}`; immediate re-run →
    `universesUpdated:0` with zero LLM calls (real no-op proof). This mutated the dev DB for real —
    3 of 4 universes now have populated style-guide fields.
  - **Frontend** — N/A, confirmed untouched (`git status` shows no `packages/web` changes).
  - **Infrastructure** — `pulumi preview` clean: exactly one new resource
    (`gcp.cloudscheduler.Job "universe-memory-sync"`), one pre-existing unrelated diff on
    `catalog-sync` proven pre-existing (same diff appears before this change too, caused by a
    local placeholder secret value). `npm run typecheck` clean. No `pulumi up` run — deferred.
  - **Scenario coverage**: 9 scenarios in scenarios.md all addressed by the implementation.
    1, 2, 8 runtime-proven live; 3, 7 test-proven; 4, 5 satisfied by construction (both call
    sites now route through the same tested `syncUniverseMemory`, confirmed by code review +
    typecheck, not independently hit live this run); 6 and 9 verified by code inspection
    (per-universe try/catch leaves failed universe's row untouched; single `db.update` writes
    section fields + cursor together, no split-write path exists).
  - **Manual steps outstanding** (see `.planning/unassigned/universe-memory-nightly-sync/todo.md`
    in the worktree — not copied to the main tree):
    1. `gh secret set PROD_UNIVERSE_MEMORY_SYNC_SECRET -R ikushlianski/bedtime-stories --body "$(openssl rand -hex 32)"`
    2. `pulumi up` to actually create the Cloud Scheduler job.
    3. `npm run db:migrate` against production (the dev-branch migration run tonight does not
       touch prod).
  - **Deviation noted**: `npm run docker:up`'s bind mount doesn't work from a scratchpad
    worktree path under this machine's Docker runtime (colima only mounts `$HOME` into its VM),
    so live verification ran against a `docker build`-then-`docker run` image instead of
    compose. Worth fixing if worktree-based verification needs to be reliable going forward —
    either a colima mount config change, or placing verification worktrees under `$HOME`.

- **2026-07-18 13:51 — story-chat-comments** — Built and verified in an isolated worktree:
  `/private/tmp/claude-501/-Users-ikushlianski-webdata-ilya-projects-bedtime-agent/90987502-a1a3-400d-90a4-6fa366306fb3/scratchpad/worktrees/story-chat`
  (branch `story-chat`, uncommitted — review and commit manually). Plan at
  `.planning/unassigned/story-chat-comments/` (spec.md, scenarios.md, architecture.md, todo.md).
  - **Backend** — proven: targeted 4 deriver test files (17/17) plus full suite (420/420 across
    61 files, no regressions) pass. Migration applied for real to the dev DB via
    `npm run db:migrate` — purely additive (`CREATE TABLE story_comments`,
    `ALTER ... DROP NOT NULL` on `annotations.selected_text`, `ADD COLUMN context` on
    `plan_conversations`, no rename), inspected and confirmed by reading the generated SQL. All
    9 scenarios in scenarios.md exercised live against the dev DB with real story rows and real
    LLM calls (plan/text targeted patch + apply, whole-story banking for both plan and text,
    `redo-plan`/`redo-text` folding banked comments into one run each and resolving them,
    read-story comments recorded without mutating the story, 409 on mutate-against-finished
    naming the comments endpoint, 422 on drifted patches). `npm run typecheck` clean for both
    root (core/api) and the web workspace separately (the root command doesn't cover
    `packages/web` — running web's own typecheck surfaced and let the agent fix a real bug: a
    missing `chat_patch` case in the version-history stage-label map).
  - **Frontend** — not browser-driven (no Playwright in this repo, chrome-devtools tooling is
    off-limits per standing rule); verified via clean Vite compilation of every touched
    component plus a manual trace of the actual code paths, which caught and fixed a second real
    bug: `apply-text-patch`'s response has no `active_text` field, so the original wiring would
    have blanked the displayed text and gotten stuck — fixed by reloading the story after apply
    instead of trusting the patch response's text.
  - **Infrastructure** — N/A, confirmed untouched (`git status` shows no `infra/` changes).
  - **Scope note**: spec.md's plan to gate the generic `annotations` create route with
    `resolveChatGate` was narrowed during implementation — only the new selectionless
    (whole-story-comment) shape is gated; selection-based annotation creates (existing child
    reactions / notes) stay ungated on `read`/`ready` stories, since those are a pre-existing,
    still-used feedback path into the synthesizer, not something this task was asked to close
    off. Verified live: reactions/notes-with-selection still 201 on a `read` story; the new
    selectionless case now correctly 409s.
  - **Unplanned fixes beyond spec.md's file list**, required because the nullable
    `annotations.selected_text` change ripples further than spec.md named:
    `packages/core/src/pipeline/derivers/format-parent-feedback.ts` and
    `packages/core/src/pipeline/synthesizer-prompt-builder.ts` both assumed `selectedText` was
    always a string — left alone they'd have been type errors, or (if silenced) printed literal
    `«null»` into prompts sent to the model. Both now render null selections as a general-comment
    phrase.
  - **Plan/implementation drift note**: spec.md's "Files to create" table lists only 4 deriver
    files but its own "Derivers" table and "Implementation order" step 3 require a 5th
    (`parse-patch-block.ts`) — created it since the plan is internally inconsistent on this one
    point; its tests run clean under the full suite.
  - **Merge-time collision to resolve**: this worktree's migration
    (`0039_aspiring_colossus.sql`) and the earlier `universe-memory-nightly-sync` worktree's
    migration (`0039_lethal_cloak.sql`) share the same number — both branched from the same base
    commit independently. Whoever merges these branches needs to renumber one of them (drizzle-kit
    can regenerate the journal) before both land on `main`.
  - **Manual steps outstanding**: none — `todo.md` stated none were required and the build
    confirmed none turned out to be needed.

- **2026-07-18 16:52 — story-chat consolidation + merge to prod** — Built directly on top of the
  `story-chat` branch (issue #293), then merged and deployed. User-requested consolidation: the
  text-review screen had three near-duplicate "do another pass" buttons (`redo-text`,
  `critique-text`, and plan-review's `redo-plan`), and no reliable path for a whole-story (not
  selection-tied) comment to reach a regeneration pass.
  - **Audit finding**: whole-story banked comments (stored in `annotations` with a null
    `selected_text`, added by the story-chat branch) already reached both `redo-text` and
    `redo-plan` before this work — no gap there. The real gaps were: `critique-text` was
    confirmed dead code (hardcodes `writerCriticOutput = { issues: [], improvement_needed: false
    }`, never calls the actual unused `runWriterCritic` stage — it just re-ran the Writer with a
    differently-scoped annotation query, no distinct critique step existed); the free-text
    "reason" field only existed on the text side and was discarded after one use, never
    persisted; there was no per-call model override.
  - **Backend** — deleted `critique-text` route, `triggerTextCritique`, and
    `pipeline-text-critique.ts` entirely (confirmed via `grep -rn critiqueText` returning
    nothing). New shared `packages/api/src/routes/gather-redo-feedback.ts` is now the one place
    both `triggerPlanRedo` and `triggerTextRewrite` (renamed from the old critique file) pull
    feedback from — unresolved annotations (selection + banked whole-story) plus the optional
    reason, concatenated into one prompt block every time. The reason is now persisted into
    `story_comments` with a new `source: 'revision_reason'` column (migration
    `0040_needy_wrecker.sql`, additive) instead of being thrown away. Both actions accept an
    optional one-off `model` override, a plain pass-through — not a persisted setting — distinct
    from the existing `stories-swap-model.ts` feature, which was left untouched.
  - **Frontend** — `text-review.tsx` and `plan-annotator.tsx` each now show exactly one revision
    button ("Отправить на доработку") next to the existing approve button ("Готово для Саши",
    unchanged), with an optional reason textarea and a collapsed "Другая модель" field. The
    critic button is gone from the UI.
  - **Verification**: 427/427 tests pass (root suite), `npx tsc --noEmit` clean for both root and
    `packages/web` separately — all re-run independently in this session, not just accepted from
    the building agent's report. Live proof against the dev DB: a `redo-plan` call and a
    `redo-text` call each demonstrably folded in a selection annotation, a banked whole-story
    comment, and a typed reason into one pass — confirmed via resolved annotation summaries, the
    regenerated content itself, and a persisted `story_comments` row for the reason.
  - **Merge & deploy**: committed to `story-chat` (bfeaedd, dce9d17), fast-forward merged into
    `main` (no conflicts, no rebasing needed), re-verified on `main` itself (427/427 tests, both
    typechecks clean), pushed to `origin/main`. GitHub Actions run `29646846474`: Test job green,
    Infra (`pulumi up`) green, Deploy job green including "Run database migrations" (0039 + 0040
    applied to the **production** Neon DB) and a passing post-deploy health check.
  - **Deliberately left out of this merge** (per explicit scope decision): `universe-memory-
    nightly-sync` (issue #292) and `nightly-character-extraction` (issue #294) — both unrelated
    to this consolidation and still sitting in their own separate worktrees, untouched.

- **2026-07-18 19:50 — telegram-two-step-new (#295)** — Planned (auto-confirmed) and built in
  worktree `~/orca/workspaces/bedtime-agent/telegram-two-step-new` (branch same). `/new` now
  shows an inline keyboard of universes; the chosen universe is stored per-`chat_id` in a new
  `telegram_pending_actions` table (a DB table, not an in-memory map, since Cloud Run's
  `bedtime-api` has no `minScale` and can scale to zero or route consecutive requests to
  different instances between the two steps of the flow) with a 30-minute expiry; the next text
  message becomes that story's seed under the explicitly chosen universe, bypassing the existing
  ID-lookup/default-universe fallback. Every other Telegram interaction is unchanged.
  - **Verification**: keyboard/reply shape proven via `telegram-new-flow.test.ts` intercepting
    grammy's outgoing Bot API calls; DB side effects proven live via real webhook POSTs against a
    disposable Neon branch (`telegram-two-step-new-verify`, 1-week TTL, never touched prod/dev) —
    a universe pick wrote the pending row, the next message created a story under that exact
    `group_id` and deleted the pending row, and a plain numeric message with no pending state
    still went through the old ID-lookup path untouched.
  - **Merge & deploy**: merged into `main` (fast-forward, migration `0041_lush_madame_web.sql`).
    First push (`29652634459`) failed the Test job: `telegram-pending-action.test.ts` was the only
    new test file that didn't mock `@bedtime/core/db/client`, so importing it pulled in eager Zod
    env validation with no DB credentials present in CI's `test` job (by design — only the
    `deploy` job gets secrets) — a real gap, not a flake. Fixed by mocking the client the same way
    every other test file already does, verified locally by re-running the full suite under a
    stripped-down `env -i` shell to reproduce CI's conditions before pushing again. Retry
    (`29652704627`) succeeded: Test, Infra, and Deploy all green, including the migration against
    prod and the post-deploy health check. One retry out of the 10 allowed.

- **2026-07-18 20:00 — universe-memory-nightly-sync review, fix, and deploy (#292)** — User asked
  for a critical review, not a straight merge, of the already-built (2026-07-18 12:49) but
  unmerged sync job before shipping it. Reviewed against this repo's mandatory agentic-app
  principles (`ai-dev/docs/principles/001-building-agents.md`, `002-ai-agent-mistakes.md`), since
  this is an autonomous nightly LLM batch job with no human in the loop.
  - **Drawbacks found and fixed** (worktree
    `~/orca/workspaces/bedtime-agent/universe-memory-nightly-sync`):
    1. Raw parent/child feedback text sat directly next to model instructions in the synthesis
       prompt, with nothing distinguishing "content to analyze" from "commands to obey" — a
       stray phrase in a note could have permanently steered how the model writes every future
       story in that universe. Fixed with explicit data-only delimiters; proven with a test that
       plants an injection attempt and asserts it stays inert.
    2. A malformed/empty LLM response for one universe was treated identically to "nothing new to
       sync" — no error, no Sentry alert, a misleading "not enough data" message on the manual
       button when the real cause was a broken LLM call. Fixed to throw and surface honestly,
       while the batch still isolates the failure to that one universe.
    3. An overlapping scheduler retry could have doubled a night's LLM spend per universe. Fixed
       with an in-process reentrancy guard returning `{skipped:true}` at HTTP 200 (200, not an
       error, so Cloud Scheduler's retry policy doesn't retry again) — proven live by firing two
       concurrent requests and confirming only one LLM call ran.
    4. The per-universe sync cursor was stamped after the LLM call returned rather than before it
       started, leaving a ~45-second window where feedback left during that call would be
       silently skipped forever by the next run's "what's new" query. Fixed by capturing the
       cursor before querying the feedback delta.
    - Unbounded token growth (the one risk expected going in) was checked and found to already be
      handled correctly in the original build — confirmed, not re-fixed.
  - **Migration renumbering, twice.** The branch's migration collided with `main` first against
    `story-chat`'s `0039` (rebased, regenerated cleanly as `0041` by the building agent), then
    again against `telegram-two-step-new`'s `0041` (merged in the meantime) — resolved by
    rebasing onto the newest `main`, restoring `main`'s real `0041_lush_madame_web` snapshot
    (an early conflict-resolution attempt on my part mistakenly deleted it instead of keeping it,
    which briefly made drizzle-kit regenerate the Telegram table a second time — caught by
    diffing the regenerated SQL before committing, not assumed correct), and regenerating fresh
    as `0042`. The dev Neon branch already had the target column from earlier testing under the
    old filename; reconciled by inserting one bookkeeping row into
    `drizzle.__drizzle_migrations` with the new file's actual computed hash — a metadata-only
    fix, not a hand-written schema change. Production had never seen any version of this
    migration.
  - **Verification**: 449/449 tests (up from 427, new tests for the fixes), `npx tsc --noEmit`
    clean — re-run independently after every rebase step, not just accepted from the reviewing
    agent's report.
  - **Deploy**: found `.github/workflows/deploy.yml` and `infra/index.ts` reference a
    `PROD_UNIVERSE_MEMORY_SYNC_SECRET` GitHub secret that was never actually set (a manual step
    flagged back on 2026-07-18 12:49 and still outstanding) — set it
    (`gh secret set ... --body "$(openssl rand -hex 32)"`) before pushing, since deploying
    without it would have shipped a broken or open internal endpoint. Merged to `main`
    (fast-forward), pushed, GitHub Actions run `29653024131`: Test, Infra (new Cloud Scheduler job
    created), and Deploy all green on the first attempt, including the migration against prod and
    the post-deploy health check.

- **2026-07-18 20:32 — memorable-moments recall (#296)** — Planned (auto-confirmed) and built in
  worktree `~/orca/workspaces/bedtime-agent/memorable-moments` (branch same), no schema/migration
  change. New `load-memorable-moments.ts` queries the `annotations` table directly (a live query
  at generation time, not the nightly-sync memory store — decided this was simpler and fresher
  than extending the overnight job for a "sometimes, if it fits" flourish) for
  `sasha_laughed`/`sasha_loved` reactions in the same universe, excluding the current story,
  capped at 3 deduped candidates. `stages/memorable-moments.ts` wraps them in the same data-only,
  anti-injection delimiters used by the hardened universe-memory prompt, with explicit
  instructions that using a moment is optional and must never be forced. Both `plotter.ts` and
  `writer.ts` accept this as optional context, following the existing `bibleCharacters`/
  `styleGuide` injection pattern. `universeId` is now threaded through `runTextPhase`/
  `runWriterOnly` and the three redo route call sites that previously received it but never
  forwarded it — as a side effect, plan-redo's pre-existing `reactionSummary` injection is now
  live for the first time on that path too (documented in spec.md, not accidental).
  - **Verification**: 470/470 tests (up from 449), `npx tsc --noEmit` clean — re-run
    independently after merge. Live proof on a disposable Neon branch (seeded with a real
    annotation) confirmed the wrapped passage reaches both the plotter and writer prompts for a
    qualifying universe, is entirely absent for one with none, and is excluded when the current
    story owns the annotation. Verify branch deleted after merge (user-approved).
  - **Merge & deploy**: fast-forward merge, re-verified on `main`, pushed, GitHub Actions run
    `29654041012`: Test, Infra, Deploy all green on the first attempt — no retry needed for this
    one.

All four wishlist items from this run (#292, #293 carried over from earlier today, #295, #296)
are now merged to `main` and live in production. Remaining open work: `nightly-character-
extraction` (#294) is still building independently in its own worktree/session, untouched by this
run.

- **2026-07-18 22:53 — tweakable story structure/lens** — Built in worktree
  `~/orca/workspaces/bedtime-agent/tweakable-story-structure` (branch same). Parents can now pick
  a specific plot structure and character lens when creating a story (two dropdowns in the
  create-story modal, both default to "Auto" = today's rotation-by-storyId, unchanged). Once
  chosen, the choice persists on the story (`structure_key`/`lens_key`, nullable, additive
  migration `0043_rare_changeling.sql`) and every redo/regenerate reuses it rather than re-rolling.
  Closes the gap flagged by the user: previously only the Plotter ever saw the chosen structure —
  the Writer had no signal at all. Both stages now resolve the same choice independently via a new
  `resolve-story-structure-choice.ts`, mirroring the `loadMemorableMoments` pattern (no single
  call site exists where both stages run together, so per-call resolution by storyId is what makes
  this safe). "Create series" intentionally still ignores the two selectors — series generation
  varies structure across its drafts by design, so a fixed override would work against its
  purpose; the UI now says so under each selector.
  - **Verification**: 488/488 tests, `npx tsc --noEmit` clean (root + `packages/web`) — re-run
    independently after merge. Live proof: `POST /api/stories` with an explicit
    `structureKey`/`lensKey` returns `201` with both echoed back; an unknown key returns `400`
    with a clear error; the real Plotter and Writer prompts for that story both contained the
    same chosen structure/lens text; a simulated redo reused the identical stored choice; a story
    created with no explicit choice kept today's rotation-by-storyId behavior in both prompts.
  - **Merge & deploy**: fast-forward merge (no migration collision — branched from the current
    main tip), re-verified on `main`, pushed, GitHub Actions run `29658644947`: Test, Infra,
    Deploy all green on the first attempt.

- **2026-07-19 — real prod incident: Telegram /new stalled after picking a universe (Sentry
  BEDTIME-AGENT-J)** — Separate from the earlier same-day false alarm above. Root cause: the
  `telegram_pending_actions` table (migration `0041_lush_madame_web.sql`) never actually got
  created on production, even though the file was correct and every deploy reported the
  migration step as successful. Traced to my own earlier mistake: a "dev-only" migration
  bookkeeping fix (see the universe-memory-nightly-sync entry above) was actually run against
  production, because `.env` — believed to point at a separate dev Neon branch — has pointed at
  the same database as production since that branch was archived on 2026-05-15 (memory
  `reference_neon_dev_branch.md` corrected). That write inserted a `drizzle.__drizzle_migrations`
  row with a timestamp that made the migrator treat migration 0041 as already applied, so it was
  silently skipped on every subsequent deploy.
  - **Fix**: created the missing table + FK constraint directly on prod (exact DDL from the
    migration file, nothing improvised) and corrected the bookkeeping row's hash. Verified by
    running the exact failing query from the Sentry stack trace directly against prod — succeeds
    with 0 rows affected, no error. `npm run db:migrate` against prod now completes as a clean
    no-op, confirming state is fully consistent again.
  - **Hardening**: per user request, made every migration created this session (`0039`–`0043`)
    idempotent — `CREATE TABLE`/`ADD COLUMN` → `IF NOT EXISTS`, `ADD CONSTRAINT` → wrapped in
    `DO $$ ... EXCEPTION WHEN duplicate_object THEN null; END $$;` — following the conversion
    table in the `ie-squash-and-rebase` skill's migration-idempotency step (ai-dev repo). Proved
    genuinely idempotent, not just visually correct: re-ran each file's actual SQL directly
    against prod, where every object already exists, and confirmed zero errors across all five.
    Committed directly to `main` (d997601) and deployed — GitHub Actions all green.

- **2026-07-18 ~22:00 — Telegram/Sentry false alarm, not a code bug** — User reported four
  Sentry errors (`getUpdates 409 conflict`, two `sendMessage: chat not found`,
  `answerCallbackQuery: query too old`) around 16:35-16:39 UTC. Investigated via actual GCP Cloud
  Run logs for the `bedtime-prod` project (not just Sentry) before assuming anything: zero webhook
  requests hit the real deployed service in that window, and zero matching error text anywhere in
  `bedtime-prod` logs over the last 7 days. Root cause: `nce-verify` (the disposable Docker
  container from the nightly-character-extraction build, still running 8 hours later) had
  `TELEGRAM_ENABLE_POLLING=true` plus the *real* bot token and the *real* `SENTRY_PROJECT=
  bedtime-agent` in its env — its long-polling collided with the real bot's webhook and its
  errors landed in the same Sentry project the user checks for production, making test noise look
  like a live incident. Fixed by stopping and removing the container (no code change needed).
  Confirmed clean afterward: `getWebhookInfo` on the real prod bot token shows the correct webhook
  URL, `pending_update_count: 0`, no `last_error_message`. No other stray containers found running.

- **2026-07-21 01:34 — story-retrieval (#297), built and independently verified, NOT yet merged**
  — Gives the plotter a model-initiated `search_past_stories` tool backed by pgvector cosine
  search over embedded past-story text, instead of only ever seeing pre-fetched context. Planned
  and built overnight in `~/orca/workspaces/bedtime-agent/story-retrieval` (branch
  `story-retrieval`, one commit `7c4992b` on top of `main`@`d997601`). Plan at
  `.planning/unassigned/story-retrieval/` (spec.md/scenarios.md/architecture.md all
  `state: confirmed`, consistency gate passed 0 gaps before auto-confirm — spot-checked directly,
  not taken on the planning agent's word). Architecture decisions (vector search, OpenRouter
  `openai/text-embedding-3-small`, pgvector on Neon) were resolved with the user in conversation
  before planning started.
  - **Backend** — proven independently by me, not just self-reported by the building agent:
    `npx vitest run` on the four new/touched test files — 36/36 pass. `npx tsc --noEmit` clean.
    Ran the real backfill against a disposable Neon branch (`story-retrieval-verify`,
    `br-sparkling-dust-ak6qe4kz`, expires 2026-07-21T10:00 UTC — this worktree's `.env` was
    deliberately pointed there, never at the real `.env`, which has pointed at production since
    the actual dev branch was archived — see the BEDTIME-AGENT-J entry above for why that
    distinction matters this session): wrong secret → 401, correct secret → embedded all 67
    pre-existing `read` stories, immediate re-run → `embedded: 0` (idempotent). Independently
    re-queried the branch myself: `pg_extension` shows `vector` installed; every embedding row is
    a real 1536-dim vector; a direct cosine-distance query against the live data returns the
    queried story at `distance = 0` and a plausible ranked list of thematically related stories in
    the same universe (e.g. a story about "Антон" surfaces "Поиск рыцаря Антона" as its closest
    neighbor) — retrieval genuinely works, not just "rows exist." Retrieved story text is wrapped
    in an explicit Russian-language data-only delimiter (matches the existing anti-injection
    pattern already used for memorable moments / universe memory) — read directly, confirmed
    present in `search-past-stories-tool.ts`.
  - **Infrastructure** — migration `0044_story_embeddings.sql` is idempotent (re-ran its raw SQL
    a second time directly against the verify branch — no error; a second `npm run db:migrate`
    alone wouldn't prove this, since drizzle's migrator skips already-applied files by journal
    entry, not by re-checking the SQL). No Pulumi/`infra/index.ts` change — correctly out of
    scope, no Cloud Scheduler job involved.
  - **Frontend** — N/A, not touched (retrieval has no UI surface).
  - **Bug found, NOT part of this task, filed separately** — while proving the delete-cascade
    scenario, the implementing agent (and I, independently, by tracing the orphaned rows below)
    found that `DELETE /stories/:id` (`packages/api/src/routes/stories.ts`) deletes across many
    tables with no surrounding transaction. It already fails with a foreign-key violation today
    for any story referenced by `model_swap_events` or `child_reactions` — pre-existing, unrelated
    to this task. Because this task's new `story_embeddings` delete runs early in that same
    unwrapped sequence, testing it against two real stories that happen to be referenced by those
    tables left them with their embedding silently deleted while the story itself survived (the
    overall delete failed partway through, on the verify branch only — production untouched).
    Filed as a new wishlist item below since it's a real data-integrity gap independent of #297.
  - **Not yet done**: not merged to `main`, not deployed, wishlist checkbox left unticked on
    purpose — this introduces a new GitHub secret (`PROD_EMBEDDING_BACKFILL_SECRET`) and a new
    pgvector extension dependency, both worth a human look before going to prod. `todo.md` in the
    worktree lists the exact remaining manual steps (secret creation, triggering the prod
    backfill once, watching the first live Langfuse trace to confirm OpenRouter accepts the
    `tools`/`tool_calls` wire shape for real — that exchange was only unit-tested with mocks this
    run, never exercised against a live model).

- **2026-07-22 01:14 — Investigation-only round: chat, memory, and story variety audits** — Three
  parallel read-only audits (no code changes), each verified against real code and real
  production data rather than speculation, produced 12 new wishlist items (all filed above,
  unstarted):
  - **Chat (agentic-dev lens)** — found that comments left on finished/read stories are stored
    and displayed but never actually reach universe memory synthesis, despite #293's own
    "Done when" promising exactly that; found user-typed chat/comment text reaches real
    generation prompts with no data-only delimiter framing (the same codebase already solved
    this correctly for memorable moments and universe-memory sync — the chat path was left
    unguarded); found conversation history and banked comments are both resent/folded with no
    cap (small today — largest real thread is 4 messages, largest comment bank is 2 — but
    unbounded going forward). Confirmed the earlier redundant-regenerate-button bug from
    2026-07-18 is genuinely fixed, no remaining redundant-call pattern.
  - **Memory (agentic-dev lens)** — found the nightly sync's own bounding mechanism (newest-50-
    stories window) permanently drops older feedback: verified directly in production, universe
    1 has 96 stories, 46 outside the window, carrying 137 annotations that will never be synced.
    Found a latent staleness bug — editing a parent review/reaction after its story already
    synced never reaches the style guide, since the delta query filters on `createdAt` not
    `updatedAt` (confirmed real edits happen days-to-weeks later; the specific failure hasn't
    fired yet only because no edited row has coincided with a completed sync so far). Found the
    reentrancy guard is in-process only, not cross-instance (Cloud Run allows 3 instances) —
    narrower than initially suspected (cursor already protects finished universes) but a real,
    growing collision window. Flagged that three independent memory mechanisms (style guide,
    memorable moments, and the still-unmerged story-retrieval tool) get concatenated into one
    prompt with no reconciliation step, so a retrieved story could someday contradict what the
    style guide just said to avoid.
  - **Story variety (writer lens)** — read 8 real completed stories in full from the
    highest-volume universe, not just code. Important caveat surfaced and preserved in the
    wishlist items: all 8 stories predate the Writer-side structure/lens fix that shipped
    2026-07-18 19:50 UTC, so this sample can't yet show whether that fix works — worth re-running
    the same read against post-07-18 stories once enough exist. Found the writer's own
    illustrative idiom examples get echoed near-verbatim story to story (anchoring effect) despite
    an explicit instruction to vary them; found 3 of 8 stories resolve via an adult explaining the
    lesson through dialogue, slipping past the "no explicit moral" rule on a technicality (2 of 8
    prove the rule is achievable without this); found no mechanism tracks or steers away from
    reusing the same underlying conflict/resolution shape across a universe's stories, independent
    of plot-structure rotation (4 of 8 share the identical "child feels bad → adult reassures"
    arc despite different assigned structures); found one recurring side character (Artyom) reused
    as an identical stock "skeptic" function across two stories. Explicitly confirmed as genuinely
    working, not just as a caveat: setting variety (no repeated locations across the sample),
    Mira's consistent voice across 4 stories, and 2 of 8 stories that fully achieve the intended
    "show don't tell" resolution with zero adult moralizing — proof the target behavior is
    reachable by this pipeline already.

- **2026-07-22 02:16 — story-retrieval RAG upgrade, built and independently verified, NOT yet
  merged** — Following up on last night's #297 build: user asked for a real RAG-best-practices
  review rather than a duplicate rebuild, so this extends the same `story-retrieval` branch (now
  at `eff371c`, two new commits on top of `7c4992b`) instead of starting fresh. Plan at
  `.planning/unassigned/story-retrieval-rag-upgrade/` (separate from the original #297 plan, all
  `state: confirmed`). Investigated 6 real RAG levers (chunking, re-ranking, hybrid search,
  retrieval evaluation, multi-query expansion, embedding model choice) against the actual code and
  actual embedded data — 5 of 6 concluded "no change warranted" with reasoning on record, one real
  change: swapped the embedding model from `openai/text-embedding-3-small` (1536-dim,
  English-tuned) to `baai/bge-m3` (1024-dim, cheaper, multilingual). Direct A/B testing against the
  real 96-story corpus showed the old model missing the obviously-right story for both a
  darkness-themed query and a character-named query; independently re-verified myself against a
  fresh Neon branch after implementation (not just trusting either agent's numbers): 96/96 rows
  correctly re-embedded at 1024 dims, a 1536-dim insert correctly rejected, both anchor queries
  ("история с Максимом" -> story 42 "Мир Максима"; darkness query -> story 108 "Тайна свечи и
  песенки") rank the right story at #1, vitest 26/26 relevant tests pass, `npx tsc --noEmit`
  clean. Added a manual `npm run eval:retrieval` script (recall@5 = 0.883 on the real corpus) —
  deliberately not wired into CI since CI has no DB/OpenRouter credentials today.
  - **Cleanup needed**: the original verify branch from last night (`story-retrieval-verify-2`,
    `br-autumn-wind-aksp38a6`) has stale 1536-dim leftover data from the mid-investigation state —
    left untouched rather than autonomously reset/dropped; it self-expires 2026-07-22T11:00 UTC
    either way. The implementation agent created a fresh sibling branch
    (`br-royal-fire-akoqjfgo`, expires 2026-07-23T11:00 UTC) for the destructive-schema testing
    instead.
  - **Still not merged** — same reasons as last night (new secret, new extension dependency) plus
    now also a model swap that hasn't seen a live model call outside testing.

- **2026-07-22 02:29 — story-images (illustration generation), built and independently verified,
  ONE REAL DEFECT FOUND on inspection, NOT yet merged** — New feature in its own worktree
  (`~/orca/workspaces/bedtime-agent/story-images`, branch `story-images`, commit `fa658bb` on top
  of `main`@`d997601`). On story approval, generates up to 3 illustrations (opening/climax/
  resolution) via a cheap scene-picker LLM call + OpenRouter's `google/gemini-2.5-flash-image`,
  stored in the existing (previously unused) `bedtime-prod-storage` GCS bucket, served through an
  authenticated proxy route. Plan at `.planning/unassigned/story-images/`, all `state: confirmed`.
  - **Verified independently, real cost incurred (~$0.31 by the implementing agent, this session
    only, against the disposable verify branch)**: 76/76 test files, 514/514 tests pass; `tsc
    --noEmit` clean; migration applied and proven idempotent; a real story (114) generated 3
    real `ready` `story_images` rows with real GCS paths. I pulled one image directly from GCS
    myself (`gcloud storage cat`) and confirmed a genuine 1024×1024 PNG. I independently confirmed
    the GCS bucket has no public-read grant (`gcloud storage buckets get-iam-policy` — only
    project owner/editor/viewer legacy bindings, no `allUsers`).
  - **Real defect, caught only by actually looking at the generated image, not by any automated
    check**: the picture is realistic/painterly, not cartoon or comic style as originally
    requested. Root cause, confirmed by reading `derivers/illustration-prompt.ts`: the prompt only
    includes a style directive `if (visualStyleGuide && visualStyleGuide.trim())` — every universe
    currently has `visualStyleGuide = null` (it's a brand-new field, never populated), so every
    universe's first-ever generation carries zero style guidance and falls back to the model's
    natural photorealistic default. This isn't an edge case — it's the default state for every
    universe today. Neither building agent caught this: the implementing agent's own frontend
    proof was a byte/content-type check on the HTTP response, not a visual look at the actual art.
    Left unfixed pending a decision on the exact style wording, since that's a creative-direction
    call, not a mechanical bug — see wishlist.
  - **Also flagged for human review**: `pulumi up` was never run (new bucket-scoped
    `storage.objectAdmin` binding for `api-sa` exists only in source — `pulumi preview` couldn't
    run locally, `PULUMI_CONFIG_PASSPHRASE` in the worktree's `.env` doesn't decrypt
    `Pulumi.prod.yaml`; documented in the worktree's `todo.md`). No real browser was available to
    verify frontend rendering — proof was a direct authenticated HTTP byte-check instead.

- **2026-07-22 10:15 — story-images: user-uploaded character reference images, built and
  independently verified, NOT yet merged, ONE REAL DEPLOY BLOCKER FOUND** — Same branch
  (`story-images`, now `9ff7df6` on top of `fa658bb`). Directly addresses last night's
  photorealistic-default finding by replacing the auto-bootstrap-from-first-generation mechanism
  (fully removed: `story_groups.reference_image_path`, `deriveReferenceImageUpdate`) with
  admin-uploaded canonical reference images per character (`character_reference_images` table).
  Generation is now refused entirely — before any paid API call — for any scene naming a
  character with zero uploaded references. Plan at
  `.planning/unassigned/story-images-character-references/`, all `state: confirmed`.
  - **Independently re-verified, not taken on the implementing agent's word**: 80/80 test files,
    541/541 tests pass; `tsc --noEmit` clean. Queried the real data myself: story 125 (character
    has a reference) shows 2 `model_calls` rows at `stage='illustration_image'` totaling ~$0.078,
    both `story_images` rows `status='ready'`, `reference_image_used=true`. Story 126 (character
    missing a reference) shows **zero** `illustration_image` model_calls rows at all — the paid
    API was genuinely never invoked — with 3 `story_images` rows correctly `status='failed'`,
    `failure_reason` naming the missing character. Confirmed the new table's real shape and that
    `story_groups.reference_image_path` is genuinely gone, both via direct schema query, not by
    reading the migration file. Ran the new permanent regression test
    (`story-images-reference-gate.test.ts`) myself — 4/4 pass, stays in the suite as a standing
    cost-safety guard against this regressing later.
  - **Real deploy blocker, confirmed independently**: `gcloud storage buckets get-iam-policy` on
    `bedtime-prod-storage` shows zero bindings for the `api-sa` service account — only legacy
    project owner/editor/viewer roles. The `BucketIAMMember` granting `api-sa` access exists only
    in Pulumi source (from the original, still-unmerged `story-images` work) and has never been
    applied. **Nothing in the entire story-images feature — original illustration generation or
    this reference-image addition — will work under the real Cloud Run identity until `pulumi up`
    runs.** All positive testing so far has used personal owner credentials, not the production
    service account.
  - **Real, unanticipated LLM behavior**: grounding the scene-picker with canonical character
    names caused it to occasionally name a character not actually in the scene text (observed
    twice: once misnaming a side character, once inventing "мама"). Fails safe (blocks the scene
    rather than mis-spending), but means fewer illustrations may generate in practice until every
    named character has references uploaded — not a bug to fix, just an expected consequence
    worth knowing about.
  - **Process note**: the implementing agent amended its commit once (to fold in a small UI
    polish) instead of creating a second commit — flagging since it's a deviation from the
    default convention of new-commits-over-amends, though low-stakes here since the branch is
    local and unpushed, no shared history affected.
