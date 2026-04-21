---
type: plan-summary
branch: main
task: universe-extractor
state: confirmed
phases-skipped: []
updated: 2026-04-20
---

# Plan Summary: Universe Extractor + Structured Universe Model

## What changes in business logic

- After an example story is analyzed, a second AI agent (universe fact extractor) reads the story and extracts 2–5 universe-specific facts (character traits, world details).
- Extracted facts are stored as pending suggestions — nothing is applied automatically.
- The user reviews suggestions on the universe detail page and approves or rejects each one.
- On approval, the user routes the fact: attach to an existing character, create a new character, or append to the general universe description.
- Characters become a first-class structured entity within each universe — individually editable, with name and free-text description.
- The style guide becomes four explicitly named subsections (what works / what doesn't / preferred techniques / minimize) instead of one opaque text blob.
- Pending suggestion count appears as a badge on universe cards and in the inbox navigation item, so new facts are never missed.

## What changes in user experience

- Universe form gains a **characters section**: card-based grid with add/edit/delete per character.
- Universe form's style guide becomes four separate textareas, each with a named heading.
- After adding an example story with "analyze" checked, a badge appears on the universe card within seconds showing how many new facts were found.
- The universe detail page shows a "Новые факты (N)" section at the bottom. Each fact has Принять / Отклонить buttons.
- Clicking Принять opens a small picker: which character to attach to, or "general description". The fact is appended as a bullet. The badge decrements.

## What changes architecturally

- **New DB table** `universe_suggestions` — holds extracted facts with `pending` / `approved` / `rejected` status.
- **New DB columns** on `story_groups`: `characters` (jsonb), `style_guide_works`, `style_guide_doesnt_work`, `style_guide_techniques`, `style_guide_minimize` (all text).
- **Existing `style_guide` column** is kept as the compiled pipeline-facing text, regenerated from the 4 subsection columns on every save.
- **New backend service** `universe-fact-extractor.ts` in the pipeline stages — uses a new Claude skill to extract facts.
- **`POST /stories/:id/analyze`** calls the universe fact extractor after the existing story-analyzer and saves suggestions.
- **New API routes** under `/api/universes/:id/suggestions` — list, approve (with target routing), reject.
- **`style-guide-updater.ts`** updated to write to the 4 subsection columns and regenerate `style_guide`.
- **Frontend `StoryGroup` type** extended with `characters`, 4 style guide fields, `pendingSuggestionsCount`.

## Decisions made autonomously

- **Keep `style_guide` compiled column**: pipeline agents currently read `styleGuide` from the ORM row. Removing it would require changing orchestrator.ts and all stage prompts. Keeping it as a generated cache costs one extra DB write per save — acceptable.
- **Sequential extraction** (not async): universe fact extractor runs in-process after story-analyzer. No queue introduced. If latency becomes a problem, it can be moved to a background job later.
- **No migration of existing `style_guide` data** into the 4 subsection columns: existing accumulated history stays in the compiled column. New subsection columns start empty and fill from the next analysis run.
- **Suggestion routing on approve via request body** (not a modal-only frontend concern): the `POST .../suggestions/:id/approve` endpoint accepts `{target: 'character', characterName: string} | {target: 'new_character', characterName: string} | {target: 'description'}` so the logic lives in the backend, not scattered across frontend state.
