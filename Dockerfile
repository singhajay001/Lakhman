# One image, two commands: the web app and the worker share every dependency, so
# building them twice would only create a chance for them to drift.
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/db/package.json packages/db/
COPY packages/domain/package.json packages/domain/
COPY packages/providers/package.json packages/providers/
COPY packages/jobs/package.json packages/jobs/
COPY packages/observability/package.json packages/observability/
COPY packages/shopify/package.json packages/shopify/
COPY packages/testing/package.json packages/testing/
COPY apps/social-studio/package.json apps/social-studio/
COPY apps/worker/package.json apps/worker/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# Generating the client before the build, because the app bundle imports its types.
RUN pnpm --filter @spirithaus/db generate
RUN pnpm --filter @spirithaus/social-studio build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3000

# Web:    docker run … pnpm --filter @spirithaus/social-studio start
# Worker: docker run … pnpm --filter @spirithaus/worker start
# Migrate: docker run … pnpm --filter @spirithaus/db migrate
CMD ["pnpm", "--filter", "@spirithaus/social-studio", "start"]
