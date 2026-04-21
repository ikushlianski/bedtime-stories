---
type: preflight
branch: main
task: universe-extractor
state: confirmed
updated: 2026-04-20
---

# Preflight: Universe Extractor + Structured Universe Model

## Business Logic

1. **Universe fact extraction is opt-in per story analysis run** — the existing "analyze" checkbox in `add-example-story-modal` already triggers `POST /stories/:id/analyze`. The new extractor runs inside that same endpoint after the existing story-analyzer.

2. **Facts require human approval before touching universe data** — nothing is auto-applied. All extracted facts land in a `universe_suggestions` table with `status: pending`.

3. **Approval requires the user to route each fact** — pick a character (existing or new) or "general universe description". The fact is appended as a bullet to the target field.

4. **Characters are structured JSONB** — stored as `[{name: string, description: string}]`. Editable via card UI.

5. **Style guide splits into 4 separate columns** — `style_guide_works`, `style_guide_doesnt_work`, `style_guide_techniques`, `style_guide_minimize`. The existing `style_guide` text column is kept as the compiled version for pipeline agents. Every save of the 4 subsection columns regenerates `style_guide` from them.

6. **Existing `style-guide-updater.ts`** currently writes a single merged text. It will be updated to write to all 4 subsection columns and regenerate `style_guide`.

7. **Badge visibility** — universe cards in the list show a badge with pending suggestion count. The inbox nav item also shows a total count badge.

## External API Contracts

Not applicable — no external APIs. All AI calls use the existing `claudeCliRunner.runStructured` / `runText` pattern.

## Assumptions & Risks

- **Assumption**: The universe fact extractor can run sequentially after the story-analyzer in the same `POST /stories/:id/analyze` request without timeout. Risk if wrong: the endpoint starts timing out for long stories. Mitigation: the endpoint is already fire-and-forget from the frontend perspective; if needed, the extractor can be moved to a background job later.

- **Assumption**: Existing `style_guide` text content (free-form markdown) will not be migrated into the 4 new columns. The columns start empty; the old `style_guide` column is preserved for agents. Risk if wrong: agents lose accumulated style guide history. Mitigation: not a risk — the compiled column keeps history; new UI shows empty subsections until the next story analysis run fills them.

- **Assumption**: The universe fact extractor prompt can identify 2–5 meaningful universe facts from a single story without hallucinating. Risk: low-quality extractions. Mitigation: user always reviews and can reject.

## Gaps

- How the extractor prompt (`.claude/skills/universe-fact-extractor`) should be phrased is left to the implementer — the skill specification (output schema: `{facts: [{fact_text, suggested_character_name}]}`) is fixed.

## Conflicts

None. This plan does not contradict existing architecture — it extends the existing `/stories/:id/analyze` endpoint and the existing universe CRUD.
