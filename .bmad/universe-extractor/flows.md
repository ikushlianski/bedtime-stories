---
type: flows
branch: main
task: universe-extractor
state: confirmed
updated: 2026-04-20
---

# Key Flows: Universe Extractor + Structured Universe Model

## Flow 1: Example story analyzed → suggestions created

```
[add-example-story-modal]
       |
       | POST /api/stories/:id/analyze
       v
[stories.ts analyze route]
       |
       |-- runStoryAnalyzer() -----------------> [story-analyzer.ts]
       |       |                                       |
       |       |<-- StoryAnalysisOutput ---------------+
       |
       |-- updateStyleGuide() ----------------> [style-guide-updater.ts]
       |       |                                       |
       |       |                              writes 4 subsection columns
       |       |                              + compileStyleGuide → style_guide
       |       |<-- done -------------------------------+
       |
       |-- runUniverseFacts() (new) ----------> [universe-fact-extractor.ts]
       |       |                                       |
       |       |<-- {facts: [{fact_text, suggested_character_name}]} --+
       |
       |-- INSERT universe_suggestions (N rows, status: pending)
       |
       v
  JSON response: { storyAnalysis, reactionsExtracted, styleGuideUpdated, suggestionsCreated: N }
```

1. Frontend calls `POST /api/stories/:id/analyze` (already exists from the "analyze" checkbox).
2. The route runs `runStoryAnalyzer` (unchanged) to get style patterns and reactions.
3. `updateStyleGuide` (updated) writes patterns to the 4 subsection columns and saves compiled `style_guide`.
4. If story has a `groupId`, the route calls `runUniverseFacts` with story text and existing characters JSON.
5. The extractor returns an array of `{fact_text, suggested_character_name}` objects.
6. The route inserts each fact as a row in `universe_suggestions` with `status: 'pending'` and the story's `groupId`.
7. The route responds with `suggestionsCreated: N`.
8. Frontend reads `suggestionsCreated` from the response and shows a toast; universe list re-fetches to show badge.

---

## Flow 2: User approves a suggestion and routes it

```
[Universe detail page — Новые факты section]
       |
       | user clicks Принять → picker appears
       | user selects target (character / new_character / description)
       |
       | POST /api/universes/:id/suggestions/:suggestionId/approve
       |       body: { target, characterName? }
       v
[universes-suggestions.ts route]
       |
       |-- fetch suggestion (verify pending + belongs to universe)
       |
       |-- if target === 'character' or 'new_character':
       |       appendFactToCharacter(characters, characterName, factText)
       |       → updated characters array
       |       UPDATE story_groups SET characters = updatedArray
       |
       |-- if target === 'description':
       |       appendFactToDescription(description, factText)
       |       → updated description string
       |       UPDATE story_groups SET description = updatedString
       |
       |-- UPDATE universe_suggestions SET status = 'approved'
       |
       v
  204 No Content (or 200 with updated resource — implementer decides)
```

1. Frontend sends approve request with `target` and optional `characterName`.
2. Route fetches the suggestion, confirms it belongs to the universe and is still `pending`.
3. Route fetches current `story_groups` row to get `characters` and `description`.
4. Calls the appropriate pure deriver (`appendFactToCharacter` or `appendFactToDescription`).
5. Writes the updated value back to `story_groups`.
6. Updates suggestion status to `approved`.
7. Frontend removes the suggestion from the list and decrements the badge.
