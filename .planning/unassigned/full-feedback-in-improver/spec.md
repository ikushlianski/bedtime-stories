---
type: spec
branch: main
task: Full parent feedback used for improvements (GitHub #241)
complexity: simple
state: confirmed
updated: 2026-08-13
---

# Spec: Full parent feedback used for improvements

### What to do
`packages/core/src/pipeline/stages/improver.ts` builds both its Pass 1 (historical-pattern
summary) and Pass 2 (proposed prompt edits) prompts from feedback rows, but only ever reads
`rating` and `comment` — the structured fields collected via the feedback form
(`packages/core/src/db/schema.ts:163-173`, `structuredFeedback` jsonb column: `enjoyed`,
`was_funny`, `was_scary`, `too_long`, `favorite_moment`, `favorite_character`,
`understood_moral`, `want_again`, `notes`) are dropped on the floor. Fix by weaving the
structured fields into the same feedback lines already being built, using the same
conditional-inclusion pattern this codebase already has for structured feedback in
`packages/core/src/pipeline/synthesizer-prompt-builder.ts:150-169` (used for Sasha-context
synthesis, not the Improver) — only emit a field when it carries a real value, never
"was_scary: unknown".

1. Define a `PartialStructuredFeedback` type (`Partial<NonNullable<Feedback['structuredFeedback']>> | null`)
   for the formatter's input, rather than reusing `Feedback['structuredFeedback']` verbatim. The
   DB-inferred type marks all 9 fields required-when-present, but `structured_feedback` is a
   `jsonb` column — Postgres does not enforce that shape at the row level, so a formatter that
   trusts the compile-time type can silently crash on legacy or hand-inserted rows that are
   missing a key. Treating the column as untrusted external data (per this repo's defensive-
   coding convention) also makes the per-field `!= null` guards below actually reachable in
   TypeScript — the DB-inferred type has no overlap with `null` per field, so the guards would
   otherwise be unreachable/untypeable code.
2. Add a pure, exported `formatStructuredFeedback(sf: PartialStructuredFeedback): string` to
   `improver.ts`. Given a structured-feedback object (or `null`/missing fields), return an
   inline bracketed suffix like `` [Enjoyed: 4/5, Funny: yes, Too long: no, Wants again: yes] ``
   — only the fields that are present:
   - `enjoyed` → `Enjoyed: {n}/5` when not null/undefined.
   - `was_funny`, `was_scary`, `too_long`, `understood_moral`, `want_again` → `{Label}: yes|no`
     when not null/undefined (labels: Funny, Scary, Too long, Understood moral, Wants again).
   - `favorite_moment`, `favorite_character`, `notes` → `{Label}: {text}` when the trimmed
     string is non-empty, truncated to 200 chars (`…` suffix beyond that) — these are
     free-text parent input with no length cap anywhere else in the pipeline, and this change
     is what first puts them into an LLM prompt, so the cap belongs in the function introducing
     the exposure.
   - Returns `''` (no brackets, no trailing space) when `sf` is `null`/`undefined` or every
     field is empty/missing — so feedback with no structured signal reads exactly as it does
     today.
3. Extract the Pass 1 line-building (`improver.ts:66`) into an exported pure function
   `formatHistoricalFeedbackLines(feedbacks: Feedback[]): string`, calling
   `formatStructuredFeedback` and appending its result after the existing
   `Rating: X — comment` segment. `runPass1` calls this function instead of inlining the
   `.map(...).join('\n')`.
4. In `buildPass2Prompt`'s recent-feedback formatting (`improver.ts:87-92`), append
   `formatStructuredFeedback(f.structuredFeedback)` after the existing
   `- id=X rating=Y: comment` segment. Export `buildPass2Prompt` (currently unexported) so it's
   directly testable without mocking `db`/`aiRunner`.
5. Update the two prompt-instruction constants so the model is actually told the new fields
   count as evidence — formatting the data without changing the instructions leaves the model
   with no directive to treat them as such:
   - `PASS_1_PROMPT_PREFIX` (line 11-14): its instruction currently says "Summarize recurring
     patterns from these older feedback **comments**." Reword to "...from these older feedback
     entries, including both free-text comments and structured signals (e.g. repeated `Too
     long: yes` across rows counts as a pattern just like a repeated comment theme)."
   - `PASS_2_PROMPT_PREFIX` (line 16): its gating instruction currently says "Only propose
     changes supported by at least 2 **feedback signals**." Add one clause clarifying that a
     structured field repeated across rows (e.g. `Too long: yes` on 2+ entries) counts as a
     feedback signal on its own, not only explicit comment text — this is the concrete mechanism
     the issue names in its Enables clause ("suggest 'shorten stories' based on `too_long=true`
     patterns rather than needing explicit user comments").

### Files to touch
```
packages/core/src/pipeline/stages/
├── improver.ts         (modify — add formatStructuredFeedback + formatHistoricalFeedbackLines,
│                         export buildPass2Prompt, wire structured fields into both passes)
└── improver.test.ts    (new — pure-function tests, no db/AI mocking needed)
```

### Done when
- `formatStructuredFeedback` returns `''` for `null`/`undefined` input and for a
  structured-feedback object whose fields are all null/empty.
- `formatStructuredFeedback` includes only the fields that have a meaningful value — e.g. a
  `PartialStructuredFeedback` object with only `was_funny: true` set (constructible directly,
  no cast, because the parameter type is the widened partial shape) produces
  `` [Funny: yes] ``, not a line listing the other four fields as unknown.
- `formatStructuredFeedback` truncates `favorite_moment`/`favorite_character`/`notes` to 200
  chars with a `…` suffix when longer.
- `formatHistoricalFeedbackLines` (Pass 1) and `buildPass2Prompt` (Pass 2) both include the
  structured-feedback suffix in their output for a feedback row that has structured data, and
  both are byte-identical to today's output for a row with `structuredFeedback: null`.
- `PASS_1_PROMPT_PREFIX` and `PASS_2_PROMPT_PREFIX` explicitly state that structured fields
  count as feedback signal alongside comments (assert via string-containment test on the
  constants, not just on the formatted feedback lines).
- `npx tsc --noEmit` is clean.
- `npx vitest run packages/core/src/pipeline/stages/improver.test.ts` passes.
- Full `npx vitest run` passes with no regressions.

### Decisions made autonomously
- **All 9 schema fields, not just the 5 the PM listed or the 6 the issue body listed.** The PM's
  scope note named `was_funny, was_scary, too_long, understood_moral, want_again`; the issue
  body itself names `was_funny, was_scary, too_long, favorite_moment, want_again,
  understood_moral`. Neither matches the actual `structuredFeedback` column
  (`packages/core/src/db/schema.ts:163-173`), which also has `enjoyed`, `favorite_character`,
  and `notes`. Since the issue's own stated problem is "rich signal is silently discarded," and
  there's no schema or product reason to keep discarding 3 of the 9 already-collected fields,
  this plan includes all 9. Flagged as a fact-check finding below, not silently patched over.
- Formatting is a plain inline bracketed suffix on the existing feedback line, not a separate
  section or raw JSON dump — this mirrors the one existing precedent for turning this same
  `structuredFeedback` shape into LLM-prompt text (`synthesizer-prompt-builder.ts:150-169`),
  which conditionally includes only non-null fields for the same reason (avoid "unknown"
  clutter, keep signal dense per token).
- `improver.ts`'s existing prompts are English-language (unlike `synthesizer-prompt-builder.ts`,
  which is Russian for its Sasha-context use case) — field labels here stay English to match.
- Extracting `formatHistoricalFeedbackLines` and exporting `buildPass2Prompt` is a light
  refactor beyond the PM's literal "modify lines 66 and 90" instruction, but it's the only way
  to get a real string-assertion test without mocking `db` and `aiRunner` — matches the existing
  pattern where `synthesizer-prompt-builder.ts` is a separately-tested pure module from
  `feedback-synthesizer.ts`'s I/O.
- Widening the formatter's parameter to a partial/nullable shape instead of trusting the
  DB-inferred `Feedback['structuredFeedback']` type is deliberate, not just a typing
  workaround — `structuredFeedback` is `jsonb`, so Postgres never enforces the 9-key shape at
  write time, and treating it as fully-trusted would violate this repo's own defensive-coding
  convention for external/stored data.
- Cost risk flagged, not fixed here (out of scope for this ticket): `fetchAgentRunFeedbacks`
  (`improver.ts:31-37`) has no row limit, so Pass 1's historical set is unbounded — and this
  change adds three free-text fields to every line in that unbounded set. The 200-char
  per-field truncation above bounds the per-row cost; it does not bound the row count. If
  the historical feedback table grows large, Pass 1's token cost grows with it regardless of
  this change. A future fix would cap `fetchAgentRunFeedbacks` (the synthesizer precedent this
  plan borrows from caps its own equivalent query at `limit(5)`), but adding that cap here would
  be an unrelated behavior change to a function this ticket doesn't otherwise need to touch.

### Scope boundary
- No DB migration — `structuredFeedback` already exists on the `feedback` table and is already
  populated by the feedback form (`packages/api/src/routes/feedback.ts`).
- No change to `ImproverOutputSchema` or the shape of the Improver's proposed-changes output —
  only the input prompts gain more signal.
- No change to `feedback-synthesizer.ts` / `synthesizer-prompt-builder.ts` — that pipeline stage
  already handles structured feedback for its own (different) purpose and is out of scope, even
  though it's noted here as missing `was_scary` and `understood_moral` itself (a separate,
  pre-existing gap, not part of issue #241).
- No UI changes — the feedback form and its fields are unchanged.
