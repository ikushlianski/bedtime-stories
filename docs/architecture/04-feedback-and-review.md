# Feedback and review

## Review loop

Once a generated story reaches `proofreading`, the parent can mark up passages with **annotations** (each tied to either the plan or the text). Asking for a rewrite (`redo-text` → `triggerTextRewrite` → `runAnnotatedRewrite`) feeds those annotations to the writer as explicit editor notes and produces a new `story_text_version`, leaving the story in `text_review`. This can repeat as many times as needed. When the parent is satisfied, `approve-text` promotes the story to `ready` (copying the chosen version into `text_final`) and notifies Telegram. Reading it — in the web app or the bot — flips it to `read` and logs a `story_readings` row.

![Review loop](img/04a-review-loop.png)

```mermaid
flowchart TD
  proof["status: proofreading"]
  annot["Parent adds annotations<br/>(context: plan or text)"]
  redo["redo-text &rarr; triggerTextRewrite<br/>&rarr; runAnnotatedRewrite (editor notes)"]
  review["status: text_review<br/>new story_text_version"]
  approve["approve-text<br/>status: ready, textFinal set, readyAt"]
  notify["notifyStoryReady('approved')<br/>&rarr; Telegram"]
  read["Read (web / Telegram)<br/>status: read + story_readings row"]

  proof --> annot --> redo --> review
  review -->|"needs more edits"| annot
  review --> approve
  proof -->|"approve as-is"| approve
  approve --> notify
  approve --> read
```

## Learning loops

Two independent learning loops feed back into future stories, and they use **different signals** — the anchor map lumped them together, but in the code they are separate:

1. **Reaction personalization (runs for any universe).** The child's structured `child_reactions` are summarized by `loadReactionPreferences` and injected as the plotter's reaction block, so what landed well nudges future plots. These reactions do **not** feed the style guide.

2. **The analyze loop (legacy stories only).** The analyze endpoint refuses non-legacy stories (returns 422 unless `source === 'legacy'`). For a legacy story it runs `runStoryAnalyzer`, writes extracted child reactions into `child_diary`, updates the cumulative **style guide** on `story_groups` (fed by the analysis plus parent reviews and annotations), and runs `runUniverseFactExtractor` to propose new `universe_suggestions` (pending until the parent approves). The style guide then flows into both the plotter and writer prompts; approved suggestions become universe characters/context.

![Learning loops](img/04b-learning-loops.png)

```mermaid
flowchart LR
  subgraph reactionloop["Reaction personalization (every universe)"]
    direction LR
    react["child_reactions"]
    rp["loadReactionPreferences"]
    plotter["Plotter reaction block"]
    react --> rp --> plotter
  end

  subgraph analyzeloop["Analyze loop (LEGACY stories only — 422 otherwise)"]
    direction TB
    analyze["Analyze endpoint"]
    sa["runStoryAnalyzer"]
    diary["child_diary<br/>(extracted reactions)"]
    prann["parent_reviews + annotations"]
    sg["updateStyleGuide<br/>&rarr; story_groups.style_guide"]
    fe["runUniverseFactExtractor"]
    us["universe_suggestions<br/>(pending &rarr; parent approves)"]
    analyze --> sa --> diary
    sa --> sg
    prann --> sg
    sa --> fe --> us
  end

  sg -.->|"style block"| pw["Plotter &amp; Writer prompts"]
  us -.->|"approved facts"| uc["universe_characters / context"]
```
