# Story generation pipeline

An automatic generation is two phases chained together. Creating a story writes a `draft` row and calls `triggerAutoPipeline`, which runs asynchronously (the HTTP caller has already got its response). The **plan phase** (`runPlanPhase` → `runPlotter`) produces a short editorial outline and a title, which are persisted; it then chains straight into the **text phase** (`triggerTextPhase` → `runWriterOnly` → `runWriter`) which writes the full story text. When the text is saved the story moves to `proofreading` and the parent is notified.

> **Important — the auto path runs no critic.** `runPlanPhase` short-circuits: it sets `planFinal = planV1`, `iterations = 1`, and returns an empty critic result. The text phase likewise never calls `runTextCritique`. The plot-critic and writer-critic models and their DB columns exist, but they are only exercised by the **manual** redo/critique endpoints (see doc 4). So the sequence below should not be read as "the critic ran and approved" — no critic ran at all.

## Phases (flowchart)

![Generation phases](img/02a-generation-phases.png)

```mermaid
flowchart TD
  create["Create story<br/>status: draft"]
  trig["triggerAutoPipeline<br/>(fire-and-forget)"]
  plan["Plan phase: runPlanPhase"]
  plotter["runPlotter<br/>assembles prompt blocks + seed"]
  title["generateStoryTitle"]
  persist1["Persist plan<br/>run_snapshots + stories + story_fragments"]
  ttext["triggerTextPhase"]
  writer["runWriterOnly &rarr; runWriter"]
  persist2["Persist text<br/>story_text_versions + stories"]
  proof["status: proofreading<br/>(pipeline state: text_ready)"]
  notify["notifyStoryReady('generated')<br/>&rarr; Telegram"]

  create --> trig --> plan --> plotter --> title --> persist1 --> ttext --> writer --> persist2 --> proof --> notify

  note["NOTE: the auto path runs NO critic.<br/>planFinal = planV1, iterations = 1, empty critic output.<br/>runTextCritique / plot-critic run only on manual redo endpoints."]
  plan -.-> note
```

## One auto generation (sequence)

The API returns `201` the moment the draft is inserted; everything after the fire-and-forget note happens in the background inside a Langfuse trace.

![Generation sequence](img/02b-generation-sequence.png)

```mermaid
sequenceDiagram
  participant U as User
  participant API as Express API
  participant Orq as Orchestrator
  participant Plot as Plotter LLM
  participant Writ as Writer LLM
  participant DB as Neon DB

  U->>API: create story with seed
  API->>DB: insert story (status draft)
  API-->>U: 201 created, returns immediately
  Note over API,Orq: triggerAutoPipeline - fire-and-forget, wrapped in Langfuse trace

  API->>Orq: runPlanPhase(seed)
  Orq->>Plot: runPlotter - structure, setting, lens, bible, reactions, universe, style, sasha, fragments + seed
  Plot-->>Orq: plan text
  Orq->>Plot: generateStoryTitle
  Plot-->>Orq: title
  Orq->>DB: run_snapshots + stories (plan), record used fragments

  Note over Orq,Writ: triggerTextPhase
  Orq->>Writ: runWriterOnly then runWriter - words, fragments, exemplars, idiom and ending rules + plan
  Writ-->>Orq: story text (streamed chunks)
  Orq->>DB: story_text_versions + stories (status proofreading)
  API-->>U: notifyStoryReady('generated') to Telegram
```

## Prompt blocks

Both stages build one big prompt by concatenating optional blocks in a fixed order, then appending the payload (the seed for the plotter, the finished plan for the writer). A block is only included when its data exists — e.g. reaction preferences appear only once enough child reactions have accumulated, exemplars only when the universe has canonical stories. The structure / setting / character-lens blocks are rotated per story to fight cookie-cutter sameness.

![Prompt blocks](img/02c-prompt-blocks.png)

```mermaid
flowchart LR
  subgraph plotterblocks["Plotter prompt (assembled top to bottom)"]
    direction TB
    p1["base + universe system prompt"]
    p2["structure pattern"]
    p3["setting"]
    p4["character lens"]
    p5["character bible"]
    p6["reaction preferences"]
    p7["universe context"]
    p8["style guide"]
    p9["Sasha context"]
    p10["eligible fragments"]
    p11["SEED (real-life situation)"]
    p1 --> p2 --> p3 --> p4 --> p5 --> p6 --> p7 --> p8 --> p9 --> p10 --> p11
  end
  subgraph writerblocks["Writer prompt (assembled top to bottom)"]
    direction TB
    w1["base + universe system prompt"]
    w2["universe context"]
    w3["style guide"]
    w4["Sasha context"]
    w5["canonical exemplars"]
    w6["chosen fragments"]
    w7["target words"]
    w8["ending rule"]
    w9["idiom rule"]
    w10["STORY PLAN"]
    w1 --> w2 --> w3 --> w4 --> w5 --> w6 --> w7 --> w8 --> w9 --> w10
  end
```
