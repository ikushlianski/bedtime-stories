# Книга Гоши

A personal bedtime story app for one specific child — Gosha. A parent describes a story idea, answers a few clarifying questions, and an AI pipeline writes a unique story tailored to who Gosha is right now.

The app is not a general-purpose story generator. It knows Gosha's age, interests, and emotional history. Each story it writes is shaped by what worked and what fell flat in previous sessions.

## How it works

A parent types a short seed: a setting, a character, a mood, or just a vibe. The pipeline takes it from there:

1. **Plotter-Questions** — asks 5+ clarifying questions with suggested answer options, drawing out what kind of story this should be
2. **Plotter** — generates a detailed story plan based on the seed and answers
3. **Psychologist** — checks the plan for safety and therapeutic value
4. **Plot Critic** — reviews narrative quality; the plan loops up to 3 times until it passes
5. **Writer** — turns the approved plan into story text
6. **Writer's Critic + Psychologist** — a final quality pass on the text
7. **Writer** — revises the text once more based on feedback

The parent reads the story aloud. Afterwards they rate it and leave reactions on specific moments. Over time, an **Improver** agent clusters these patterns and proposes prompt edits — so the next story is a little better.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React + Vite (port 8021) |
| Backend | Express (port 8020) |
| Database | Neon Postgres (cloud) |
| AI pipeline | Anthropic Claude via `@anthropic-ai/claude-agent-sdk` |
| ORM | Drizzle |

## Running locally

### Prerequisites

- Node.js 20+
- A [Neon](https://neon.tech) database (free tier works)
- Claude CLI installed and authenticated (`claude` in PATH)

### Setup

```bash
git clone git@github.com:ikushlianski/bedtime-stories.git
cd bedtime-stories
npm install
```

Copy the env file and fill in your values:

```bash
cp .env.example .env
```

`.env` needs:

```
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
```

Run migrations:

```bash
npm run db:migrate
```

### Start

Open two terminals:

```bash
# Terminal 1 — API
npm run dev:api

# Terminal 2 — Web
npm run dev:web
```

Or both at once (logs go to `/tmp/`):

```bash
npm run dev:debug
```

App is at **http://localhost:8021**, API at **http://localhost:8020**.
