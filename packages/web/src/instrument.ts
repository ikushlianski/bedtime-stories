import * as Sentry from '@sentry/react'
import { getSentryBrowserConfig } from '@bedtime/observability'

Sentry.init({
  ...getSentryBrowserConfig({
    dsn: import.meta.env.VITE_SENTRY_DSN as string,
    environment: import.meta.env.MODE as string,
  }),
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
  ],
})
