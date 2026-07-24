import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@bedtime/shared': path.resolve(__dirname, 'packages/shared/src'),
      '@bedtime/core': path.resolve(__dirname, 'packages/core/src'),
    },
  },
  test: {
    environmentMatchGlobs: [['packages/web/**', 'jsdom']],
  },
})
