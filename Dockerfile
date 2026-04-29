FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
COPY packages/api/package.json ./packages/api/
COPY packages/core/package.json ./packages/core/
COPY packages/shared/package.json ./packages/shared/
COPY packages/observability/package.json ./packages/observability/
COPY packages/web/package.json ./packages/web/
RUN npm ci

FROM base AS development
COPY . .
ENV PORT=8020 HOST=0.0.0.0 NODE_ENV=development
EXPOSE 8020
CMD ["npx", "tsx", "watch", "packages/api/src/index.ts"]

FROM base AS web-dev
COPY . .
ENV PORT=8021
EXPOSE 8021
CMD ["npm", "run", "dev:web"]

FROM base AS builder
COPY . .
ARG VITE_SENTRY_DSN
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ARG SENTRY_AUTH_TOKEN
ARG VITE_API_URL=""
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN \
    SENTRY_ORG=$SENTRY_ORG \
    SENTRY_PROJECT=$SENTRY_PROJECT \
    SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN \
    VITE_API_URL=$VITE_API_URL
RUN npm run build:web

FROM base AS production
COPY --from=builder /app/packages/web/dist ./packages/web/dist
COPY packages ./packages
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080
EXPOSE 8080
CMD ["npx", "tsx", "packages/api/src/index.ts"]
