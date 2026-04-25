export interface SentryBrowserBaseConfig {
  dsn: string
  environment: string
  sendDefaultPii: false
  enableLogs: true
  tracesSampleRate: number
  replaysSessionSampleRate: number
  replaysOnErrorSampleRate: number
  tracePropagationTargets: (string | RegExp)[]
}

export function getSentryBrowserConfig(opts: {
  dsn: string
  environment: string
}): SentryBrowserBaseConfig {
  return {
    dsn: opts.dsn,
    environment: opts.environment,
    sendDefaultPii: false,
    enableLogs: true,
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    tracePropagationTargets: ['localhost:8020', /^https:\/\/your-production-api/],
  }
}
