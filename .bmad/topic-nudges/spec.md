# Smart Topic Nudges — Implementation Spec

Status: planning only. No code, no migrations, no edits to existing files were made while writing this.

## 1. Business goal (scenarios)

Parents accumulate teaching themes in the **Topics** list ("темы для будущих историй") over time — one at a time, without a plot. Today nothing tells them when a natural story has quietly formed out of what they already collected. Smart Topic Nudges closes that gap by noticing when several related topics pile up and gently offering to turn them into one story.

Scenarios that now work differently:

- **A cluster forms, the parent gets nudged.** A parent has added "Честность, когда соврать проще", "Страшно сказать правду, но надо", and "Первый раз соврал и что из этого вышло". A soft banner appears: *"У тебя 3 темы про честность — собрать из них историю?"* with a single button that opens the existing create-story flow, seed and universe already filled in from those three topics. The parent reviews and confirms — or closes the modal. Nothing is created behind their back.
- **The parent stays in control.** The nudge is display-only. It never creates a story, never triggers the pipeline, never writes anything. It is a suggestion the parent accepts with a deliberate click inside the normal create-story modal.
- **Acted-on clusters stop nagging.** Once the parent has woven a cluster into a story through the existing topics→story flow (which marks those topics as used), that cluster no longer qualifies and the banner disappears on its own — no dismiss button, no new state to track.
- **Weak signals stay quiet.** Two loosely-related topics, or three topics about completely different things, produce no banner. The feature only speaks when the signal is strong enough (default: 3+ topics sharing a theme word).

## 2. Architecture

Flow: **accumulated topics → pure deterministic clustering → nudge banner (display-only) → existing create-story modal (parent confirms)**.

- **Fully independent of the plotter/writer pipeline.** This feature does not call the LLM `topic-combiner`, `idea-suggester`, or any generation stage. Clustering is a pure, heuristic, deterministic function — no LLM, no DB, no env. It is deliberately *not* the AI combo-suggestion path that already exists on the Topics page; that path stays untouched.
- **Clustering runs client-side over already-loaded topic data.** No new API endpoint. The Topics page already holds the full topic list in state; the universe-detail page gains one topic fetch (see §5). We compute nudges in the browser from data already on hand — this is the recommended, lighter option and avoids a round-trip and a new route.
- **Reuse of the existing create-story flow.** The nudge button routes to the app-wide global create-story modal via URL params (`?modal=create&seed=<synthesized>&groupId=<universeId>`), which `GlobalStoryModals` (mounted app-wide in `app.tsx`) already interprets. The seed is synthesized from the cluster's topics using the existing pure `synthesizeSeedFromTopics` in `packages/core/src/pipeline/topic-derivers.ts`. No new generation path is built.
- **Web imports core directly.** The `@bedtime/core/*` path alias (tsconfig + Vite) already lets web import pure core modules (e.g. `model-picker.tsx` imports `@bedtime/core/pipeline/pipeline-stages`). The new pure clustering module lives in core and is imported by the new web component the same way. Because it is a leaf module with no DB/env imports, pulling it into the browser bundle drags in nothing heavy.

### Consequence that shapes the design: nudges must self-resolve

The global create-story modal carries a **seed string only — never topic IDs**. So a story created this way is **not** linked through `story_topics`, and `usedCount` for those topics never increments via the nudge path. On its own that would make the same cluster re-nudge forever.

Resolution, with **no new state**: **clustering only considers topics with `usedCount === 0`.** If the parent later weaves those topics into a story through the existing Topics-page combo/generate flow (which *does* write `story_topics` and bumps `usedCount`), the cluster naturally dissolves and the banner goes away. This keeps the feature stateless and honest: the nudge disappears exactly when the underlying topics have been used.

## 3. Data model changes

**None.** The `topics` (id, title, note, universeId, rank, usedCount-derived) and `story_topics` tables already exist and are sufficient. There is no theme/category column, and we do not add one — clustering derives themes heuristically from `title` + `note` text at runtime. No migration.

## 4. New files to create

1. **`packages/core/src/pipeline/topic-nudges.ts`** — pure, DB-free, env-free clustering core.
   - Zod schemas:
     - `TopicNudgeInput` — `{ id: number, title: string, note: string | null, universeId: number | null, usedCount: number }` (subset of the topic row the UI already has).
     - `NudgeCandidate` — `{ keyword: string, topicIds: number[], count: number }` (plus, for display convenience, the matched topic titles can be re-derived by the caller from IDs, or included as `titles: string[]`).
   - `computeTopicNudges(topics: TopicNudgeInput[], opts?: { threshold?: number }): NudgeCandidate[]`
     - Default `threshold = 3`.
     - Considers **only** topics with `usedCount === 0` (see §2 self-resolution).
     - Normalization (deterministic): lowercase → replace `ё` with `е` → strip punctuation → split on whitespace → drop a small Russian/utility stopword set → drop tokens shorter than ~4 chars → light suffix trim (crude stem: chop a short list of common Russian inflectional endings so "честность"/"честный"/"честно" collapse to a shared stem). Tokenize `title` + `note` together.
     - Cluster by shared normalized token (single-linkage on shared stem): each stem that ≥ `threshold` distinct topics share becomes one candidate. A topic may appear in more than one candidate (it can be honest *and* about fear); that is acceptable.
     - Deterministic output ordering: by `count` desc, then `keyword` asc. Stable, no `Math.random`, no `Date`.
   - No comments (per CLAUDE.md).

2. **`packages/core/src/pipeline/topic-nudges.test.ts`** — co-located vitest, DB-free. Concrete cases in `describe`/`it` blocks:
   - Three topics sharing the "честн…" stem cluster into one candidate; unrelated topics do not join it.
   - Boundary: exactly 3 sharing a stem → a candidate; exactly 2 → none (threshold).
   - Topics already used (`usedCount > 0`) are excluded from clustering.
   - Stopwords / sub-4-char tokens do not create spurious clusters (e.g. three topics all containing "как" or "про" must not cluster on that).
   - `ё`/`е` normalization: topics differing only by ё vs е on the theme word still cluster.
   - Deterministic ordering across input permutations.

3. **`packages/web/src/components/topic-nudges.tsx`** — thin display component `TopicNudges` (PascalCase, kebab-case file).
   - Props: `{ topics: Topic[], universeId: number | null }`.
   - Maps `Topic[]` → `TopicNudgeInput[]`, calls `computeTopicNudges`, renders one soft banner/card per candidate.
   - Banner copy: *"У тебя {count} тем про «{keyword}» — собрать из них историю?"* with one primary button (e.g. "Собрать историю").
   - Button action (recommended default — Option A): navigate to `?modal=create&seed=<synthesizeSeedFromTopics(clusterTopics)>&groupId=<universeId>` using `useNavigate`/`useSearchParams`, reusing the app-wide `GlobalStoryModals`. Import `synthesizeSeedFromTopics` from `@bedtime/core/pipeline/topic-derivers`.
   - Renders nothing when there are no candidates (no empty state, no layout cost).
   - Keep the component thin — all decision logic lives in the tested core function; the component only maps data, formats copy, and navigates.

## 5. Wiring handoff

**Where the banner mounts:**

- **Topics page — `packages/web/src/pages/topics.tsx` (primary home).** It already loads the full topic list into `items` and knows `targetUniverseId`. Insert `<TopicNudges topics={items} universeId={targetUniverseId} />` near the top of the page — recommended just above the "Создать историю из тем" section (around the existing `<section>` at lines 152–189) or directly under `<PageHeader>`. No new fetch needed here.
- **Universe-detail page — `packages/web/src/pages/universe-detail.tsx` (secondary).** This page does **not** load topics today. Add a `topics.list()` fetch (the list endpoint is global — it has no universe filter), then filter client-side to `topic.universeId === universeId`. Default: **exclude null-universe (global) topics** — keep nudges universe-scoped so a universe page only nudges about that universe's topics. Mount `<TopicNudges topics={universeTopics} universeId={universeId} />` as its own `<section>`, recommended just above the existing "Идеи для историй" section (around lines 268–281). Add the fetch to the existing `Promise.all` in the load effect (lines 96–100) to avoid a sequential await.

**How the button hooks the existing flow (no new route, no new endpoint):**

- The button synthesizes a seed from the cluster's topics via `synthesizeSeedFromTopics` and navigates to `?modal=create&seed=<seed>&groupId=<universeId>`.
- `GlobalStoryModals` (`packages/web/src/components/global-story-modals.tsx`, already mounted in `app.tsx` at line 195) reads `seed` and `groupId` from the URL and opens `CreateStoryModal` prefilled. `CreateStoryModal` (`create-story-modal.tsx`) already accepts `initialSeed` and `initialGroupId`.
- The parent then clicks "Создать историю" inside the modal to actually create — the nudge itself creates nothing. This preserves the "button *starts* the flow, human confirms" intent.

**New route:** none required.

## 6. Open questions

Only one genuine fork; it has a recommended default, so proceed with it unless overridden.

- **Clustering quality (heuristic vs. richer matching).** Russian token overlap is fuzzy: crude suffix-trim stemming will occasionally miss a morphological variant or, more rarely, over-merge. **Recommended default: shared-normalized-token single-linkage, threshold 3, cluster only unused topics** — simple, deterministic, fully unit-tested, good enough to surface obvious clusters (honesty, sharing, fear). Revisit only if it proves noisy in real use; a heavier option (LLM-assisted grouping) is explicitly out of scope because this feature must stay pipeline-independent.

Secondary note (decided, not open): **story_topics linkage.** Because the reused create-story modal carries only a seed, nudge-created stories are not linked via `story_topics`. Accepted for this lightweight feature; self-resolution comes from clustering only unused topics (§2). The alternative — routing the button through `topics.generate`/the combo panel (Option B) to preserve linkage — is heavier and cuts against the confirm-in-modal intent, so it is not chosen. If linkage later matters, Option B is the upgrade path.

## 7. Ordered implementation checklist

1. Write `packages/core/src/pipeline/topic-nudges.ts`: Zod `TopicNudgeInput` / `NudgeCandidate`, and pure `computeTopicNudges` (normalization + stopwords + light stem + single-linkage clustering, threshold 3, unused-only, deterministic ordering). No comments.
2. Write co-located `packages/core/src/pipeline/topic-nudges.test.ts` covering the §4 cases; run `npx vitest run packages/core/src/pipeline/topic-nudges.test.ts` until green.
3. Create `packages/web/src/components/topic-nudges.tsx` (`TopicNudges`): map `Topic[]` → input, call the core function, render banners, wire the button to `?modal=create&seed=…&groupId=…` via `synthesizeSeedFromTopics`. Export it from `packages/web/src/components/index.ts`.
4. Mount `<TopicNudges>` in `topics.tsx` using the already-loaded `items` + `targetUniverseId`.
5. In `universe-detail.tsx`, add `api.topics.list()` to the existing `Promise.all`, filter to this universe (exclude global), and mount `<TopicNudges>` above the ideas section.
6. Run `npx tsc --noEmit` and the web/core test suites; fix any type/lint issues.
7. Manually verify: create 3 topics sharing a theme in one universe → banner appears with the right count and keyword; click it → create-story modal opens with a synthesized seed and the universe preselected; nothing is created until the parent confirms; after weaving those topics into a story via the existing combo flow, the banner disappears.
