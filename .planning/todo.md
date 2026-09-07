# bedtime-agent todo

- [ ] Feed chat messages near a story into the Plotter and Writer when the story is sent for another round of changes.
- [ ] Add a real deployed dev environment (separate Cloud Run service + Pulumi stack), auto-deployed on merge to main; prod becomes manual-dispatch-only.
- [ ] Run character/trait extraction as a nightly batch job with a user approval/notification flow instead of silent per-story extraction.
- [ ] Wrap `DELETE /stories/:id` in a database transaction so a failed delete can't leave orphaned partial state.
- [ ] Give the plotter/writer real retrieval capability over past stories, not just pre-fetched context (built on branch `story-retrieval`, unmerged, needs review).
- [ ] Wire banked `story_comments` into universe memory synthesis — comments on read stories currently go nowhere.
- [ ] Wrap chat/comment text in the existing data-only prompt delimiter before it reaches Plotter/Writer (prompt-injection hardening).
- [ ] Bound plan/text chat conversation history sent per turn (no cap today).
- [ ] Cap the number of banked comments folded into one regenerate call.
- [ ] Universe memory sync silently drops feedback on stories outside the newest-50 window.
- [ ] Editing a parent review or child reaction after its universe has synced never reaches the style guide.
- [ ] Nightly universe-memory sync has no cross-instance concurrency guard.
- [ ] Give the plotter/writer memory blocks a single reconciliation pass instead of independent concatenation.
- [ ] Writer idiom examples are being copied verbatim instead of varied from.
- [ ] Adult-delivers-the-lesson resolutions are slipping past the "no explicit moral" rule.
- [ ] No mechanism prevents reusing the same conflict/resolution-mechanism shape across a universe's recent stories.
- [ ] Recurring secondary character (Artyom) is reused as a single stock function across stories.
- [~] Generated story illustrations default to photorealistic, not cartoon/comic style — partially addressed via character reference images; revisit for scenes with no named characters.
