# Architecture: "Gosha's Book" v2

## Stack
- **Frontend:** HTML/JS (reader + annotations + diff-viewer + feedback)
- **Backend:** Node.js + Express
- **DB:** PostgreSQL (Neon — cloud-hosted, data not stored locally)
- **Agents:** Anthropic API

---

## Agents and Models (fixed per run)

| Agent | Model (default) | Task |
|---|---|---|
| Plotter | Sonnet | Detailed story plan |
| Psychologist | Sonnet | Structured evaluation: safety + therapeutic |
| Plot Critic | Haiku | Editorial review of plan + improvement_needed |
| Writer | Sonnet | Final text (A/B with Opus via dashboard) |
| Writer's Critic | Haiku | Editorial review of text + improvement_needed |
| Improver | Sonnet | Two-pass feedback analysis → prompt updates |

**Important:** each run locks in the model + prompt version for each role.

---

## Structured Agent Output

All agents return JSON, not free text. This is critical for pipeline reliability.

```
// Psychologist
{
  safety: {
    verdict: "safe" | "concern" | "block",
    issues: string[]
  },
  therapeutic: {
    score: 1-5,
    strengths: string[],
    gaps: string[]
  },
  recommended_changes: string[]  // actionable, specific
}

// Plot Critic / Writer's Critic
{
  issues: [{ prio: "must" | "nice", description: string, quote?: string }],
  improvement_needed: boolean  // false = early exit from iteration loop
}

// Improver
{
  patterns: [{ description: string, evidence_count: number }],
  proposed_changes: [{
    agent: string,
    current_text: string,
    proposed_text: string,
    rationale: string,
    confidence: "high" | "medium" | "low"
  }]
}
```

---

## Lifecycle

```
1. SEED (you)
   → saved to idea bank

2. PLOTTER
   → plan v1

3. PLAN ITERATIONS (up to 3, early exit if improvement_needed: false)

   Iteration 1 and final:
   │
   ├─ Psychologist(plan vN) → { safety: {verdict, issues[]}, therapeutic: {score, strengths[], gaps[]}, recommended_changes[] }
   │         ↓
   └─ Plot Critic(plan vN + structured_psych_output) → { issues, improvement_needed: bool }
             ↓
        Plotter → plan v(N+1)

   Intermediate iterations 2+:
   └─ Plot Critic(plan vN) → { issues, improvement_needed: bool }
             ↓
        Plotter → plan v(N+1)

   Psychologist on iteration 1 — catches fundamental problems early.
   Psychologist on final iteration — final approval before human review.
   Intermediate iterations — critic only (cheaper, faster).
   After 3 iterations — stop regardless of result.

4. HUMAN REVIEWS THE PLAN
   Shown:
   - plan v1 (original)
   - plan final
   - diff between them
   - psychologist's assessment from last iteration
   Optionally: feedback on the critic's and psychologist's work
   → approve and continue

5. WRITER
   → text v1

6. TEXT ITERATION (exactly once)
   │
   ├─ Psychologist(text v1)
   │    └─ psychological assessment of text
   │         ↓
   └─ Writer's Critic(text v1 + psychologist assessment)
        └─ editorial notes incorporating psychologist's input
             ↓
        Writer(critic's notes) → text v2

7. HUMAN REVIEWS THE TEXT
   Shown:
   - text v1
   - text v2
   - diff between them (= critic + psychologist's work)
   - psychologist's assessment
   Optionally: feedback on the critic's and psychologist's work

8. READER
   You read to Sasha aloud
   Highlight text → mark reaction (sasha_reaction | my_note)
   Afterwards: answer 1-3 questions from the agent
   Record Sasha's answers briefly

9. FEEDBACK
   Rating 1-5 + text comment

10. IMPROVER (scheduled or after accumulating 2+ feedbacks)
    Two-pass:
    Pass 1: reads compressed historical memory (clusters of patterns from all past feedbacks)
    Pass 2: reads the last 5-10 feedbacks in full
    → clusters patterns (minimum 2 signals to surface a finding)
    → proposes targeted prompt edits with rationale
    You approve each edit individually
    → prompt is updated, old version is kept forever
```

---

## Monitoring (detailed)

### What is recorded per run

Each story stores a full snapshot at the time of creation:

```
run_snapshot {
  story_id

  # Agents and models
  plotter_model                 + prompt_version
  psychologist_plan_model       + prompt_version
  plot_critic_model             + prompt_version
  writer_model                  + prompt_version
  psychologist_text_model       + prompt_version
  writer_critic_model           + prompt_version

  # Intermediate results
  plan_iterations_count         -- how many iterations ran (1-3)
  plan_v1, plan_final           -- original and final plan
  psychologist_plan_output      -- psychologist's assessment of the plan
  plot_critic_output            -- plot critic's notes
  text_v1, text_v2              -- first and final text
  psychologist_text_output      -- psychologist's assessment of the text
  writer_critic_output          -- writer's critic notes
}
```

### Dashboard: five panels

**Panel 1 — Quality over time**
```
X axis: time (by story)
Y axis: rating 1-5

Layers:
- rating line
- markers: when a prompt changed (which agent)
- markers: when a model changed

Reads as: after plotter prompt v3→v4, did ratings rise from 3.1 to 4.2?
```

**Panel 2 — Agent effectiveness**
```
For each critic agent and the psychologist:
- % of stories where their notes were incorporated by the writer/plotter
- Average diff between v1 and vFinal (large diff = agent actively worked)
- Your feedback on their work ("helped / didn't help")

Reads as: does the psychologist give notes that actually change the plan,
          or does the plot critic ignore their assessment?
```

**Panel 3 — Feedback patterns**
```
Improver clusters all your text comments:
- Top 5 recurring themes in your critique
- Trend: do these themes disappear after prompt edits or persist?

Reads as: "weak humor" appeared in 8 stories before the writer prompt fix,
          and in 1 story after — the fix worked.
```

**Panel 4 — Sasha's reactions**
```
- Annotations by type: sasha_reaction vs my_note
- Most annotated passages (where Sasha reacted most often)
- Sasha's answers to questions: engagement trend over time
```

**Panel 5 — Cost**
```
Per story: tokens and real cost per agent.
Aggregated: where is money spent without visible quality impact?
Enables decisions: replace Sonnet with Haiku for a specific agent?
```

---

## What is recorded per story

```
story {
  id
  title
  text_final

  # Plans
  plan_v1          -- original plotter plan
  plan_final       -- plan after iterations with critic
  plan_iterations  -- how many iterations ran

  # Texts
  text_v1          -- first writer text
  text_v2          -- after writer's critic

  # Agent metadata (snapshot at time of creation)
  plotter_model
  plotter_prompt_version
  plot_critic_model
  plot_critic_prompt_version
  writer_model
  writer_prompt_version
  writer_critic_model
  writer_critic_prompt_version

  created_at
  status: draft | ready | read | archived
  tags (JSON)                -- themes, emotions, characters
  source: agent | legacy     -- agent = pipeline, legacy = from Notion
  is_legacy (boolean)
  discussion_questions (JSON)
}
```

### feedback
```
id, story_id, rating 1-5, comment
feedback_type: agent_run | retrospective
  -- agent_run: feedback on pipeline run → goes to improver
  -- retrospective: critique of legacy story → analytics only, not improver
created_at
```

### prompts
```
id, agent: plotter | plot_critic | writer | writer_critic | improver
version, text, created_at
change_reason     -- why it was changed
source_feedbacks  -- JSON: ids of feedbacks that triggered the change
```

---

## Dashboard (separate page)

Three blocks:

**1. Quality trend**
Rating chart over time. Shows: do scores rise after prompt edits?

**2. Feedback tendencies**
Improver clusters your comments across all stories.
Example: "7 of the last 10 feedbacks mention weak humor" → that's a signal.

**3. Model + prompt vs quality table**

| Story | Date | Models | Prompt versions | Plan iterations | Rating | Sasha's reactions |
|---|---|---|---|---|---|---|

Shows: after switching the critic model from Haiku to Opus — did the plan improve? After plotter prompt v3→v4 — did ratings rise?

---

## Notion Migration

Separate script: parse Notion API → create records with `is_legacy: true`, `source: legacy`.
Status is set manually during migration: `read` if read to Sasha, `ready` if not.
Legacy stories can be run through the writer's critic — their notes go into `feedback` with type `retrospective` and are used for analytics only, not for the improver.

---

## Principles

- **Improver never changes prompts automatically** — only proposes
- **Improver does not read retrospective feedback** — only agent_run
- **Prompt versions are never overwritten** — only new ones are added
- **Each story is a snapshot** of model + prompt at the time of creation
- **Diff is always shown** — for both the plan and the text
