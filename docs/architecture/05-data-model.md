# Data model (core tables)

A **universe** is the `story_groups` table (the code and UI call it a universe; the table name is historical). Everything hangs off it: a universe owns its `stories` and its reusable ingredients — `universe_characters`, `topics`, `fragments`, `words`, plus generated `story_ideas` and pending `universe_suggestions`.

Each **story** accumulates review and learning artifacts: free-form `annotations` (`selected_text` is nullable — a whole-story comment with no highlighted span is a valid row, consumed and cleared the same way a highlighted one is), at most one `parent_reviews` row and one `child_reactions` row (both unique per story), a history of `story_text_versions`, one `run_snapshots` row per pipeline run, and a `story_readings` log. Once a story reaches `ready`/`read`/`archived`, feedback instead lands in `story_comments` — a separate, permanent table (never resolved/consumed, unlike `annotations`) so a later universe-memory sync can read every comment ever left on a finished story without racing the regenerate flows that clear `annotations`. Topics, fragments, and words attach to stories through the join tables `story_topics`, `story_fragments`, and `story_words` (many-to-many). Only the enumerated core tables are shown here — operational tables (model catalog, model calls, plan questions, swap events, etc.) are omitted to keep the relationships readable. `model_calls` carries an optional `character_id` alongside its optional `story_id`, so a portrait-generation call attributes cost to a character the same way a text-generation call attributes it to a story.

![Data model](img/05-data-model.png)

```mermaid
erDiagram
  story_groups ||--o{ stories : "owns"
  story_groups ||--o{ universe_characters : "defines"
  universe_characters ||--o{ character_reference_images : "uploaded baselines"
  universe_characters ||--o{ character_portraits : "generated (1 current + up to 3 previous)"
  story_groups ||--o{ topics : "collects"
  story_groups ||--o{ fragments : "collects"
  story_groups ||--o{ words : "collects"
  story_groups ||--o{ story_ideas : "suggests"
  story_groups ||--o{ universe_suggestions : "pending facts"
  stories ||--o{ annotations : "receives"
  stories ||--o| parent_reviews : "reviewed by"
  stories ||--o| child_reactions : "reacted to by child"
  stories ||--o{ story_text_versions : "versions"
  stories ||--o{ run_snapshots : "pipeline runs"
  stories ||--o{ story_readings : "read log"
  stories ||--o{ story_comments : "comments once finished"
  story_groups ||--o{ story_comments : "attributes to universe"
  stories ||--o{ story_fragments : ""
  fragments ||--o{ story_fragments : ""
  stories ||--o{ story_words : ""
  words ||--o{ story_words : ""
  stories ||--o{ story_topics : ""
  topics ||--o{ story_topics : ""

  story_groups {
    serial id PK
    text name "the universe"
    text system_prompt
    text style_guide
  }
  stories {
    serial id PK
    int group_id FK
    text seed
    text status "draft proofreading ready read"
    text plan_final
    text text_final
    int active_text_version_id
  }
  universe_characters {
    serial id PK
    int universe_id FK
    text name
    text traits
  }
  character_reference_images {
    serial id PK
    int character_id FK
    text storage_path "private — signed URL only"
  }
  character_portraits {
    serial id PK
    int character_id FK
    text storage_path "public-read"
    text tier "own_reference universe_sibling default_style"
    bool is_current
  }
  topics {
    serial id PK
    int universe_id FK
    text title
  }
  fragments {
    serial id PK
    int universe_id FK
    text text
  }
  words {
    serial id PK
    int universe_id FK
    text word
  }
  story_ideas {
    serial id PK
    int universe_id FK
    text seed_text
    text status "pending approved rejected"
  }
  universe_suggestions {
    serial id PK
    int universe_id FK
    text fact_text
    text status "pending approved rejected"
  }
  annotations {
    serial id PK
    int story_id FK
    text selected_text "nullable — null means whole-story comment"
    text note_text
    text context "plan or text"
  }
  story_comments {
    serial id PK
    int story_id FK
    int universe_id FK "nullable, denormalized from story.group_id"
    text comment_text
    text selected_text "nullable"
  }
  parent_reviews {
    serial id PK
    int story_id FK "unique"
    int rating
    bool would_reuse
  }
  child_reactions {
    serial id PK
    int story_id FK "unique"
    int enjoyed
    bool was_funny
  }
  story_text_versions {
    serial id PK
    int story_id FK
    int version_number
    text stage "writer_initial writer_critic annotated_rewrite chat_patch"
  }
  run_snapshots {
    serial id PK
    int story_id FK
    text plan_v1
    text text_v1
  }
  story_readings {
    serial id PK
    int story_id FK
    timestamp read_at
  }
  story_fragments {
    serial id PK
    int story_id FK
    int fragment_id FK
  }
  story_words {
    serial id PK
    int story_id FK
    int word_id FK
  }
  story_topics {
    serial id PK
    int story_id FK
    int topic_id FK
  }
```
