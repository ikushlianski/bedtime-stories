---
type: discussion
branch: main
task: universe-extractor
state: confirmed
updated: 2026-04-20
---

# Developer Q&A: Universe Extractor + Structured Universe Model

**Q1:** Should characters be stored as a JSONB column or as formatted text inside `universe_context`?
**A:** JSONB column (separate `characters` field). Enables card-based UI with individual add/edit/delete per character. Requires a DB migration.

**Q2:** When the extractor finds a new fact about an existing character, should it append a bullet or let the AI rewrite the description?
**A:** Neither should happen automatically. The AI should save extracted facts as "universe suggestions" that need user approval. Nothing is auto-applied or auto-edited — this is too important. The user can also manually add facts (free-form or structured) directly via the form.

**Q3:** Should the style guide be kept as one text field or split into separate columns?
**A:** Separate columns: `style_guide_works`, `style_guide_doesnt_work`, `style_guide_techniques`, `style_guide_minimize`.

**Q4:** Where should pending universe suggestions appear for review?
**A:** In the universe detail page (not the Входящие page). Each universe has a "Новые факты (N)" section at the bottom. There should also be a badge on the universe card and on the inbox nav item so the user notices new facts have arrived.

**Q5:** When approving a suggestion, how does the user route the fact to the right place?
**A:** A simple picker appears: attach to an existing character, create a new character (user types a name), or append to the general universe description.
