---
type: scenarios
branch: main
task: story illustration album
state: confirmed
updated: 2026-08-22
---
# Scenarios: story illustration album

## Business Scenarios

### SCENARIO 1: A finished story quietly gets its picture book

A story finishes being written and gets approved through the normal review flow, becoming ready to read, and nobody marked any fragment for illustration beforehand.

What to verify:
- Within roughly a minute, up to two illustrations appear on that story's reading page, without anyone clicking a button.
- The person approving the story is never blocked waiting for illustrations — approval finishes and the reading page opens normally regardless of how long picture-generation takes in the background.
- If the illustrations aren't ready yet the moment the reading page is first opened, revisiting the page shortly after shows them once they land.

### SCENARIO 2: A story imported from the old archive, marked as already read

Someone imports an older, already-written story from the archive and marks it ready to read at the same time (the historical bulk-import path), with no fragments marked.

What to verify:
- This path also gets an automatic two-illustration album — every story that becomes ready to read gets one, not only stories generated through the normal writing pipeline.
- Importing many older stories in one sitting means the same real per-story cost applies to each one, so a bulk import of many stories at once carries a proportionally larger cost — worth knowing before pasting in twenty stories at once.

### SCENARIO 3: A story that already has an album never gets billed twice

A story that already went through the automatic illustration step gets its "ready" status touched again by some other action (for example, being marked ready a second time by an administrative action).

What to verify:
- No second illustration run fires, and no second charge is incurred, for a story that already has an album.
- The existing album is left exactly as it was.

### SCENARIO 4: Picking your own moment to illustrate, while reviewing the text

While looking at a story's text, a person selects a short passage they want illustrated and marks it, using the same kind of selection action already used elsewhere on this page for leaving reactions and notes.

What to verify:
- Marking a passage is available as a direct action right where the passage is selected, not a separate hidden step.
- The marked passage is stored as its own distinct thing, never blended into the story's narrative text itself or into any other note/reaction already attached to the story.
- Marking a passage does not, by itself, generate anything yet — it only records the person's intent for the next time an album gets (re)generated.

### SCENARIO 5: Manually marked passages fill their own slots first

A story has one or more manually marked passages by the time its illustration album gets generated (whether automatically on becoming ready, or via the manual regenerate action).

What to verify:
- Every marked passage gets its own illustration — one per mark — always, regardless of how many marks exist.
- Once the number of marks reaches the normal target of two, the automatic moment-picking step does not run at all, so no cost is spent choosing moments that end up unused.
- If every marked passage is later removed, the next (re)generation falls back fully to the automatic two-moment selection, same as scenario 1.

### SCENARIO 16: A single mark plus one automatically-picked moment, in the same album

A story has exactly one manually marked passage by the time its illustration album gets generated — fewer marks than the normal target of two.

What to verify:
- The album contains the marked passage as one illustration, plus one additional illustration chosen automatically to fill the remaining slot, for a total of two.
- The automatically-picked moment is a different beat of the story than the one already marked, not a near-duplicate of it.
- Nothing about the automatically-filled illustration looks or behaves differently from a fully-automatic album's illustrations — a person browsing the album afterward can't tell which one came from which source without checking.

### SCENARIO 6: Changing your mind about which moment to mark

A person who already marked a passage decides they marked the wrong part, or wants to add another passage.

What to verify:
- An existing mark can be removed.
- A new mark can be added in its place, or as an additional mark alongside existing ones.
- Changing marks after an album already exists does not, by itself, regenerate anything — the person uses the manual regenerate action once they're done adjusting marks, the same way any other post-approval text change requires a manual regenerate to take effect (see scenario 10).

### SCENARIO 7: There's a practical limit on how many passages someone can mark

A person keeps marking more and more passages on the same story.

What to verify:
- Marking is capped at a small, fixed number of passages per story, clearly communicated once reached, so a person can't accidentally build an unbounded, unboundedly expensive album by hand.

### SCENARIO 8: Illustrations reuse how a character already looks

A story's cast includes a character who already has a generated portrait elsewhere in the app, alongside a character who has never had one generated, and this shows up either in an automatically-picked moment or a manually marked passage.

What to verify:
- In any illustrated moment or marked passage featuring the character with an existing portrait, that character is drawn to match their established look, not reinvented from scratch each time.
- A character with no portrait yet has their appearance invented once from their written description, consistent with the single art style every illustration in this app shares.
- The picture-book art style itself stays consistent across every illustration in the album regardless of which characters appear or whether the moment was picked automatically or marked by hand.

### SCENARIO 9: A generation attempt fails partway through

Something goes wrong generating one of several illustrations for a story (a temporary failure on the image-generation side), while the rest succeed — whether the album is automatic or built from manual marks.

What to verify:
- The story is still fully readable regardless of what happened to its illustrations — a partial or failed album never blocks reading.
- Whatever illustrations did succeed are shown; the ones that failed are simply absent rather than shown as broken images.
- Nothing automatically retries the missing ones on its own — a person can use the manual "regenerate album" action later if they want a complete set.

### SCENARIO 10: Picking which moments to illustrate can misname a character

The automatic step that decides which moments to illustrate occasionally attributes a moment to a character name that doesn't actually match anyone in the story's known cast (a known, occasional AI mistake); the same kind of mismatch can happen when scanning a manually marked passage for which cast members it mentions.

What to verify:
- The moment or marked passage is still illustrated — a misattributed or unmatched name never blocks or cancels that illustration.
- That particular character's established look simply isn't used as a reference for that one illustration, since the app couldn't confidently match the name to a known cast member.
- A manually marked passage that refers to a character only by pronoun ("he", "she") rather than by name is illustrated with no identity reference for that character at all, even if the same character has an established portrait elsewhere in the story — a known, accepted gap of the plain text-matching approach used for marked passages, not something the marking feature tries to resolve automatically.

### SCENARIO 11: A person browses the picture book

A person opens a story's reading page that already has an illustration album.

What to verify:
- The illustrations appear as a row of clickable thumbnails on the reading page, in the order the moments occur in the story.
- Clicking any thumbnail opens a large, focused view of that image.
- From the large view, the person can page left and right through all of the story's illustrations without closing and reopening it.

### SCENARIO 12: A parent isn't happy with the automatic or marked result

A person looks at a story's existing album and wants a fresh attempt — either because the pictures came out wrong, or because the story's text was substantially rewritten, or because marks were changed since the album was made.

What to verify:
- A manual "regenerate album" action is available on the reading page for any story that already has (or was supposed to get) an album.
- Using it replaces the existing illustrations with an entirely new set, discarding the previous ones rather than adding to them, and picks up whatever marks currently exist at that moment — filling any remaining slots automatically, or running fully automatic if no marks exist at all.
- This action carries the same real cost as the automatic run and makes that clear before it fires, the same way this app already warns before other paid, one-click actions.

### SCENARIO 13: A story gets sent back for rewriting after already being approved

A story that already has an illustration album gets sent back to the review/editing stage for further changes, and is later re-approved.

What to verify:
- Re-approving it does not, by itself, automatically discard or refresh the existing album — even if the text changed in the meantime, and even if marks changed in the meantime.
- The manual "regenerate album" action (scenario 12) remains available as the way to refresh a now-mismatched album by hand.

### SCENARIO 14: Deleting a story with an album still works

A story that has a generated illustration album and/or manual marks gets deleted.

What to verify:
- The deletion succeeds instead of failing — this is an existing, already-working action that must not regress once illustrations or marks are attached to a story.
- All of that story's illustration records, marks, and their cost-tracking history are removed along with it; nothing is left pointing at a story that no longer exists.

## Technical/Architectural Scenarios

### SCENARIO 15: The story has no usable text yet

The automatic illustration step is reached for a story record that, unusually, has no final text at all.

What to verify:
- No illustration attempt is made and nothing is billed — there is no scene to illustrate.
- The story itself is unaffected and remains readable in whatever state its text actually is in.
