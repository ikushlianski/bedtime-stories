# Observability Plan

## Stack reality check

| Layer | Technology | Note |
|---|---|---|
| Backend | Express.js (`packages/api`) | Not Next.js — use `@sentry/node`, not `@sentry/nextjs` |
| Frontend | React + Vite (`packages/web`) | Use `@sentry/react` + `@sentry/vite-plugin` |
| LLM calls | `@anthropic-ai/claude-agent-sdk` via `query()` | NOT `@anthropic-ai/sdk` — Sentry's `anthropicAIIntegration` won't work here |
| No BAML | — | Project uses Claude Agent SDK directly, no BAML DSL |

Because the project calls Claude through `@anthropic-ai/claude-agent-sdk`'s `query()` (which runs Claude Code as an agent process), Sentry's built-in `anthropicAIIntegration` does **not** cover LLM calls. Manual instrumentation via Langfuse is required.

---

## Tools

| Tool | Purpose | Cost |
|---|---|---|
| **Sentry** | App errors, crashes, slow routes, frontend errors | Free: 5K errors/month |
| **Langfuse** | LLM traces: per-stage latency, token counts, retries, failures | Free: 50K observations/month |

---

## What you need to do first (user-side)

### Sentry
1. Go to sentry.io → New Project → Node.js
2. Copy the DSN
3. Go to Settings → Auth Tokens → create token with `project:releases` + `org:read` scopes
4. Note your org slug and project slug

### Langfuse
1. Go to cloud.langfuse.com → New Project
2. Copy the Secret Key and Public Key

### Add to `.env`
```
SENTRY_DSN=https://...@o0.ingest.sentry.io/...
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=your-project-slug
SENTRY_AUTH_TOKEN=sntrys_...
VITE_SENTRY_DSN=https://...@o0.ingest.sentry.io/...

LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

Note: `SENTRY_DSN` and `VITE_SENTRY_DSN` can point to the same Sentry project or separate ones.

---

## Implementation phases

### Phase 1 — Backend Sentry (`@sentry/node` in Express)

**Install:**
```bash
npm install @sentry/node --save -w @bedtime/api
```

**Create `packages/api/src/instrument.ts`** — must be imported before anything else:
```typescript
import * as Sentry from '@sentry/node'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  sendDefaultPii: true,
  includeLocalVariables: true,
  enableLogs: true,
})
```

**Update `packages/api/src/index.ts`** — import instrument as the very first line:
```typescript
import './instrument'
// ... rest of existing imports
```

**Update `packages/api/src/server.ts`** — add Sentry middleware:
```typescript
import * as Sentry from '@sentry/node'

// After app = express() and before routes:
app.use(Sentry.expressRequestHandler())

// After all routes (must be last):
app.use(Sentry.expressErrorHandler())
```

### Phase 2 — Frontend Sentry (`@sentry/react` in Vite)

**Install:**
```bash
npm install @sentry/react --save -w @bedtime/web
npm install @sentry/vite-plugin --save-dev -w @bedtime/web
```

**Create `packages/web/src/instrument.ts`:**
```typescript
import * as Sentry from '@sentry/react'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  enableLogs: true,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
  ],
  tracePropagationTargets: ['localhost', /^https:\/\/your-api-domain/],
})
```

**Update `packages/web/src/main.tsx`** — import instrument first:
```typescript
import './instrument'
// ... existing imports
```

**Update `packages/web/vite.config.ts`** — add source maps plugin (last plugin):
```typescript
import { sentryVitePlugin } from '@sentry/vite-plugin'

export default defineConfig({
  build: { sourcemap: 'hidden' },
  plugins: [
    // ... existing plugins
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
})
```

### Phase 3 — LLM Tracing (Langfuse in `packages/core`)

**Install:**
```bash
npm install langfuse --save -w @bedtime/core
```

**Create `packages/core/src/ai/langfuse-client.ts`:**
```typescript
import { Langfuse } from 'langfuse'

export const langfuse = new Langfuse({
  secretKey: process.env.LANGFUSE_SECRET_KEY!,
  publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
  baseUrl: process.env.LANGFUSE_BASE_URL ?? 'https://cloud.langfuse.com',
  flushAt: 15,
  flushInterval: 10_000,
})
```

**Update `packages/core/src/ai/claude-cli.runner.ts`** — wrap `runText()` and `runStructured()`:

In `runText()`, create a Langfuse trace + generation span:
```typescript
const trace = langfuse.trace({ name: label, metadata: { model, promptLen: prompt.length } })
const generation = trace.generation({ name: label, model, input: prompt })

// on success:
generation.end({ output: resultText, usage: { /* token estimates if available */ } })
trace.update({ output: resultText })

// on final failure:
generation.end({ level: 'ERROR', statusMessage: String(err) })
```

In `runStructured()`, use the skill name as trace name and include the structured output.

---

## Environment variable additions to `.env.example`

```
SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=
VITE_SENTRY_DSN=

LANGFUSE_SECRET_KEY=
LANGFUSE_PUBLIC_KEY=
LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

---

## Verification

**Sentry backend:** Add `throw new Error('sentry-test')` to any Express route, call it, check Issues in Sentry.

**Sentry frontend:** Add `throw new Error('sentry-test')` in any component, load the page, check Issues.

**Langfuse:** Run any story generation pipeline stage, open cloud.langfuse.com → Traces — you should see the `runText`/`runStructured` spans with model, duration, and prompt/output.
