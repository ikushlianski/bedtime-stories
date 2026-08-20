---
type: scenarios
branch: main
task: character base/portrait images
state: confirmed
updated: 2026-08-21
---
# Scenarios: character base/portrait images

## Business Scenarios

### SCENARIO 1: Uploading baseline reference images for a character

A person adds one or more of their own reference photos/drawings to a character in the universe management screen, separate from the character's text bible fields.

What to verify:
- Multiple images can be selected and uploaded in one action; each becomes its own stored reference tied to that character.
- Uploaded references appear immediately as thumbnails without a page reload, fetched through a short-lived signed link the app hands back right after upload — not a plain public address, since these may be real photos and are never made publicly reachable.
- A non-image file, or a file over the size limit, is rejected with a message naming why, before anything is uploaded.
- Uploading references never triggers portrait generation — it only stores material for a future manual generation.

### SCENARIO 2: Generating a portrait from the character's own uploaded references

A person clicks "Generate portrait" for a character that already has one or more uploaded reference images.

What to verify:
- All of that character's uploaded references are used as image-editing/composition input — none are skipped for having "enough already."
- The resulting portrait shows one character alone, in a clean headshot/portrait presentation, not a scene.
- The character record shows this portrait came from its own references (not the universe-sibling or default-style tier), so a person auditing why it looks a certain way can tell at a glance.

### SCENARIO 3: Generating a portrait by matching an existing universe's style

A person clicks "Generate portrait" for a character that has no uploaded references of its own, in a universe where at least one other character already has a generated portrait.

What to verify:
- Up to 3 of the universe's existing character portraits are used as style references; the model is not asked to copy their identity, only their art style, and invents this character's own appearance based on the character description.
- If the universe has more than 3 existing portraits, exactly 3 are used, not all of them.
- The resulting portrait is one character alone in a portrait/headshot presentation, and its recorded source tier says "universe sibling," not "own reference" or "default style."
- A character's own current or previous portraits are never offered back to it as a "sibling" reference when it regenerates itself — sibling matching only ever looks at *other* characters.

### SCENARIO 4: Generating the first portrait ever in a universe

A person clicks "Generate portrait" for a character in a universe where no character has any uploaded reference and no character has a generated portrait yet.

What to verify:
- The app's own bundled default style image is used purely as an art-style reference — the output is one character alone in a portrait/headshot presentation, never the multi-character playground scene the default image itself depicts.
- The resulting portrait's recorded source tier says "default style."
- Once this portrait exists, the next character generated in the same universe (with no references of its own) follows Scenario 3, not this one — the universe now has a sibling portrait to match instead.

### SCENARIO 5: Regenerating a portrait keeps up to 3 previous ones

A person who is unhappy with a character's current portrait clicks "Generate portrait" again for that same character.

What to verify:
- The character's displayed current portrait, generation timestamp, and source tier all update to the new result immediately.
- The portrait it replaced becomes visible in a "previous portraits" strip, most recent first, rather than disappearing entirely.
- After 4 total generations for one character, the oldest of the *previous* ones (not the current one) drops out of the strip — at most 3 previous portraits are kept alongside the 1 current one, and the strip is view-only (no "restore this one" action; a dropped-off portrait is only recoverable through the storage bucket's own version history, same as before this list existed).
- Which fallback tier applies is re-evaluated fresh each time (e.g. if references were added since the last generation, a regenerate now uses them, even if the previous portrait used a different tier).

### SCENARIO 6: Deleting an uploaded reference image

A person removes one previously uploaded reference image from a character that has several.

What to verify:
- Only the selected image is removed; the character's other references and its already-generated portrait (if any) are unaffected.
- The removed image no longer appears in the reference thumbnail list.
- If this removal empties the character's reference list entirely, the *next* portrait generation for that character falls back to Scenario 3 or 4 rather than failing.

### SCENARIO 7: Portrait generation never happens automatically

A person creates a new character, or edits an existing character's bible fields (description, age, traits, relationships), through the normal character form.

What to verify:
- No portrait is generated and no cost is incurred as a side effect of saving the character form — generation only ever happens from the dedicated "Generate portrait" button.
- A character with no portrait yet displays a clear empty/placeholder state, not a broken image or a silent gap.

### SCENARIO 8: Generation fails cleanly

A person clicks "Generate portrait" and the OpenRouter call fails (timeout, provider error, or a rejected request).

What to verify:
- The character's existing portrait (if any) is left exactly as it was — a failed attempt never partially overwrites it.
- The button returns to a usable state with a clear, actionable error, so the person can simply try again rather than being stuck.
- The failed attempt is still visible in the app's existing cost/call tracking, marked unsuccessful, so a failure pattern would show up there even though nothing was billed for it.

### SCENARIO 9: Generation succeeds but saving the result fails

The OpenRouter call returns a generated image, but uploading it to storage or writing it to the character record then fails.

What to verify:
- This state is distinguishable from Scenario 8 in the error shown to the person — a real cost was just incurred and simply retrying without knowing that would be misleading.
- The attempt is recorded in the app's cost tracking as a successful, billed call, regardless of what happened afterward — cost visibility never depends on the save step succeeding.
- The character's portrait fields are not left half-written (e.g. a URL pointing at nothing, or a tier with no matching image).

## Technical/Architectural Scenarios

### SCENARIO 10: Concurrent double-click does not double-bill

A person clicks "Generate portrait" and, before the first request returns, clicks it again.

What to verify:
- Only one billed generation call is made for that click sequence.
- The UI makes the in-flight state visible (disabled button/spinner) rather than silently ignoring the second click with no feedback.

### SCENARIO 11: Deleting a character with images attached still works

A person deletes a character that has uploaded reference images, a current portrait, previous portraits, and past generation cost records.

What to verify:
- The character deletion succeeds instead of failing on a foreign-key error — this is an existing, already-working feature that must not regress once images are attached to a character.
- All of that character's reference-image rows, portrait rows, and cost-tracking rows are removed along with it; nothing is left pointing at a character that no longer exists.
- The underlying image files in storage are not specially cleaned up as part of this — consistent with how removing a single reference image already works, storage cost here is treated as negligible.
