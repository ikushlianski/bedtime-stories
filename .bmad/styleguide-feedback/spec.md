# Spec: Feed parent feedback into the accumulating universe style guide

## 1. Business goal

Today the per-universe style guide only learns from the AI story-analyzer. The
parent's own written verdict on a finished story — the free-text notes, the
pacing check, the "would I reuse this" flag, the star rating, plus any inline
annotations the parent left on the text — is captured in the DB but never
durably steers future stories.

After this change, the parent's corrections persist in the universe style guide
and shape every subsequent story in that universe.

Scenarios that now work differently:

- A parent writes in the review notes "слишком длинно, дочка заскучала к
  середине". Future stories in that universe trend shorter, because that note is
  now folded into the style guide's "Минимизировать" / "Что не работает"
  sections and the Plotter/Writer already consume the compiled guide.
- A parent unchecks "pacing was ok" and marks "would not reuse". Those two
  signals become explicit lines the style-guide-updater weighs — with higher
  priority than the automated analyzer, because they come from the real reader.
- A parent highlights a paragraph and annotates it "тут слишком страшно". That
  disapproval line reaches the style guide and future stories in the universe
  avoid that beat.

## 2. Architecture

Data flow (extension, not a new channel):

```
parent_reviews (per story)   annotations (per story)
            \                      /
             v                    v
      format-parent-feedback.ts  (pure, DB-free, env-free)
                     |
                     v   string[] of clean Russian prompt lines
      updateStyleGuide(..., parentFeedback?)   [existing distiller LLM call]
                     |
                     v
   story_groups.styleGuideWorks / DoesntWork / Techniques / Minimize
   + compiled story_groups.styleGuide
                     |
                     v
        Plotter / Writer  (already read the compiled style guide)
```

Nothing downstream changes: the Plotter and Writer already consume
`story_groups.styleGuide`. We only widen the set of inputs the distiller sees.

Ownership:

- **New pure formatter** lives in `packages/core/src/pipeline/derivers/` next to
  the existing `style-guide.ts` deriver. It owns the translation of raw DB rows
  into Russian prompt lines. No DB, no env, no I/O — fully unit-testable.
- **`updateStyleGuide`** (`packages/core/src/pipeline/style-guide-updater.ts`)
  gains one optional `parentFeedback` param and a new prompt section. It stays
  the single distiller and single writer of the style guide.
- **The call site** owns loading the rows and calling the formatter. NOTE OF
  FACT: the task brief calls this "orchestrator-owned", but the only call site
  of `updateStyleGuide` in the repo is
  `packages/api/src/routes/stories.ts:834`, inside the `POST /stories/:id/analyze`
  route (grep confirms a single call site; `orchestrator.ts` does not call it).
  The wiring therefore lands in `stories.ts`, not `orchestrator.ts`.

## 3. Data model changes

**None.** Both source tables already exist and hold everything needed:

- `parent_reviews` (schema.ts ~226): `rating int`, `pacingOk bool`,
  `wouldReuse bool`, `notes text`, unique on `story_id`.
- `annotations` (schema.ts ~145): `type` (one of `sasha_reaction`, `my_note`,
  `sasha_laughed`, `sasha_loved`, `sasha_disliked`), `selectedText text`,
  `noteText text`, per `story_id`.

No migration. No new columns. The style-guide sink columns on `story_groups`
already exist and are already written by `updateStyleGuide`.

## 4. New files to create

### `packages/core/src/pipeline/derivers/format-parent-feedback.ts`

Pure, DB-free, env-free. Exports:

- A Zod schema `parentFeedbackInputSchema` and its inferred type
  `ParentFeedbackInput`, shaped to the columns actually read:

  ```ts
  const parentReviewInputSchema = z.object({
    rating: z.number().nullable(),
    pacingOk: z.boolean().nullable(),
    wouldReuse: z.boolean().nullable(),
    notes: z.string().nullable(),
  })

  const parentAnnotationInputSchema = z.object({
    type: z.enum([
      'sasha_reaction',
      'my_note',
      'sasha_laughed',
      'sasha_loved',
      'sasha_disliked',
    ]),
    selectedText: z.string(),
    noteText: z.string().nullable(),
  })

  export const parentFeedbackInputSchema = z.object({
    review: parentReviewInputSchema.nullable(),
    annotations: z.array(parentAnnotationInputSchema),
  })

  export type ParentFeedbackInput = z.infer<typeof parentFeedbackInputSchema>
  ```

- `export function formatParentFeedback(input: ParentFeedbackInput): string[]`

Behaviour (deterministic, one line per meaningful signal; skip null/empty):

Review lines:
- `rating != null` → `Оценка родителя: ${rating} из 5` (assumption: rating is a
  1–5 star scale; if it turns out otherwise, drop the "из 5" suffix — pure
  string change, no structural impact).
- `pacingOk === false` → `Родитель: темп истории был неудачным`.
- `pacingOk === true` → `Родитель: темп истории был хорошим`.
- `wouldReuse === false` → `Родитель НЕ переиспользовал бы эту историю`.
- `wouldReuse === true` → `Родитель переиспользовал бы эту историю`.
- `notes` non-empty after trim → `Заметка родителя: ${notes.trim()}`.

Annotation lines (map by `type`; include `noteText` when present):
- `sasha_disliked` → `Родителю не понравилось: «${selectedText}»` (+ ` — ${noteText}` if set).
- `sasha_loved` → `Ребёнку очень понравилось: «${selectedText}»` (+ note).
- `sasha_laughed` → `Ребёнок засмеялся здесь: «${selectedText}»` (+ note).
- `sasha_reaction` → `Реакция ребёнка: «${selectedText}»` (+ note).
- `my_note` → `Заметка родителя к фрагменту «${selectedText}»: ${noteText}`
  (skip entirely if `noteText` is empty — a bare selection with no note carries
  no signal).

Return `[]` when `review` is null/all-null and there are no meaningful
annotations. Empty array = updateStyleGuide adds no parent section.

Convention compliance: kebab-case filename, no comments, Zod input type,
`string[]` output, no imports from `db`/`ai`/`process`.

### `packages/core/src/pipeline/derivers/format-parent-feedback.test.ts`

Co-located vitest, grouped in a `describe('formatParentFeedback')`. Concrete
cases (no Arrange/Act/Assert comments):

- `it('returns an empty array when review is null and no annotations')`.
- `it('returns an empty array when every review field is null and notes blank')`.
- `it('emits a pacing line when pacingOk is false')` → asserts a line contains
  `темп истории был неудачным`.
- `it('marks a story the parent would not reuse')` → contains
  `НЕ переиспользовал`.
- `it('includes free-text review notes verbatim')` → given
  `notes: 'слишком длинно'`, asserts a line contains `слишком длинно`.
- `it('formats a disliked annotation with its quote and note')` → asserts the
  selected text and the note both appear.
- `it('skips a my_note annotation that has no note text')`.
- `it('renders rating on a 1–5 scale')` → given `rating: 4`, contains
  `Оценка родителя: 4 из 5`.
- `it('combines review lines and annotation lines into one list')` → count/shape
  assertion over the returned array.

## 5. Wiring handoff (proposed edits — NOT applied by this spec)

### 5a. New `updateStyleGuide` signature (`style-guide-updater.ts`)

```ts
export async function updateStyleGuide(
  groupId: number,
  newAnalysis: StoryAnalysisOutput,
  storyTitle: string,
  parentFeedback: string[] = [],
): Promise<void>
```

Backward compatible: existing callers that omit the 4th arg get `[]` and the
prompt is unchanged.

### 5b. New prompt section to splice into the `prompt` array

Insert, immediately before the `.join('\n')` (i.e. after the existing
`Резюме: ...` line at style-guide-updater.ts:61), guarded so nothing is added
when there is no parent feedback:

```ts
...(parentFeedback.length > 0
  ? [
      '',
      'ПРЯМАЯ ОБРАТНАЯ СВЯЗЬ ОТ РОДИТЕЛЯ (высший приоритет — это правки живого читателя; учитывай их сильнее, чем автоматический анализ выше):',
      parentFeedback.map((line) => `- ${line}`).join('\n'),
    ]
  : []),
```

Also add one line to the "Правила" block so the distiller weights it correctly:
`- Обратная связь родителя имеет приоритет над автоматическим анализом при конфликте`.

No other change to the distiller: it still returns the same four-section JSON,
still compiles via `compileStyleGuide`, still writes the same `story_groups`
columns.

### 5c. Drizzle loads + call the formatter at the call site (`stories.ts`)

Add the import:

```ts
import { formatParentFeedback } from '@bedtime/core/pipeline/derivers/format-parent-feedback'
import { parentReviews, annotations } from '@bedtime/core/db/schema'
```

(`parentReviews`/`annotations` may already be imported — reuse if so.)

Inside the `if (story.groupId ...)` block, load the two feedback sources
alongside the existing `existingChars` load (do these concurrently — do not add
sequential awaits):

```ts
const [existingChars, review, storyAnnotations] = await Promise.all([
  db
    .select({ name: universeCharacters.name, description: universeCharacters.description })
    .from(universeCharacters)
    .where(eq(universeCharacters.universeId, groupId)),
  db.select().from(parentReviews).where(eq(parentReviews.storyId, storyId)),
  db.select().from(annotations).where(eq(annotations.storyId, storyId)),
])

const parentFeedback = formatParentFeedback({
  review: review[0] ?? null,
  annotations: storyAnnotations,
})
```

Then pass it into the existing `Promise.all`:

```ts
updateStyleGuide(groupId, output, story.title, parentFeedback),
```

No other line in the route changes.

## 6. Open questions

None. One noted assumption (not a fork): the only style-guide update path is the
legacy-only `POST /stories/:id/analyze` route, so parent feedback reaches the
style guide only when a story is analyzed there. That matches the "extend the
existing channel" mandate; broadening the trigger to non-legacy stories would be
a separate feature and is out of scope here.

## 7. Ordered implementation checklist

1. Create `packages/core/src/pipeline/derivers/format-parent-feedback.ts` with
   the Zod input schema and the pure `formatParentFeedback` function (section 4).
2. Create the co-located `format-parent-feedback.test.ts` with the concrete
   cases (section 4); run `npx vitest run packages/core/src/pipeline/derivers/format-parent-feedback.test.ts` until green.
3. Widen `updateStyleGuide` with the optional `parentFeedback: string[] = []`
   param and splice in the guarded prompt section + the priority rule (5a, 5b).
4. At `stories.ts:824–834`, load `parentReviews` + `annotations` for the story
   concurrently with `existingChars`, run `formatParentFeedback`, and pass the
   result as the 4th arg to `updateStyleGuide` (5c).
5. `npx tsc --noEmit` and `npx vitest run` — both clean before finishing.
