---
type: spec
branch: main
task: Show a per-story reaction summary badge in the library so a parent doesn't have to open each story to see how Gosha reacted (GH #242)
complexity: medium
state: confirmed
updated: 2026-08-13
---
# Spec: Reaction count badge per story

### Why

The issue's own text: "As a parent, I browse my story library and see a small reaction summary on
each card — '3 laughs · 1 loved · 2 notes' — so I can instantly find the story Gosha enjoyed most
without opening each one to check its annotation history." One acceptance criterion: a compact,
per-type reaction count visible directly on the library card, no click required.

### Reaction-source correction (flag only, no scope change to the ask)

The PM's brief says "the `child_reactions` table already exists and is live" as the data source.
Read `packages/core/src/db/schema.ts` in full: `childReactions` (line 289) is a **one-row-per-story**
table (`unique('child_reactions_story_id_unique').on(t.storyId)`) — a single post-read parent
survey (`enjoyed`, `wasFunny`, `wasScary`, rating-style fields). It cannot produce a count like "3
laughs" because there is only ever one row per story.

The issue's own example format ("3 laughs · 1 loved · 2 notes") and its own closing phrase
("without opening each one to check its **annotation history**") both point to the real source:
the `annotations` table (`schema.ts` line 186), whose `type` column is exactly `'sasha_laughed' |
'sasha_loved' | 'sasha_disliked' | 'sasha_reaction' | 'my_note'` — created live, one row per
reaction, during reading via `AnnotationToolbar` (`packages/web/src/components/annotation-toolbar.tsx`,
buttons labelled "Смеялся" / "Понравилось" / "Слабо" / "Заметка") and persisted through the
already-merged `POST /stories/:id/annotations` endpoint (#293). This spec counts `annotations`
grouped by `type`, not `child_reactions`. No relabeling or scope argument needed — the PM's
*intent* (a per-story reaction summary) is unambiguous and `annotations` is the table that actually
satisfies it.

**Important filter correction found while reading `plan-annotator.tsx`:** the `my_note` type is
also written by the *plan-review* flow (`packages/web/src/components/plan-annotator.tsx:162-167`,
`type: 'my_note', context: 'plan'`) — an editor's revision comment on the story plan, unrelated to
a child's in-reading reaction. Counting all `my_note` rows unfiltered would silently mix "instructions
I gave the AI while editing the plan" into "notes I took while Gosha listened." The existing
`GET /:id/annotations` endpoint already guards against exactly this with an optional
`?context=` filter (`stories.ts:841-861`). The reaction-count query must exclude `context = 'plan'`
rows for the same reason.

**NULL-safety on `context` (checked, not assumed):** `annotations.context` is declared
`.default('text')` in `schema.ts:196` but **not** `.notNull()`, and its migration
(`0006_annotations_context.sql`) is `ALTER TABLE "annotations" ADD COLUMN "context" text DEFAULT
'text'` — also no `NOT NULL`. Every current write path sets it explicitly (`stories.ts`'s
`POST /:id/annotations` does `context ?? 'text'`; `plan-annotator.tsx` sets `'plan'`) and Postgres
backfills the column default for pre-existing rows on this style of `ADD COLUMN`, so `NULL` rows
are unlikely — but not proven impossible without a live query this planning pass had no DB access
to run, and a positive `eq(annotations.context, 'text')` filter would silently drop any row that
did end up `NULL`, which is exactly the historical-story case a parent browsing their library would
notice missing. The query below is written as an **exclude-plan** filter instead of an
**include-text** filter so it matches the actual intent (count everything except plan-review notes)
and is safe regardless of whether any legacy row is `NULL`: `WHERE story_id IN (...) AND (context IS
NULL OR context <> 'plan')`.

### Fetch-approach decision

**Aggregate in the existing `GET /api/stories` list endpoint, via one grouped batch query — not a
dedicated endpoint, not client-side computation.**

Evidence checked, not assumed:
- The list handler (`packages/api/src/routes/stories.ts:249-328`) already does exactly this shape
  twice: a grouped `modelCalls` cost aggregate (`groupBy(modelCalls.storyId)` → `totalById` Map →
  merged into each row) and a batch universe-id lookup (`getStoryUniverseIdsBatch`, defined in
  `packages/api/src/routes/story-universe-links.ts` — one `inArray` query + a `Map<number,
  T[]>`, called once, merged into each row). Reaction counts are the same shape of problem: one
  small aggregate per story, needed for every row already being returned. A third instance of the
  identical pattern is the simplest option, not a novel one.
- No index exists on `annotations.story_id` (checked `0000_secret_ares.sql` and every later
  migration — only the FK constraint, no `CREATE INDEX`), and neither does `model_calls.story_id`
  or `story_universes.story_id`, which the two existing aggregates above already query the same
  way in production without one. This is a single-family app with a per-family library, not a
  multi-tenant table at scale — consistent with the rest of this endpoint's query cost profile, so
  no new index is proposed here.
- A dedicated `/reactions/counts` endpoint would just be a second round-trip returning data the
  list call could return in the same response for free — it adds a second N+1 risk (per-visible-card
  fetch, or the client has to batch story IDs itself) with no corresponding benefit, since the list
  endpoint isn't paginated and already returns everything the card needs in one shot.
- Client-side computation is ruled out because the client doesn't fetch `annotations` rows at all
  today at library-list time (only inside the reader, one story at a time via `GET
  /:id/annotations`) — computing this client-side would mean fetching full annotation rows for
  every story up front, which is strictly more data over the wire than a `COUNT(*) ... GROUP BY`
  the database already does cheaply.

Given this decision, the rest is genuinely small: one grouped query, one Map merge (both copying an
existing in-file pattern verbatim), one new badge element in a component that already has an
established badge-row slot and an established "conditional icon-content next to other badges"
precedent from #71's star. See Risk/effort verdict at the end.

### Implementation Phases

Single phase. The query, the map merge, and the badge render are one cohesive, same-day slice —
none is independently useful without the others.

### Design decisions made autonomously

- **Query shape:** `SELECT story_id, type, COUNT(*) FROM annotations WHERE story_id IN (...) AND
  (context IS NULL OR context <> 'plan') GROUP BY story_id, type`, executed once for the whole page
  of results (same timing/placement as the existing `totals` query), not once per story. See the
  "NULL-safety on context" note above for why this is an exclude-plan filter, not an include-text
  filter.
- **Split into a pure derive function + a thin DB wrapper**, mirroring the existing split between
  `deriveAwaitingFeedbackInbox` (pure, tested, lives in `packages/core/src/cost/aggregations/`)
  and the untested DB call that feeds it. `packages/core/src/cost/aggregations/` already houses
  `derive-story-cost-breakdown.ts`, which `stories.ts` already imports for this same list
  endpoint — it is the established home for per-story pure aggregation logic, not a
  cost-dashboard-only folder despite its path segment. Precedent checked: `story-universe-links.ts`
  (the closest sibling — a DB batch loader for the same endpoint) has **no** test file of its own;
  only the pure `derive-*` functions in `aggregations/` get direct unit tests in this codebase.
  Following that convention exactly: the SQL-touching batch loader stays untested (matches
  `getStoryUniverseIdsBatch`), the grouping/defaulting logic is extracted into a pure, tested
  function.
- **All 5 annotation types counted, not just the 3 the issue's example shows.** The issue's "3
  laughs · 1 loved · 2 notes" is illustrative, not an exhaustive list of the type enum —
  `sasha_disliked` ("Слабо" in the toolbar) is created through the same live UI as the other three
  and would be silently invisible on the badge if hard-coded to 3 types, which misrepresents a
  story that has real reactions. `sasha_reaction` (a generic/legacy type, not currently produced by
  `AnnotationToolbar`, only read back via `GET /dashboard/sasha-reactions`) is included too for the
  same reason — it costs nothing extra to display if it's ever nonzero, and hiding it would be an
  arbitrary omission of real data rather than a deliberate scope cut.
- **Zero-reaction stories render no badge**, matching the existing `Серия`/`Микс` badges, which
  also render conditionally rather than showing an empty-state chip.
- **Badge placement:** one additional `<span className="badge badge-sm badge-outline">` in
  `StoryCard`'s existing badge row (`story-card.tsx:140-163`), positioned after `Микс` and before
  the status badge — keeping status as the rightmost, most prominent badge (existing convention),
  and keeping the favourite star closest to the title (#71's placement, unchanged). This reuses the
  exact badge markup/tone already used for `Серия`/`Микс`, not a new visual pattern.
- **The badge row needs `flex-wrap` added.** `story-card.tsx:140` is currently `flex shrink-0
  items-center gap-1` inside a `justify-between` row with the title — `shrink-0` means none of its
  children compress, so a fifth badge (on top of the star, `Серия`, `Микс`, status) can squeeze the
  title on narrow cards instead of wrapping to a second line. This is a direct consequence of
  adding a badge to that row, not a pre-existing bug being fixed opportunistically — add
  `flex-wrap` to that row's className as part of this change.
- **Compact glyph+count format inside the badge**, not the issue's literal English words. This
  repo's UI is Russian-localized throughout (`annotationTypeLabel` in
  `packages/web/src/components/types.ts` gives full-sentence Russian labels like "Саша смеялся" —
  correct for a tooltip, too long to countable-pluralize into a compact chip like "3 laughs"
  without inventing new Russian noun-form copy this spec has no authority to originate). Decision:
  reuse this file's own existing precedent for a compact visual indicator — `renderStars` renders
  plain single-codepoint Unicode symbol glyphs (`★`/`☆`) as text, not the SVG `StarIcon` button (a
  different, interactive element) and not emoji (which this UI has none of today, and whose
  multi-codepoint forms like `❤️`, U+2764 + U+FE0F variation selector, are a needless string-match
  brittleness in exact-text test assertions). One single-codepoint symbol per type: `☺` laughed,
  `♥` loved, `☹` disliked, `✦` generic reaction, `✎` note — joined with count by " · ", e.g.
  `☺ 3 · ♥ 1 · ✎ 2`. Full `title=` attribute on the badge reuses `annotationTypeLabel(type)`
  verbatim per nonzero type (e.g. `title="3 Саша смеялся, 1 Саше понравилось, 2 Моя заметка"`) for
  accessibility/tooltip — reusing existing copy rather than writing new pluralized strings is a
  deliberate "good enough, not final copy" call; a fast follow can swap in real Russian count-forms
  or custom SVG glyphs without touching the data layer.

### UI reuse verification

Read `story-card.tsx` in full (again, following #71's own note that this file changed today) and
`packages/web/src/components/types.ts`, `annotation-toolbar.tsx`. Confirmed reusable:
- The badge row (`story-card.tsx:140-163`) is a plain `flex items-center gap-1` row of
  conditionally-rendered `<span className="badge badge-sm ...">` elements — a new conditional badge
  slots in with zero structural change, same pattern as `Серия`/`Микс`.
- `annotationTypeLabel(type: AnnotationType): string` (`types.ts:3-16`) already gives the exact
  Russian label needed for the tooltip, per type — directly reusable, no new copy needed there.
- **Not reusable as-is:** `countByType`/`totalReactions` (`types.ts:35-55`) operate on a
  client-already-fetched `Annotation[]` array (used inside the single-story reader, which already
  has `GET /:id/annotations` loaded). The library list never fetches raw annotation rows, so this
  spec's counting must happen server-side in the list query — `countByType` is the wrong layer for
  this feature and is not reused, only `annotationTypeLabel` is.

### Files by scenario

| Scenario | Backend files | Frontend files |
|----------|---------------|-----------------|
| SCENARIO 1 — library card shows "☺ 3 · ♥ 1 · ✎ 2" when the story has mixed reading-time reactions | `packages/api/src/routes/stories.ts`, `packages/api/src/routes/story-reaction-counts.ts` (new), `packages/core/src/cost/aggregations/derive-reaction-counts.ts` (new) | `packages/web/src/components/story-card.tsx`, `packages/web/src/pages/story-list.tsx`, `packages/web/src/lib/api.ts` |
| SCENARIO 2 — a story with zero reading-time annotations shows no reaction badge at all | same as above | `packages/web/src/components/story-card.tsx` |
| SCENARIO 3 — a plan-review comment (`context: 'plan'`) on a story is never counted in its reaction badge | `packages/api/src/routes/story-reaction-counts.ts` (the exclude-plan, NULL-safe filter) | none |
| SCENARIO 4 — a story whose only reaction is `sasha_disliked` still shows a badge (not hidden by a 3-type-only assumption) | same as SCENARIO 1 backend files | `packages/web/src/components/story-card.tsx` |
| SCENARIO 5 — reaction counts load with the normal library list fetch, no extra request, no per-card waterfall | `packages/api/src/routes/stories.ts` (single batch query, not per-row) | `packages/web/src/pages/story-list.tsx` (no new fetch call added) |

### Data model changes

None. `annotations` already captures every reaction as its own row; this feature is read-only
aggregation over existing data. No migration, no new column.

### Files to create

```
packages/core/src/cost/aggregations/derive-reaction-counts.ts
  export type ReactionCounts = Record<'sasha_reaction' | 'my_note' | 'sasha_laughed'
    | 'sasha_loved' | 'sasha_disliked', number>
  export function emptyReactionCounts(): ReactionCounts
    — returns a fresh zeroed object each call (never a shared mutable reference)
  export interface ReactionCountRow { storyId: number; type: keyof ReactionCounts; count: number }
  export function deriveReactionCountsByStory(storyIds: number[], rows: ReactionCountRow[]):
    Map<number, ReactionCounts>
    — seeds every id in storyIds with emptyReactionCounts(), then overwrites per-type counts from
    rows (same two-pass shape as getStoryUniverseIdsBatch's fill-in loop)

packages/core/src/cost/aggregations/derive-reaction-counts.test.ts
  — empty storyIds + empty rows returns an empty map
  — a storyId with no matching rows still appears in the map, all-zero
  — a storyId with three different type rows produces the correct per-type counts, other types
    stay zero
  — two different storyIds' rows are never cross-contaminated

packages/api/src/routes/story-reaction-counts.ts
  — mirrors story-universe-links.ts's shape exactly: a thin, untested (matching that file's own
    convention — no test file) DB wrapper
  export async function getReactionCountsBatch(storyIds: number[]): Promise<Map<number,
    ReactionCounts>>
    — if storyIds.length === 0, return an empty map without querying
    — db.select({ storyId: annotations.storyId, type: annotations.type, count: sql<number>
      `count(*)::int` }).from(annotations).where(and(inArray(annotations.storyId, storyIds),
      or(isNull(annotations.context), ne(annotations.context, 'plan'))))
      .groupBy(annotations.storyId, annotations.type)
      — exclude-plan filter, NULL-safe (see "NULL-safety on context" above)
    — pass storyIds + query rows into deriveReactionCountsByStory and return its result
```

### Files to modify

```
packages/api/src/routes/stories.ts
  import { getReactionCountsBatch } from './story-reaction-counts'
  GET / (list endpoint), directly after the existing universeIdsByStory line:
    + const reactionCountsByStory = await getReactionCountsBatch(result.map((row) => row.id))
  response map:
    + reaction_counts: reactionCountsByStory.get(row.id)!
    (added to the same object literal that already adds total_usd_micros and group_ids; the `!` is
    safe, not a shortcut — deriveReactionCountsByStory seeds every id in the input storyIds list
    before returning, so every row.id passed in is guaranteed present. No emptyReactionCounts()
    import needed here; that fallback would be unreachable dead code)

packages/web/src/lib/api.ts
  AnnotationType is already defined here (line 302) — this is its canonical definition (also
  independently re-declared in components/types.ts; a pre-existing duplication, not introduced or
  fixed by this task)
  Story interface + reaction_counts: Record<AnnotationType, number>

packages/web/src/components/story-card.tsx
  import type { AnnotationType } from './types' (matches this file's existing StoryStatus import
  from the same module, and matches annotation-toolbar.tsx's own import source)
  + reactionCounts?: Record<AnnotationType, number> prop on StoryCardProps
  + a small REACTION_GLYPHS ordered lookup (type -> single-codepoint symbol), colocated in this
    file since it is purely a rendering concern:
      const REACTION_GLYPHS: Array<{ type: AnnotationType; glyph: string }> = [
        { type: 'sasha_laughed', glyph: '☺' }, { type: 'sasha_loved', glyph: '♥' },
        { type: 'sasha_disliked', glyph: '☹' }, { type: 'sasha_reaction', glyph: '✦' },
        { type: 'my_note', glyph: '✎' },
      ]
  + badge row className gains flex-wrap (see "badge row needs flex-wrap" design decision above)
  + in the badge row, after the Микс badge and before the status badge:
      renders only when reactionCounts is provided and at least one count is > 0; builds the
      "☺ 3 · ♥ 1 · ✎ 2"-style string by filtering REACTION_GLYPHS to nonzero counts; title
      attribute built from annotationTypeLabel(type) per nonzero type (import from ./types)

packages/web/src/components/story-card.test.tsx
  + tests: renders no reaction badge when reactionCounts is undefined; renders no reaction badge
    when reactionCounts is provided but every count is 0; renders "☺ 3 · ✎ 2"-shaped text when
    two of five types are nonzero (order matches REACTION_GLYPHS, not object key order); renders
    only sasha_disliked's glyph+count when it is the sole nonzero type (guards against a
    3-type-only assumption regressing back in)

packages/web/src/pages/story-list.tsx
  SortableStoryCard
    + reactionCounts prop, threaded into <StoryCard reactionCounts={story.reaction_counts} ... />
    (no new fetch, no new handler — purely a prop pass-through, same as favorite was threaded)
```

### Implementation order

1. `derive-reaction-counts.ts` + its test — pure logic first, no DB, fast feedback.
2. `story-reaction-counts.ts` — thin wrapper calling the pure function (untested, matches
   `story-universe-links.ts` convention).
3. `stories.ts`: wire the batch call + response field into the existing `GET /` handler.
4. `api.ts`: `Story.reaction_counts` type.
5. `story-card.tsx`: glyph lookup + badge render + tests.
6. `story-list.tsx`: thread `reactionCounts` prop through.

### Definition of Done — per layer

**Backend:** `npx vitest run` passes, including new `derive-reaction-counts.test.ts` coverage
(empty map, zero-fill, per-type correctness, no cross-story contamination). `npx tsc --noEmit`
clean. Manual check: a story with only a `context: 'plan'` `my_note` (created via plan review) has
`reaction_counts.my_note === 0` in the `GET /api/stories` response — confirms the exclude-plan
filter actually excludes plan-review notes, not just that it compiles.

**Frontend:** `npx vitest run` passes, including new `story-card.test.tsx` assertions listed above.
Manual check in local dev (`npm run docker:up`): a story with a few in-reading reactions shows the
glyph+count badge on its library card; a freshly created story with zero reactions shows no badge;
hovering the badge shows the full Russian breakdown in the tooltip.

**Infrastructure:** none — no migration, no new index, no new endpoint, no deploy-time concern
beyond the normal push-to-`main` pipeline.

### Scope boundary

Out of scope for this task:
- Any reaction badge/summary on the story-reader page — the issue text scopes this to "I browse my
  story library," the reader page already shows live annotations inline while reading and doesn't
  need a summary of itself.
- Filtering or sorting the library by reaction count/type — the issue's acceptance criterion is
  visibility ("see a small reaction summary"), not a new query dimension; can be a fast follow if
  wanted, reusing the same `reaction_counts` field once it exists.
- Any change to `GET /:id` (single-story fetch) — only the list endpoint needs the aggregate;
  the reader page has its own `GET /:id/annotations` call already.
- Final Russian copy/pluralized count-forms or custom SVG glyphs for the badge — this spec
  deliberately reuses `annotationTypeLabel` verbatim and plain Unicode symbol glyphs rather than
  originating new translated strings (see "Compact glyph+count format" decision above).
- Relabeling or otherwise correcting the GitHub issue's `child_reactions` reference — flagged in
  this spec's "Reaction-source correction" section only, left for a human to action if desired.

### Risk/effort verdict

The PM was right to flag the fetch-approach decision as the one genuine fork — it determines
whether this ships as a three-file diff or grows a new endpoint, new client fetch orchestration,
and a second loading state. With that decided (aggregate in the existing list query, same pattern
already used twice in the same handler), everything downstream is mechanical: a grouped query
copying an existing query's shape, a pure map-merge function copying an existing pure function's
shape, and a badge copying an existing badge's markup. **Low risk, small effort** — genuinely
comparable to #71 (favourite marking), not a new subsystem. The one real risk this investigation
surfaced and neutralized up front was silent: counting `annotations` without excluding
`context: 'plan'` rows would have shipped a badge that quietly mixes in plan-review notes, which is
a correctness bug a first read of the PM's brief (which named `child_reactions`, not `annotations`,
as the source) would not have caught.

One more risk worth naming rather than hiding: since the PM's brief describes `child_reactions`
(not `annotations`) as "already exists and is live," and this spec's own correction establishes
that the badge's real data source is the reading-time `AnnotationToolbar` flow shipped with #293,
it's possible this feature launches showing badges on very few or zero existing stories if #293 is
recent and parents haven't used the in-reading reaction buttons much yet. That is not a bug in this
spec — the badge is correctly empty for stories with no reactions, per the "zero-reaction stories
render no badge" decision — but it's worth flagging so a sparse initial library view isn't mistaken
for a broken feature.
