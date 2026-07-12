# Moonshine run — 5 feature build-out

Building: reaction-personalization, character-bible, styleguide-feedback, topic-nudges, words.
Structural rule: subagents create NEW files only; orchestrator owns shared-file wiring + schema + migrations.
Batch B (create-flow changes) stays uncommitted — no commits without user authorization.

## Log

- **11:50 — start** — 5 specs written to `.bmad/<feature>/spec.md`, all with no blocking forks. Task list #11–#17 created. Beginning Phase A (schema + migrations).
- **11:52 — Phase A (schema)** — Added 5 nullable text cols to `universe_characters` + `words`/`story_words` tables to schema.ts. Generated migration `0038_clammy_cannonball.sql` (pure additive), applied to dev via `npm run db:migrate` — success. Launching Wave 1 (all 5 feature subagents, new files only).
- **12:05 — Wave 1 complete** — All 5 feature subagents landed, 11 new files, all co-located tests green (reaction 14, char-bible 6, styleguide 9, topic-nudges 10, words 13). Verified files exist. Each returned a precise wiring handoff. Known: `words.tsx` won't typecheck until I add `api.words`+`Word` to api.ts (expected). Beginning Phase C (serial shared-file wiring, orchestrator-owned).
  - Note (topic-nudges): clustering is purely lexical (shared word-stem), not semantic — manual verification needs 3 topics sharing a literal stem or the banner correctly stays silent. Out of scope per spec.
- **12:35 — Phase C pipeline wiring** — Wired plotter.ts (reaction + bible blocks), plotter-series.ts (bible), orchestrator.ts (reaction/bible plan-phase loading + words marker-strip + usedWordIds), writer.ts (words block, !isRevision), pipeline-text-trigger.ts (load/record words), and threaded bibleCharacters through ALL plan paths (auto, questions, plan-redo, text-redo, series). Deviation: KEPT the compileCharacters fold in load-universe-context (spec said remove it) — removing would strip the roster from the writer since the bible block is plotter-only; keeping both = plotter sees cast softly+strictly (harmless), zero writer regression.
- **12:45 — Phase C API+web wiring** — universes route (5 char fields on create/update schemas + insert), stories.ts analyze route (loads parent_reviews+annotations → formatParentFeedback → updateStyleGuide 4th arg), style-guide-updater (param + prompt section), server.ts (/api/words mount), web api.ts (Word type + api.words client + 5 UniverseCharacter fields + char mutation payloads), app.tsx (Words route + nav), universe-characters.tsx (CharacterBibleFields in add+edit), topics.tsx + universe-detail.tsx (TopicNudges mount, +index export).
- **12:52 — VERIFY (gates green)** — Root tsc: 0 errors. Web tsc: clean (only pre-existing baseUrl TS5101). Full suite: **373 tests pass / 55 files** (was 321/49).
- **13:00 — RUNTIME VERIFY caught TWO real bugs static checks missed (advisor-flagged):**
  1. **character-bible regression (critical, FIXED):** `buildCharacterBibleBlock` emitted the strict "use ONLY these" gate for ANY non-empty roster. Real dev data confirmed universe #1 (8 chars) & #4 (6 chars) have 0 structured fields — so the gate would have fired on their next generation, excluding system-prompt-only protagonists. Fix: made it opt-in — returns '' unless ≥1 structured field is filled. Verified vs real data (all universes dormant now). +2 tests.
  2. **words marker (real, FIXED):** live writer run emitted `СЛОВА: щедрость` (the WORD, not the id). Old regex rejected alphabetic → stray line SURVIVED in saved story + no usage tracking. Fix: block now asks for words; `extractWordMarkers(text, targetWords)` maps words→ids and strips only when every token is a known word / id / нет (prose-safe). +5 tests. Re-running live writer to confirm.
  - Live writer runs cost ~$0.03 total on dev (deepseek-v4-pro), temp word cleaned up each time.
- **13:05 — FINAL GREEN** — Both fixes confirmed live: character-bible dormant for all existing universes (0 structured fields); words `СЛОВА: щедрость` → wordIds [3], line stripped from saved story. Full suite **379 tests / 55 files pass**, root tsc 0 errors, web tsc clean. Temp scripts + dev test-word removed. All 5 features complete, integrated, and runtime-verified. Nothing committed — Batch B + these changes await user authorization.

## Session 2 — prod bug investigation + more fixes

- **13:20 — DIAGNOSED 2 prod bugs (Neon + Cloud Run logs):**
  - **Bug B (story 107 stuck):** log shows `[pipeline] storyId=107 status=plan_running` then total silence. Root cause: `triggerAutoPipeline` is fire-and-forget after the HTTP response; Cloud Run reclaims the idle instance (scales to zero, maxScale 3 / no min) and kills the detached plan generation before the plotter runs. Pipeline status is in-memory only, so it's lost on recycle. Only 1 story truly stalled (107); text-phase stalls: 0.
  - **Bug A (feedback ignored on rerun, story 108):** 4 text versions, all writer_initial/writer_critic, ZERO annotated_rewrite, ZERO annotations. The only channel to the writer was highlight-span → note → redo (annotated_rewrite); the redo button sent only the story id; no free-text box. User's pasted song lyrics never reached the writer prompt.
- **13:35 — FIXED (this batch):**
  - **Story variety (#1):** new `story-settings.ts` — 30 diverse settings (travel/dream/video-game/new-place/home-with-Artём/…), rotated decorrelated from structure+lens, wired into plotter; block forbids the садик→home→sleep template, honors seed-fixed settings, and states humor is the linchpin unless the seed signals serious. +9 tests.
  - **Bug A (#2):** redo-text route accepts `instructions`, relaxes the 409, merges them into the writer's editor notes via `triggerTextRewrite`→`runAnnotatedRewrite`; text-review page gains a "Что изменить?" free-text box → `redoText(id, instructions)`. Reuses the proven annotation→writer path (no paid run needed).
  - **Telegram `/topic` + `/fragment`** (subagent): add teaching themes + fragments from chat, universe-scoped via `resolveDefaultUniverseId`, no pipeline. +5 tests.
- **Bug B (#3, Cloud Tasks durable queue) — AGREED, NOT YET BUILT.** Deferred as its own focused pass (infra + Pulumi + deploy-to-verify). Architecture Mermaid docs — separate subagent running, to land as a separate commit.
- Gates: root tsc 0, web tsc 0, **393 tests / 56 files pass**. Still nothing committed.

## Session 3 — commit + remaining features

- **14:50 — COMMITTED to branch `feature/story-pipeline-improvements` (17 logical commits):** db schema; create-flow; diverse ideas; reaction personalization; character bible; words; story settings; topic nudges; styleguide-from-feedback; pipeline wiring; bug A (rework notes); telegram topic/fragment; architecture docs; planning; allow agent analysis; durable Cloud Tasks pipeline; auto-analyze on approval. Nothing pushed/deployed yet.
- **Bug B (Cloud Tasks) built + reviewed:** durable queue with local fallback (unset env → old in-process path, so tests/dev unchanged). Reviewed dispatch fallback, worker secret-auth, all 5 callers, Pulumi queue+IAM, deploy env. root/infra tsc 0, 393 tests pass. NOT deploy-verified (needs pulumi up + GitHub secret + deploy — see todo.md). Known: analyze worker retry is not idempotent (rare dup diary/suggestion rows) — flagged, low-risk.
- **3b done:** analyze gate opened to agent stories + auto-analysis dispatched on approval, routed through the durable queue.
