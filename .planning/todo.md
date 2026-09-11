# bedtime-agent todo

## platform-reliability

### Scope
- Data-integrity gaps outside the generation pipeline (transactional deletes, nightly job concurrency)
- Operational/dev-environment gaps (dev deploy environment, nightly moderation batch)
- Out of scope: story-pipeline-feedback-loop and story-quality — the other two directions

### Coding tasks
- [ ] Add a real deployed dev environment, auto-deployed on merge to main.
- [ ] Wrap DELETE /stories/:id in a database transaction so a failed delete cannot leave orphaned partial state.
- [ ] Run character/trait extraction as a nightly batch job with a user approval/notification flow.

### Notes


## story-quality

### Scope
- Reducing repeated idioms, character stock-functions, and conflict/resolution shapes across a universe's stories
- Enforcing the no-explicit-moral rule at the writer/plotter stage
- Illustration style consistency
- Out of scope: story-pipeline-feedback-loop (how data reaches the prompt) and platform-reliability — the other two directions

### Coding tasks
- [ ] Generated story illustrations default to photorealistic for scenes with no named characters - no style anchor.
- [ ] Recurring secondary character (Artyom) is reused as a single stock function across stories.
- [ ] No mechanism prevents reusing the same conflict/resolution-mechanism shape across a universe's recent stories.
- [ ] Adult-delivers-the-lesson resolutions are slipping past the no-explicit-moral rule.
- [ ] Writer idiom examples are being copied verbatim instead of varied from.

### Notes


## story-pipeline-feedback-loop

### Scope
- How chat comments and redo feedback reach the Plotter/Writer
- How past-story/universe memory context reaches the Plotter/Writer and stays correct as data grows
- Prompt-injection and cost hardening on any user-typed text that reaches a generation call
- Out of scope: story-quality (repetition/moral-telling/illustration style) and platform-reliability (transactions, dev env, nightly batch ops) — the other two directions

### Coding tasks
- [ ] Give the writer the same past-story retrieval the plotter already has.
- [x] Feed redo-round chat messages into the Plotter and Writer prompts.
- [ ] Give the plotter/writer memory blocks a single reconciliation pass instead of independent concatenation.
- [ ] Nightly universe-memory sync has no cross-instance concurrency guard.
- [ ] Editing a parent review or child reaction after its universe has synced never reaches the style guide.
- [ ] Universe memory sync silently drops feedback on stories outside the newest-50 window.
- [x] Cap the number of banked comments folded into one regenerate call.
- [x] Bound plan/text chat conversation history sent per turn.
- [ ] Wrap chat/comment text in the existing data-only prompt delimiter before it reaches Plotter/Writer.
- [ ] Wire banked story_comments into universe memory synthesis.

### Notes
- Plan-chat endpoint needs a different injection-hardening approach (real conversation, not one-shot).
- Writer retrieval needs a streaming-safe tool-loop, not a plotter-style copy.
