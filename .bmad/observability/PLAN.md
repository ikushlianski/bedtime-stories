# Observability Plan (updated)

## Stack

| Layer | Technology |
|---|---|
| Backend | Express.js (`packages/api`, port 8020) |
| Frontend | React + Vite (`packages/web`, port 8021) |
| LLM calls | OpenRouter via OpenAI-compatible API |
| New package | `packages/observability` — shared clients, helpers, context |

Sentry's `openAIIntegration` auto-instruments OpenAI-compatible API calls — no manual span wrapping needed.

---

## packages/observability

New npm workspace package. Contains:
- Sentry Node client (for backend)
- Sentry browser client (for frontend — re-exported config)
- Langfuse client (for LLM tracing)
- `withPipelineTrace()` — parent span wrapper for the story pipeline stages
- `addStoryContext()` — attaches story_id, pipeline_stage, child_profile_id to Sentry scope
- PII filter (`beforeSend`) — strips child profile data from Sentry events
- Sampling config — 100% for LLM/pipeline traces, 10% for HTTP in production

`package.json` name: `@bedtime/observability`

---

## Key decisions baked in

### Sampling
Use `tracesSampler` (not `tracesSampleRate`) to keep LLM/pipeline traces at 100% and sample general HTTP at 10% in production. Dev stays at 100%.

### PII / children's data
`sendDefaultPii: false`. Prompts contain child profile data and parent annotations — do NOT send to Sentry. Langfuse `recordInputs`/`recordOutputs` only enabled in dev.

### Environment guard
Gate Sentry and Langfuse on `NODE_ENV !== 'test'`. In dev, use separate Sentry project or same DSN with `environment: 'development'` filter. Never send dev noise to prod.

### Distributed tracing
`tracePropagationTargets: ['localhost:8020', /^https:\/\/your-production-api/]` in the frontend init. This connects browser → API spans into one trace.

---

## Implementation phases

### Phase A — Build `packages/observability` (do first, sequential)

**Package setup:**
- `packages/observability/package.json` with `@bedtime/observability` name, peer deps on `@sentry/node`, `langfuse`
- `packages/observability/src/index.ts` — barrel export
- Add `packages/observability` to root `package.json` workspaces

**Files:**

`src/sentry-node.ts` — backend Sentry init:
```typescript
import * as Sentry from '@sentry/node'

export function initSentryNode() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    sendDefaultPii: false,
    enableLogs: true,
    includeLocalVariables: true,
    beforeSend(event) {
      // strip any prompt/completion data that leaked into breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs.values = event.breadcrumbs.values?.filter(
          (b) => !b.message?.includes('[ai:prompt]')
        )
      }
      return event
    },
    tracesSampler(ctx) {
      if (ctx.name?.includes('pipeline') || ctx.attributes?.['gen_ai.system']) return 1.0
      return process.env.NODE_ENV === 'production' ? 0.1 : 1.0
    },
  })
}

export { Sentry }
export { addStoryContext } from './context'
```

`src/sentry-browser.ts` — frontend Sentry config (values, not init — init happens in web package):
```typescript
export const sentryBrowserConfig = {
  dsn: '', // injected via import.meta.env.VITE_SENTRY_DSN at build time
  environment: '',
  sendDefaultPii: false,
  enableLogs: true,
  tracesSampler(ctx: { name: string }) {
    return 1.0 // all client errors captured
  },
  tracePropagationTargets: ['localhost:8020', /^https:\/\/your-production-api/],
}
```

`src/langfuse-client.ts`:
```typescript
import { Langfuse } from 'langfuse'

export const langfuse = new Langfuse({
  secretKey: process.env.LANGFUSE_SECRET_KEY!,
  publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
  baseUrl: process.env.LANGFUSE_BASE_URL ?? 'https://cloud.langfuse.com',
  flushAt: 15,
  flushInterval: 10_000,
  enabled: process.env.NODE_ENV !== 'test',
})
```

`src/pipeline-trace.ts` — parent span for the full pipeline run:
```typescript
import * as Sentry from '@sentry/node'
import { langfuse } from './langfuse-client'

export async function withPipelineTrace<T>(
  storyId: string,
  fn: (trace: ReturnType<typeof langfuse.trace>) => Promise<T>
): Promise<T> {
  const trace = langfuse.trace({
    name: 'story-pipeline',
    metadata: { storyId },
  })

  return Sentry.startSpan({ name: 'story-pipeline', op: 'ai.pipeline', attributes: { story_id: storyId } }, () =>
    fn(trace).finally(() => langfuse.flushAsync())
  )
}
```

`src/context.ts` — Sentry context helpers:
```typescript
import * as Sentry from '@sentry/node'

export function addStoryContext(ctx: { storyId?: string; stage?: string; childProfileId?: string }) {
  Sentry.setTags({
    ...(ctx.storyId && { story_id: ctx.storyId }),
    ...(ctx.stage && { pipeline_stage: ctx.stage }),
    ...(ctx.childProfileId && { child_profile_id: ctx.childProfileId }),
  })
}
```

---

### Phase B — Wire into packages (parallelizable after Phase A)

**packages/api:**
- Install `@sentry/node`
- Import `initSentryNode` from `@bedtime/observability` as first line of `src/index.ts`
- Add `Sentry.expressRequestHandler()` before routes, `Sentry.expressErrorHandler()` after routes in `server.ts`
- Add `openAIIntegration` to Sentry init for OpenRouter calls

**packages/web:**
- Install `@sentry/react`, `@sentry/vite-plugin`
- Create `src/instrument.ts` importing `sentryBrowserConfig` from `@bedtime/observability`
- Import as first line in `src/main.tsx`
- Update `vite.config.ts`: `build.sourcemap: 'hidden'` + `sentryVitePlugin` last

**packages/core (pipeline):**
- Wrap `orchestrator.ts` pipeline runner with `withPipelineTrace()`
- Call `addStoryContext({ stage })` at each pipeline stage entry point

---

## Env vars needed in .env

```
SENTRY_DSN=
SENTRY_ORG=ilya-org-jo
SENTRY_PROJECT=          # short slug, not numeric ID — find at sentry.io/settings/ilya-org-jo/projects/
SENTRY_AUTH_TOKEN=
VITE_SENTRY_DSN=         # same DSN or separate browser project

LANGFUSE_SECRET_KEY=
LANGFUSE_PUBLIC_KEY=
LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

---

## Alert rules (Sentry)

Configure in Sentry UI after setup:
- Alert on: New issues only + Regressions
- Notification: Webhook → Telegram bot
- Do NOT alert on every occurrence

---

## Verification

1. Backend: throw test error in Express route → appears in Sentry within 30s
2. Frontend: throw test error in React component → appears in Sentry
3. Pipeline: run one story generation → open Langfuse Traces, see parent `story-pipeline` span with nested stage spans
4. Context: error in pipeline → Sentry issue has `story_id` and `pipeline_stage` tags
