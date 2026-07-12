# Spec: «Слова» (Words) — target-vocabulary weaving

Mirror of the **Fragments** feature, adapted for vocabulary the parent wants the child to acquire.
The parent keeps a list of target words; the story writer weaves 1–3 of them into a story **only
where they fit the meaning naturally** and uses them **correctly and child-friendly** — never forced.

This spec is planning only. It PROPOSES the orchestrator-owned wiring (schema, migration,
writer injection, queries, usage recording) and DESCRIBES the new files to create. No code here.

---

## 1. Business goal

The parent maintains a small vocabulary list they want their 7-year-old to learn (e.g. «щедрость»,
«любопытство», «терпение»). When a story is generated, the writer may weave a few of these words in —
but only when the story's meaning genuinely calls for them.

Scenarios:

- **Parent adds a word.** Parent opens the Words page, adds «щедрость» with an optional hint
  («готовность делиться, отдавать другим»). Universe-scoped (or global). Reorderable by rank.
- **Word fits → used correctly.** A story where characters share toys/food naturally uses «щедрость»
  in a correct, child-friendly sentence. The word is recorded as used for that story.
- **Word does not fit → not forced.** A story about a thunderstorm with no sharing moment does NOT
  shoehorn «щедрость» in. Zero words woven is a normal, common outcome — better than a forced one.
- **Parent sees usage.** The Words page shows a "использовано N×" badge per word (like fragments),
  so the parent can see which words the child has been exposed to and how often.

No change to who can generate stories, auth, or any other flow. Purely additive.

---

## 2. Architecture

End-to-end, mirrors fragments but with the semantic-fit decision moved into the **writer** (not the
plotter), because the plotter produces a plan, not prose — it cannot judge how a word reads in a
finished child-friendly sentence. The writer decides fit while composing.

```
words table (universe-scoped, rank-ordered)
   │  loadEligibleWords(universeId)   ← mirror of loadEligibleFragments
   ▼
writer stage  ← buildWordsBlock(words) appended to the writer prompt
   │            (writer weaves 1–3 that fit; emits a trailing marker line "СЛОВА: <ids>")
   ▼
extractWordMarkers(writerOutput)  → { cleanedText, wordIds }
   │            (marker stripped from the saved story text; ids filtered to eligible set)
   ▼
recordStoryWords(storyId, usedWordIds)  → story_words usage rows   ← mirror of recordStoryFragments
```

**Fact (verified):** `runWriterOnly` in `packages/core/src/pipeline/orchestrator.ts` has exactly one
caller — `packages/api/src/routes/pipeline-text-trigger.ts` (`grep` of `runWriterOnly` across
`packages`). Because it is the sole writer entry point, loading eligible words there and recording
`usedWordIds` there covers **every** story-generation path (auto, manual, series all funnel through
`triggerTextPhase`). No other wiring sites are needed.

**Key divergence from fragments (important):** fragments emit their marker on the **plotter** output
(`extractFragmentMarkers(planRaw)`), then the chosen fragment *texts* are re-loaded and handed to the
writer in a later phase. Words instead are offered to the writer directly and the marker is emitted on
the **writer** output. This is deliberate and correct for a semantic-fit-at-compose-time feature.

---

## 3. Data model changes (orchestrator-owned; DESCRIBE only, migration generated via drizzle)

Add to `packages/core/src/db/schema.ts`, mirroring `fragments` / `story_fragments` exactly.

### `words` table

| column       | type                                   | nullability / default            | mirrors            |
|--------------|----------------------------------------|----------------------------------|--------------------|
| `id`         | `serial`                               | primary key                      | fragments.id       |
| `word`       | `text('word')`                         | `.notNull()`                     | fragments.text     |
| `hint`       | `text('hint')`                         | nullable (no `.notNull()`)       | topics.note        |
| `universeId` | `integer('universe_id')` → `storyGroups.id` | nullable (global when null) | fragments.universeId|
| `rank`       | `integer('rank')`                      | `.notNull().default(0)`          | fragments.rank     |
| `createdAt`  | `timestamp('created_at')`              | `.defaultNow()`                  | fragments.createdAt|
| `updatedAt`  | `timestamp('updated_at')`              | `.defaultNow()`                  | fragments.updatedAt|

Drizzle name: `export const words = pgTable('words', { … })`.

### `story_words` usage table

| column      | type                                        | nullability / constraint | mirrors                |
|-------------|---------------------------------------------|--------------------------|------------------------|
| `id`        | `serial`                                    | primary key              | storyFragments.id      |
| `storyId`   | `integer('story_id')` → `stories.id`        | `.notNull()`             | storyFragments.storyId |
| `wordId`    | `integer('word_id')` → `words.id`           | `.notNull()`             | storyFragments.fragmentId |
| `createdAt` | `timestamp('created_at')`                   | `.defaultNow()`          | storyFragments.createdAt |

Unique constraint: `unique('story_words_story_word_unique').on(t.storyId, t.wordId)` — mirrors
`story_fragments_story_fragment_unique`. Guarantees idempotent recording via `onConflictDoNothing`.

Migration: **generate** via drizzle-kit generate, then apply with `npm run db:migrate` (never
hand-write, never `drizzle-kit migrate` — hangs on Neon). Two new tables + one FK-implied index.

---

## 4. New files to create (parallelizable — do not touch existing files)

### 4a. Pure prompt-block core — `packages/core/src/pipeline/stages/words-block.ts`

Mirrors `character-lenses.ts` (pure, DB-free) + `fragments-prompt.ts` (marker extraction). No comments.

Exports:

- `TargetWord` — Zod schema + inferred type: `{ id: number; word: string; hint: string | null; rank: number; usedCount: number }`.
- `MAX_WORDS_PER_STORY = 3`.
- `buildWordsBlock(words: TargetWord[]): string` — pure. Returns `''` for empty input. Otherwise renders:
  - One line per word **including the hint**: `[Слово #12] щедрость — готовность делиться` (hint after
    an em-dash; omit the dash+hint when `hint` is null). A `(уже использовано ранее)` tag when
    `usedCount > 0`, mirroring the fragments block.
  - The hard rule block (Russian), stating:
    - Weave in **0–3** target words; usually fewer; **zero is a normal, frequent, good outcome**.
    - Use a word **only where the meaning genuinely fits**; never restructure the plot around a word;
      never force a word in. A forced word is worse than an omitted one.
    - Use each chosen word **correctly and in a child-friendly way** — the sentence must make its
      meaning clear enough that a 7-year-old absorbs it from context.
    - Prefer variety across stories; don't always reach for the same words.
    - **Final service line, mandatory format:** the very last line of the answer must be
      `СЛОВА: <ids через запятую или слово нет>`. This line is stripped before saving.
- `extractWordMarkers(text: string): { cleanedText: string; wordIds: number[] }` — pure.

  **CRITICAL — do NOT copy `extractFragmentMarkers` verbatim.** «СЛОВА» is a common Russian word and
  the writer prompt actively encourages idioms; a naive `m`-flag, optional-separator, replace-the-whole-
  line regex would match legitimate prose (e.g. `Слова застряли у него в горле.`, `Слово за слово…`)
  and silently delete it from the saved story — content corruption. Guard against it:
  - Match **only the last non-empty line** of the text (not any line).
  - Separator is **mandatory**; payload must be **exclusively** ids/commas/`#`/whitespace or the word
    `нет` — a payload containing alphabetic prose must NOT match. Suggested:
    `/^[ \t>*#-]*СЛОВА\s*[:—]\s*(нет|[\d,\s#]+)$/i` applied to the trimmed last line only.
  - On match: parse ids, dedupe, strip that final line (and trailing blank lines) from `cleanedText`.
  - On no match: return the text unchanged with `wordIds: []`.

### 4b. Co-located test — `packages/core/src/pipeline/stages/words-block.test.ts`

vitest, `describe`/`it`, no comments. Cover:
- `buildWordsBlock([])` → `''`.
- `buildWordsBlock` renders word + hint (em-dash) and omits dash when hint null; shows used tag.
- `extractWordMarkers` parses `"…story…\nСЛОВА: 3, 7"` → `wordIds [3,7]`, cleaned text has no marker.
- `extractWordMarkers` on `"…\nСЛОВА: нет"` → `wordIds []`, marker stripped.
- **Blind-spot guard:** input containing a prose line starting `Слова застряли…` in the body AND a
  real `СЛОВА: 5` marker on the last line → prose line **survives**, only the last line stripped,
  `wordIds [5]`. (This is the test the naive regex fails.)
- No marker at all → text unchanged, `wordIds []`.

### 4c. DB access — `packages/core/src/pipeline/load-words.ts` (mirror `load-fragments.ts`)

- `loadEligibleWords(universeId: number | null, limit = 12): Promise<TargetWord[]>` — same scope filter
  (`isNull(words.universeId) OR eq(words.universeId, universeId)`), same `usedCount` subquery against
  `story_words` joined to `stories` with `status in ('proofreading','ready','read')`, same ordering
  (`usedCount asc, rank desc, random()`).
- `recordStoryWords(storyId: number, wordIds: number[]): Promise<void>` — `onConflictDoNothing`,
  no-op on empty array. Mirror `recordStoryFragments`.
- Re-export the `words-block` types (`export * from './stages/words-block'`) if convenient, matching
  how `load-fragments.ts` re-exports `fragments-prompt`.

### 4d. API route — `packages/api/src/routes/words.ts` (mirror `fragments.ts`)

CRUD, `validate(...)` Zod middleware, `usedCount` subquery against `story_words`.
- `GET /` → list ordered by `rank desc, createdAt desc`, each with `usedCount`.
- `POST /` → create; body `{ word: string(1..200), hint?: string|null, universeId?: number|null, rank?: number }`.
- `PATCH /:id` → partial update; bumps `updatedAt`.
- `DELETE /:id` → delete `story_words` rows for the word first, then the word (mirror fragments'
  cascade-by-hand). Return 204.

### 4e. Web page — `packages/web/src/pages/words.tsx` (mirror `fragments.tsx`)

`WordsPage` component. List / add / inline-edit / rank / delete. Add fields: word (text input) +
optional hint (text input) + universe select + rank. Reuse `PageHeader`, `StatusCallout`. Russian
copy explaining: "Слова, которые ты хочешь, чтобы ребёнок выучил. Агент иногда органично вплетает
подходящие в истории — только там, где по смыслу уместно." Show `usedCount` badge.

### 4f. Web page test — `packages/web/src/pages/words.test.ts`

Mirror `fragments.test.ts` (test any extracted pure helper such as `universeName`).

---

## 5. WIRING HANDOFF (orchestrator-owned — serial; this spec proposes exact insertion points)

All edits below are to **existing** files and are the orchestrator's job, not the parallel file authors'.

1. **`packages/core/src/db/schema.ts`** — add `words` and `storyWords` tables per §3.

2. **Migration** — `npx drizzle-kit generate` then `npm run db:migrate` (project root). Do not hand-edit.

3. **`packages/core/src/pipeline/stages/writer.ts`** — add optional param `targetWords?: TargetWord[]`
   to `runWriter`'s options. Build `wordsBlock = buildWordsBlock(options.targetWords ?? [])` **only when
   `!isRevision`** (mirror the existing `fragmentBlock` guard). Append `wordsBlock` into the `parts[0]`
   template string alongside `fragmentBlock`/`idiomRuleBlock`/`endingRuleBlock`. Import
   `buildWordsBlock`, `TargetWord` from `./words-block`.

4. **`packages/core/src/pipeline/orchestrator.ts`** —
   - Import `extractWordMarkers` (from `./stages/words-block`) and the `MAX_WORDS_PER_STORY` const.
   - Add `targetWords?: TargetWord[]` to `runWriterOnly`'s options; pass it through to `runWriter`
     using the existing conditional-spread pattern (`...(targetWords?.length ? { targetWords } : {})`).
   - After `runWriter` returns `textV1`: `const wm = extractWordMarkers(textV1)`. Set the returned
     `textV1 = wm.cleanedText`. Compute `usedWordIds = wm.wordIds.filter(id => eligibleIds.has(id)).slice(0, MAX_WORDS_PER_STORY)`
     where `eligibleIds = new Set((options.targetWords ?? []).map(w => w.id))`.
   - Add `usedWordIds: number[]` to the `WriterOnlyResult` interface and return it. (Because
     `insertTextVersion` and the stories update both persist `result.textV1`, returning the **cleaned**
     text here is what keeps the marker out of the saved story and all text versions.)

5. **`packages/api/src/routes/pipeline-text-trigger.ts`** —
   - Import `loadEligibleWords`, `recordStoryWords` from `@bedtime/core/pipeline/load-words`.
   - Load eligible words for the universe, **skipping on retry** (mirror `chosenFragments = isRetry ? [] : …`):
     `const targetWords = isRetry ? [] : await loadEligibleWords(universeId)`.
   - Pass `...(targetWords.length > 0 ? { targetWords } : {})` into the `runWriterOnly(...)` call.
   - After `result` is obtained (before/near `insertTextVersion`): `await recordStoryWords(storyId, result.usedWordIds)`.

6. **`packages/api/src/routes/pipeline-persistence.ts`** — no change required unless you choose to expose
   `usedWordIds`; `buildWriterOnlyStoriesUpdate` already reads `result.textV1`, which is now the cleaned
   text. (No `stories` column stores word ids — usage lives in `story_words`, mirroring fragments.)

7. **`packages/api/src/server.ts`** — `import wordsRouter from './routes/words'` and
   `app.use('/api/words', wordsRouter)` (next to the fragments/topics mounts, lines ~20–72).

8. **`packages/web/src/lib/api.ts`** — add a `Word` interface (`{ id, word, hint, universeId, rank, usedCount, createdAt, updatedAt }`)
   and an `api.words` client (`list/create/update/delete`) mirroring `api.fragments`.

9. **`packages/web/src/app.tsx`** — import `WordsPage`, add nav entry `{ to: '/words', label: 'Слова' }`
   (next to Темы/Фрагменты) and `<Route path="/words" element={<WordsPage />} />`.

10. *(Optional, nice-to-have)* **`packages/api/src/routes/stories.ts`** — expose `used_word_texts` on the
    story detail response (mirror `used_fragment_texts` via a `loadStoryWordTexts(storyId)` helper), so the
    UI can show which target words a story actually taught. Not required for the feature to function.

---

## 6. Open questions

- **Child-scoped vs universe-scoped (RESOLVED → universe-scoped).** Stories link to a universe
  (`groupId`), not a child, and fragments/topics are already universe-scoped, so universe-scoping is the
  consistent default and is what this spec implements. *Noted future option:* if the product later
  models multiple children with divergent vocabularies within one universe, a `childId` column (or a
  child-scoped `words` variant) could be added. Not in scope now; do not implement.

- Marker-token robustness (the «СЛОВА» collision) is **decided**, not an open fork — solved in §4a.

Otherwise: **None.**

---

## 7. Ordered implementation checklist

Parallelizable new-file work (no interdependencies) marked ‖; serial wiring marked →.

1. → Add `words` + `story_words` to `schema.ts` (§3).
2. → Generate migration (`drizzle-kit generate`) and apply (`npm run db:migrate`).
3. ‖ Create `packages/core/src/pipeline/stages/words-block.ts` (pure block + robust `extractWordMarkers`, §4a).
4. ‖ Create `packages/core/src/pipeline/stages/words-block.test.ts` incl. the prose-survives blind-spot test (§4b).
5. ‖ Create `packages/core/src/pipeline/load-words.ts` (`loadEligibleWords`, `recordStoryWords`, §4c).
6. ‖ Create `packages/api/src/routes/words.ts` CRUD route (§4d).
7. ‖ Create `packages/web/src/pages/words.tsx` (+ `words.test.ts`) (§4e, §4f).
8. → Wire `targetWords` into `writer.ts` (`!isRevision` guard, §5.3).
9. → Wire `runWriterOnly`: pass `targetWords`, strip marker via `extractWordMarkers`, return cleaned
   `textV1` + `usedWordIds` (§5.4).
10. → Load eligible words + record `usedWordIds` in `pipeline-text-trigger.ts` (skip on retry, §5.5).
11. → Mount `/api/words` in `server.ts`; add `Word` type + `api.words` client in web `api.ts` (§5.7–5.8).
12. → Add Words page route + nav entry in `app.tsx` (§5.9).
13. Run `npx vitest run` (targeted: `words-block.test.ts`, `words.test.ts`) and `npx tsc --noEmit`.
14. *(Optional)* Expose `used_word_texts` on story detail (§5.10).
```
