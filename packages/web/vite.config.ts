import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { sentryVitePlugin } from "@sentry/vite-plugin";

export default defineConfig({
  plugins: [
    react(),
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
  build: {
    sourcemap: "hidden",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@bedtime/shared": path.resolve(__dirname, "../shared/src"),
      "@bedtime/core": path.resolve(__dirname, "../core/src"),
    },
  },
  server: {
    port: 8021,
    strictPort: true,
    host: true,
  },
});
