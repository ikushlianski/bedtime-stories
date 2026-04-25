import { Langfuse } from 'langfuse'

export const langfuse = new Langfuse({
  secretKey: process.env['LANGFUSE_SECRET_KEY'] ?? '',
  publicKey: process.env['LANGFUSE_PUBLIC_KEY'] ?? '',
  baseUrl: process.env['LANGFUSE_BASE_URL'] ?? 'https://cloud.langfuse.com',
  flushAt: 15,
  flushInterval: 10_000,
  enabled: process.env['NODE_ENV'] !== 'test',
})
