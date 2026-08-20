# Architecture diagrams

Visual documentation of the bedtime-agent system. Each doc has a plain-language explanation above a Mermaid diagram, and every diagram is also committed as a rendered PNG (in `img/`) and a standalone `.mmd` source (in `diagrams/`).

| Doc | What it shows |
| --- | --- |
| [01-system-overview.md](01-system-overview.md) | The big picture: React SPA + Telegram bot → single Cloud Run Express service → Neon DB + OpenRouter, with Langfuse/Sentry observability. |
| [02-story-generation.md](02-story-generation.md) | The generation pipeline end to end — phase flowchart, a one-generation sequence diagram, and the prompt blocks the plotter and writer assemble. |
| [03-telegram-flow.md](03-telegram-flow.md) | How the Telegram bot handles commands (`/new`, `/stories`, `/topic`, `/fragment`), plain text, and the story-ready notification. |
| [04-feedback-and-review.md](04-feedback-and-review.md) | The proofreading/annotation/approve review loop and the two learning loops (reaction personalization + the legacy-only analyze loop). |
| [05-data-model.md](05-data-model.md) | ER diagram of the core tables and their relationships. |
| [06-character-portraits.md](06-character-portraits.md) | Character reference images and AI-generated portraits — the 3-tier style-matching fallback, the private-reference/public-portrait storage split, cost tracking, and the current/previous retention rotation. |
| [story-retrieval.md](story-retrieval.md) | Vector search + tool-calling: how stories get embedded (approval-time trigger + one-off backfill) and how the plotter calls `search_past_stories` on its own initiative during a generation. |

## Rendering

PNGs in `img/` were rendered with the Mermaid CLI:

```bash
npx -y @mermaid-js/mermaid-cli -i diagrams/<name>.mmd -o img/<name>.png
```

To re-render everything after editing a `.mmd`:

```bash
cd docs/architecture
for f in diagrams/*.mmd; do
  npx -y @mermaid-js/mermaid-cli -i "$f" -o "img/$(basename "$f" .mmd).png"
done
```

If `mmdc` (which needs a headless Chromium) is unavailable, the diagrams can also be rendered via the [Kroki](https://kroki.io) API by POSTing the `.mmd` source. The Markdown files also embed the Mermaid source directly, so they render inline on GitHub without any PNGs.

## Notes on accuracy

These diagrams were verified against the code, not just the original brief. Three things differ from a naive reading:

- **The automatic generation path runs no critic.** The plan and text phases short-circuit (`planFinal = planV1`, empty critic output). The plot-critic / writer-critic code and DB columns exist but are only used by the manual redo/critique endpoints.
- **The style-guide + universe-fact learning loop is gated to legacy stories** — the analyze endpoint returns 422 for normal generated stories.
- **Child reactions personalize the plotter, not the style guide.** The style guide is updated from story analysis plus parent reviews and annotations; child reactions flow separately through `loadReactionPreferences` into the plotter's reaction block.
