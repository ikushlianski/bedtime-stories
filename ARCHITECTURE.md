# Architecture: "Книга Гоши"

## System

```mermaid
flowchart LR
    Browser["Browser\nReact + Vite :8021"] -->|REST| API["API\nExpress :8020"]
    API --> DB[("Neon Postgres")]
    API --> Runner["Claude CLI\n@anthropic-ai/claude-agent-sdk"]
    Runner --> Skills["/.claude/skills/\nplotter-questions · plotter\npsychologist · plot-critic\nwriter · writer-critic"]
```

## Story Pipeline

```mermaid
flowchart TD
    Seed["Seed (parent input)"] --> Q["Plotter-Questions\n(extended thinking)\ngenerates 5+ questions\nwith 2–4 suggested options each"]
    Q --> Answers["Parent answers questions\n(pick option or type custom)"]
    Answers --> Plan["Plotter → plan v1"]

    Plan --> Loop{"Iteration loop\nmax 3"}
    Loop --> Psych["Psychologist\nsafety + therapeutic score"]
    Psych --> Critic["Plot Critic\nimprovement_needed?"]
    Critic -- "yes + iterations left" --> Plan2["Plotter → plan vN+1"]
    Plan2 --> Loop
    Critic -- "no / max reached" --> Writer["Writer → text v1"]

    Writer --> TextPass["Psychologist + Writer Critic\n(single pass)"]
    TextPass --> Writer2["Writer → text v2"]
    Writer2 --> Reader["Human reads aloud to Sasha\nannotations (reactions, notes)"]
    Reader --> FB["Rating + feedback"]
    FB --> Improver["Improver (scheduled)\nclusters patterns → proposes prompt edits"]
```

## Agent Involvement by Scenario

```mermaid
flowchart TD
    subgraph S1["Scenario 1 — Initial planning"]
        PQ["PlotterQuestions\ngenerates clarifying questions"]
        PQ --> P1["Plotter\nwrites planV1"]
        P1 --> L1{"Loop ≤ 3×"}
        L1 --> Ps1["Psychologist\niteration 1 and last only"]
        Ps1 --> PC1["PlotCritic\nimprovement_needed?"]
        PC1 -- yes --> P1b["Plotter\nrewrites plan"]
        P1b --> L1
        PC1 -- no --> READY1["plan_ready"]
    end

    subgraph S2["Scenario 2 — Redo with parent annotations"]
        ANN["Parent highlights text\nand writes comments"]
        ANN --> P2["Plotter\nsame seed + PARENT FEEDBACK block"]
        P2 --> L2{"Loop ≤ 3×"}
        L2 --> Ps2["Psychologist"]
        Ps2 --> PC2["PlotCritic"]
        PC2 -- yes --> P2b["Plotter\nrewrites"]
        P2b --> L2
        PC2 -- no --> READY2["plan_ready"]
    end

    subgraph S3["Scenario 3 — Approve plan → text phase"]
        W1["Writer\nwrites textV1 from planFinal"]
        W1 --> Ps3["Psychologist\nscores text"]
        Ps3 --> WC["WriterCritic\nflags issues"]
        WC --> W2["Writer\nrewrites → textV2"]
        W2 --> READY3["text_ready"]
    end

    subgraph S4["Scenario 4 — Improver (out-of-band, scheduled)"]
        FBs["All agent_run feedbacks\n+ structured ratings"]
        FBs --> I1["Improver pass 1\nclusters historical patterns"]
        I1 --> I2["Improver pass 2\nproposes prompt edits per agent"]
        I2 --> HUMAN["Human reviews\napplies or rejects changes"]
        HUMAN --> Prompts["New prompt version\nstored in DB\nused on next run"]
    end
```

### Notes
- **Psychologist** runs in two different contexts: evaluating a *plan* (iteration 1 + last) and evaluating *text* (single pass). Same agent, different prompt.
- **Improver** is out-of-band — it never runs during story generation. It reads historical feedback and proposes prompt edits for a human to review.
- **PlotterQuestions** only runs on the very first pipeline trigger, never on redo or text phase.
- **Parent annotations** (Scenario 2) only affect Plotter's initial prompt. The critic loop still runs normally after that.
