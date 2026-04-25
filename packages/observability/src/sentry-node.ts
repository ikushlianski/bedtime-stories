import * as Sentry from '@sentry/node'
import type { Breadcrumb } from '@sentry/node'

export function initSentryNode() {
  if (process.env['NODE_ENV'] === 'test') return

  Sentry.init({
    dsn: process.env['SENTRY_DSN'] ?? '',
    environment: process.env['NODE_ENV'] ?? 'development',
    sendDefaultPii: false,
    enableLogs: true,
    includeLocalVariables: true,
    beforeSend(event) {
      if (event.breadcrumbs) {
        const filtered = [...(event.breadcrumbs as Breadcrumb[])].filter(
          (b: Breadcrumb) => !b.message?.includes('[ai:prompt]'),
        )

        return { ...event, breadcrumbs: filtered }
      }

      return event
    },
    tracesSampler(ctx) {
      const isPipeline =
        ctx.name?.includes('pipeline') || Boolean(ctx.attributes?.['gen_ai.system'])

      if (isPipeline) return 1.0

      return process.env['NODE_ENV'] === 'production' ? 0.1 : 1.0
    },
  })
}

export { Sentry }
