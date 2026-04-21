---
type: spec
branch: main
task: universe-extractor
state: confirmed
phases-skipped: []
updated: 2026-04-20
---

# Spec: Universe Extractor + Structured Universe Model

### Derivers (mandatory)

| Deriver | Inputs | Output | Scenarios covered |
|---------|--------|--------|-------------------|
| `compileStyleGuide` | `works: string, doesntWork: string, techniques: string, minimize: string` | `string` — compiled markdown for agents | SCENARIO 7 |
| `appendFactToCharacter` | `characters: {name: string, description: string}[], characterName: string, factText: string` | `{name: string, description: string}[]` — updated array | SCENARIO 2, 4 |
| `appendFactToDescription` | `currentDescription: string, factText: string` | `string` — updated description | SCENARIO 3 |

**compileStyleGuide** encodes the rule: combine the 4 subsection columns into the single `style_guide` text that pipeline agents read. Omit empty sections. Section order: works → doesntWork → techniques → minimize.

**appendFactToCharacter** encodes: if `characterName` exists in the array, append `\n- <factText>` to their `description`. If not, create `{name: characterName, description: '- <factText>'}` and push to the array.

**appendFactToDescription** encodes: append `\n- <factText>` to `currentDescription`. If `currentDescription` is empty, result is `- <factText>`.

---

### Files to create

| File | Purpose |
|------|---------|
| `packages/core/src/db/migrations/<timestamp>_universe_extractor.sql` | Add `characters` JSONB, 4 style guide columns to `story_groups`; create `universe_suggestions` table |
| `packages/core/src/pipeline/stages/universe-fact-extractor.ts` | Calls Claude via `claudeCliRunner.runStructured` with `universe-fact-extractor` skill; returns extracted facts |
| `packages/core/src/pipeline/stages/universe-fact-extractor.test.ts` | Unit test: schema validation of output |
| `packages/core/src/pipeline/derivers/style-guide.ts` | Contains `compileStyleGuide` pure function |
| `packages/core/src/pipeline/derivers/style-guide.test.ts` | Unit tests for `compileStyleGuide` |
| `packages/core/src/pipeline/derivers/universe-facts.ts` | Contains `appendFactToCharacter` and `appendFactToDescription` pure functions |
| `packages/core/src/pipeline/derivers/universe-facts.test.ts` | Unit tests for both derivers |
| `packages/api/src/routes/universe-suggestions.ts` | Routes: GET suggestions, POST approve, POST reject |
| `.claude/skills/universe-fact-extractor` | Skill prompt for the extractor agent |
| `packages/web/src/components/universe-characters.tsx` | Card-based character editor component |
| `packages/web/src/components/universe-suggestions.tsx` | Pending suggestions list with approve/reject UI |
| `packages/web/src/components/suggestion-approve-picker.tsx` | Modal picker for routing approved fact |

---

### Files to modify

| File | Changes |
|------|---------|
| `packages/core/src/db/schema.ts` | Add `characters` jsonb, `styleGuideWorks`, `styleGuideDoesntWork`, `styleGuideTechniques`, `styleGuideMinimize` text cols to `storyGroups`; add `universeSuggestions` table definition |
| `packages/core/src/db/types.ts` | Export `UniverseSuggestion`, `NewUniverseSuggestion` types |
| `packages/core/src/pipeline/schemas.ts` | Add `UniverseFactExtractorOutputSchema` and export type |
| `packages/core/src/pipeline/style-guide-updater.ts` | Write to 4 subsection columns; call `compileStyleGuide` to regenerate `style_guide` |
| `packages/api/src/routes/universes.ts` | Accept `characters` in create/update schemas; include `characters`, 4 style guide cols, `pendingSuggestionsCount` in `toPublic()` |
| `packages/api/src/routes/stories.ts` | After `updateStyleGuide`, call `runUniverseFacts` + insert `universe_suggestions`; include `suggestionsCreated` in response |
| `packages/api/src/server.ts` | Mount `universe-suggestions` router at `/api/universes/:universeId/suggestions` |
| `packages/web/src/lib/api.ts` | Extend `StoryGroup` type; add `suggestions` API methods |
| `packages/web/src/pages/universe-form.tsx` | Add characters section (use `universe-characters.tsx`); replace style guide textarea with 4 subsection textareas; add suggestions section |

---

### Data model changes

**New columns on `story_groups`:**
```sql
characters           jsonb        DEFAULT '[]'
style_guide_works    text
style_guide_doesnt_work text
style_guide_techniques  text
style_guide_minimize    text
```

**New table `universe_suggestions`:**
```sql
id               serial PRIMARY KEY
universe_id      integer REFERENCES story_groups(id) NOT NULL
fact_text        text NOT NULL
source_story_id  integer REFERENCES stories(id)
status           text DEFAULT 'pending'   -- 'pending' | 'approved' | 'rejected'
created_at       timestamp DEFAULT now()
updated_at       timestamp DEFAULT now()
```

**`UniverseFactExtractorOutputSchema`:**
```ts
z.object({
  facts: z.array(z.object({
    fact_text: z.string(),
    suggested_character_name: z.string().nullable(),
  })).min(0).max(5)
})
```

**`StoryGroup` type additions (web/lib/api.ts):**
```ts
characters: {name: string; description: string}[]
styleGuideWorks: string | null
styleGuideDoesntWork: string | null
styleGuideTechniques: string | null
styleGuideMinimize: string | null
pendingSuggestionsCount: number
```

**Suggestion approval request body:**
```ts
// target: existing character
{target: 'character', characterName: string}
// target: new character
{target: 'new_character', characterName: string}
// target: general description
{target: 'description'}
```

---

### Implementation order

1. `/tdd compileStyleGuide` — covers SCENARIO 7
2. `/tdd appendFactToCharacter` — covers SCENARIO 2, 4
3. `/tdd appendFactToDescription` — covers SCENARIO 3
4. DB schema + migration (add columns, new table) — foundational for all routes
5. Update `style-guide-updater.ts` to use `compileStyleGuide` and write 4 subsection columns — covers SCENARIO 7 integration
6. Create `universe-fact-extractor.ts` + skill prompt — covers SCENARIO 1 agent
7. Update `POST /stories/:id/analyze` to call fact extractor and insert suggestions — covers SCENARIO 1 integration
8. Create `universe-suggestions.ts` route (list, approve, reject) using `appendFactToCharacter` / `appendFactToDescription` — covers SCENARIO 2, 3, 4, 5, 9
9. Mount suggestions router in `server.ts`
10. Update `universes.ts` route: accept new fields, compute `pendingSuggestionsCount` in `toPublic()`
11. Update `StoryGroup` type in `api.ts` + add suggestions API methods
12. Frontend: `universe-characters.tsx` component (card grid, add/edit/delete)
13. Frontend: `suggestion-approve-picker.tsx` modal
14. Frontend: `universe-suggestions.tsx` list component
15. Frontend: update `universe-form.tsx` with characters section, 4-subsection style guide, suggestions section

---

### Scope boundary

- No automatic application of facts — user approval is always required.
- No migration of existing `style_guide` or `universe_context` text into the new structured columns.
- No changes to pipeline orchestrator or any agent prompt files.
- No inbox page (`/inbox`) changes — badge on nav item only.
- No character images, avatars, or rich metadata beyond name + description.
- Suggestion routing is one-level deep only — no sub-character sections.
