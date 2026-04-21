---
type: scenarios
branch: main
task: universe-extractor
state: confirmed
updated: 2026-04-20
---

# Scenarios: Universe Extractor + Structured Universe Model

## Business Scenarios

---

SCENARIO 1: Example story analyzed — universe facts extracted and stored as pending
  Type: business
  Actor: System (triggered by user clicking "analyze" on an example story)

  The user adds an example story in `add-example-story-modal` with the "analyze" checkbox checked. After the story is created, the frontend calls `POST /api/stories/:id/analyze`. The existing story-analyzer runs first (extracting reactions and style patterns). Then the new universe fact extractor runs, reads the story text, and produces 2–5 universe-specific facts. Each fact is saved to `universe_suggestions` with `status: pending` and linked to the story and the universe. The API response includes `suggestionsCreated: N`. The universe card in the list now shows a badge with the count of pending suggestions.

  Acceptance:
    Code:
      [ ] `universe_suggestions` table exists in schema with fields: id, universe_id, fact_text, source_story_id, status, created_at
      [ ] `packages/core/src/pipeline/stages/universe-fact-extractor.ts` exists
      [ ] `.claude/skills/universe-fact-extractor` skill prompt exists
      [ ] `UniverseFactExtractorOutputSchema` defined in `packages/core/src/pipeline/schemas.ts`
      [ ] `POST /api/stories/:id/analyze` inserts rows into `universe_suggestions` when story has a groupId
    Behavior:
      [ ] Extractor is skipped (no error) when story has no `groupId`
      [ ] Extracted facts count is 2–5 (schema enforces `min(1) max(5)`)
      [ ] Each suggestion saved with `status: 'pending'`
      [ ] API response includes `suggestionsCreated: number`
    Integration:
      [ ] `POST /api/stories/:id/analyze` calls universe fact extractor after story-analyzer completes
      [ ] `GET /api/universes` response includes `pendingSuggestionsCount` per universe
    Observability:
      [ ] Console log `[analyze] story N — universe facts: M suggestions created` emitted
    Tests:
      [ ] `packages/core/src/pipeline/stages/universe-fact-extractor.test.ts` asserts output schema validity

---

SCENARIO 2: User approves a suggestion and attaches it to an existing character
  Type: business
  Actor: User (on universe detail page)

  The user opens the universe detail page. In the "Новые факты" section, a pending suggestion reads "Ваня боится темноты". The user clicks Принять. A picker appears with existing characters and "Общее описание". The user selects "Ваня". The system calls `POST /api/universes/:id/suggestions/:suggestionId/approve` with `{target: 'character', characterName: 'Ваня'}`. The API appends "— боится темноты" as a bullet to Ваня's description in the `characters` JSONB column and sets the suggestion's status to `approved`. The suggestion disappears from the pending list. The badge decrements by 1.

  Acceptance:
    Code:
      [ ] `POST /api/universes/:id/suggestions/:suggestionId/approve` route exists
      [ ] `appendFactToCharacter` pure function exists
    Behavior:
      [ ] Character's description gains the fact as a new bullet point (`\n- <fact_text>`)
      [ ] Suggestion `status` changes from `pending` to `approved`
      [ ] Returns 409 if suggestion is already approved or rejected
      [ ] Returns 404 if suggestion does not belong to this universe
    Integration:
      [ ] `PATCH /api/universes/:id` is NOT called — approval writes directly to `story_groups.characters`
      [ ] `GET /api/universes/:id/suggestions?status=pending` no longer includes the approved suggestion
    Observability:
      [ ] Not applicable — no dedicated log line required beyond standard request logging
    Tests:
      [ ] `appendFactToCharacter.test.ts` asserts appended bullet on existing character
      [ ] `appendFactToCharacter.test.ts` asserts new character created when name not found

---

SCENARIO 3: User approves a suggestion and attaches it to the general universe description
  Type: business
  Actor: User

  The pending suggestion reads "В мире Гоши есть волшебный лес у города". The user clicks Принять and selects "Общее описание вселенной". The system calls approve with `{target: 'description'}`. The API appends the fact as a bullet to `story_groups.description`. Suggestion status becomes `approved`.

  Acceptance:
    Code:
      [ ] `appendFactToDescription` pure function exists
    Behavior:
      [ ] `story_groups.description` gains `\n- <fact_text>` appended
      [ ] Suggestion `status` = `approved`
    Integration:
      [ ] Same approve endpoint handles both character and description targets via the `target` field
    Observability:
      [ ] Not applicable
    Tests:
      [ ] `appendFactToDescription.test.ts` asserts bullet appended to existing description
      [ ] `appendFactToDescription.test.ts` asserts bullet is first content when description is empty

---

SCENARIO 4: User approves a suggestion and creates a new character
  Type: business
  Actor: User

  The pending suggestion reads "Артём — одноклассник Гоши, любит скорость". The user clicks Принять and selects "+ Новый персонаж", types "Артём". The system calls approve with `{target: 'new_character', characterName: 'Артём'}`. `appendFactToCharacter` creates a new character entry. The `characters` JSONB array gains `{name: 'Артём', description: '- Артём — одноклассник Гоши, любит скорость'}`.

  Acceptance:
    Code:
      [ ] `appendFactToCharacter` handles the case where `characterName` does not exist in `characters`
    Behavior:
      [ ] New character entry `{name, description}` added to `characters` array
      [ ] Suggestion `status` = `approved`
    Integration:
      [ ] Frontend "new character" input submits `target: 'new_character'` with `characterName` to the approve endpoint
    Observability:
      [ ] Not applicable
    Tests:
      [ ] `appendFactToCharacter.test.ts` covers new-character creation case

---

SCENARIO 5: User rejects a suggestion
  Type: business
  Actor: User

  The user clicks Отклонить on a pending suggestion. The system calls `POST /api/universes/:id/suggestions/:suggestionId/reject`. Suggestion status becomes `rejected`. It disappears from the pending list. The badge decrements. Nothing else changes.

  Acceptance:
    Code:
      [ ] `POST /api/universes/:id/suggestions/:suggestionId/reject` route exists
    Behavior:
      [ ] Suggestion `status` = `rejected`
      [ ] Returns 409 if already approved or rejected
      [ ] No changes to `story_groups` characters or description
    Integration:
      [ ] `GET /api/universes/:id/suggestions?status=pending` no longer includes the rejected suggestion
    Observability:
      [ ] Not applicable
    Tests:
      [ ] Not applicable — no business logic to unit test; covered by API route behavior

---

SCENARIO 6: User manually edits characters in the universe form
  Type: business
  Actor: User

  The user opens the universe edit form. The characters section shows cards for Ваня and Лиза. The user clicks "+ Добавить" and types "Артём" with a description. On save, the `PATCH /api/universes/:id` payload includes the updated `characters` array. The universe is saved. Agents consuming the universe in the next pipeline run see the new character in the universe context.

  Acceptance:
    Code:
      [ ] `story_groups.characters` JSONB column exists in schema
      [ ] `updateGroupSchema` in `packages/api/src/routes/universes.ts` accepts `characters` field
      [ ] Universe form UI has add/edit/delete character functionality
    Behavior:
      [ ] `characters` field accepts array of `{name: string, description: string}`
      [ ] Saving empty `characters: []` is valid
    Integration:
      [ ] `toPublic()` in universes route returns `characters` field
      [ ] `StoryGroup` type in `packages/web/src/lib/api.ts` includes `characters`
    Observability:
      [ ] Not applicable
    Tests:
      [ ] Not applicable — UI-level interaction; schema validation covers input shape

---

SCENARIO 7: Style guide auto-updated from story analysis — 4 subsection columns written
  Type: business
  Actor: System

  After an example story is analyzed, `updateStyleGuide` runs (existing). The updated function now writes extracted patterns to the 4 subsection columns (`style_guide_works`, `style_guide_doesnt_work`, `style_guide_techniques`, `style_guide_minimize`) and regenerates `style_guide` by calling `compileStyleGuide`. The compiled text is saved to `story_groups.style_guide` so pipeline agents remain unaffected.

  Acceptance:
    Code:
      [ ] `compileStyleGuide` pure function exists
      [ ] `style_guide_works`, `style_guide_doesnt_work`, `style_guide_techniques`, `style_guide_minimize` columns exist on `story_groups`
      [ ] `updateStyleGuide` in `style-guide-updater.ts` writes to all 4 columns and calls `compileStyleGuide`
    Behavior:
      [ ] `style_guide` compiled column equals `compileStyleGuide(works, doesntWork, techniques, minimize)`
      [ ] Each subsection column contains only the content for that section (not the full compiled text)
    Integration:
      [ ] Pipeline orchestrator reads `story_groups.style_guide` unchanged — no orchestrator changes needed
    Observability:
      [ ] Not applicable
    Tests:
      [ ] `compileStyleGuide.test.ts` asserts correct markdown assembly with all 4 sections
      [ ] `compileStyleGuide.test.ts` asserts empty sections are omitted from compiled output

---

## Technical/Architectural Scenarios

---

SCENARIO 8: Story has no universe assigned — extractor silently skips
  Type: technical
  Actor: System

  When `POST /stories/:id/analyze` runs for a story with `groupId: null`, the universe fact extractor is skipped. No `universe_suggestions` rows are created. The existing story-analyzer flow (reactions → child_diary, style patterns → style_guide) completes normally.

  Acceptance:
    Code:
      [ ] Conditional guard in the analyze route: extractor only runs when `story.groupId` is not null
    Behavior:
      [ ] API response `suggestionsCreated: 0` when story has no groupId
      [ ] No error thrown or logged when extractor is skipped
    Integration:
      [ ] Not applicable beyond the guard
    Observability:
      [ ] Not applicable
    Tests:
      [ ] Not applicable — guard is trivial; covered by existing route behavior

---

SCENARIO 9: Suggestion already processed — approve/reject returns 409
  Type: technical
  Actor: User (or duplicate request)

  If a suggestion already has `status: 'approved'` or `status: 'rejected'`, calling approve or reject again returns HTTP 409 with an error message. The data is not modified.

  Acceptance:
    Code:
      [ ] Status check before update in both approve and reject handlers
    Behavior:
      [ ] HTTP 409 returned with `{error: 'Suggestion already processed'}`
      [ ] `story_groups` data unchanged
    Integration:
      [ ] Not applicable
    Observability:
      [ ] Not applicable
    Tests:
      [ ] Not applicable — guard logic; covered by route-level behavior check
