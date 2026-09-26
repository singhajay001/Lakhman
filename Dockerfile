# One image, two commands: the web app and the worker share every dependency, so
# building them twice would only create a chance for them to drift.
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /app

# Every workspace manifest, and nothing else.
#
# This stage exists because the dependency layer used to list each package.json by hand, and
# that list went stale the moment a package was added: five of the fourteen workspaces were
# missing, so `pnpm install --frozen-lockfile` could not resolve the lockfile and the image
# would not build at all. Collecting the manifests instead means adding a package needs no
# change here.
FROM base AS manifests
COPY . .
RUN find . -name node_modules -prune -o -name package.json -print \
    | xargs -I{} install -D {} /manifests/{}

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY --from=manifests /manifests/ ./
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

# Development dependencies are kept: the worker runs its TypeScript through tsx, which is one
# of them. Dropping them would save image size and break the worker.
#
# The render worker additionally needs a Chromium headless shell. Remotion downloads its own on
# first use, which needs egress to its CDN; set REMOTION_BROWSER_EXECUTABLE to a shell baked
# into the image where that egress is not allowed. See docs/deployment/configuration.md.

# Web:     docker run … pnpm --filter @spirithaus/social-studio start
# Worker:  docker run … pnpm --filter @spirithaus/worker start
# Migrate: docker run … pnpm --filter @spirithaus/db migrate
CMD ["pnpm", "--filter", "@spirithaus/social-studio", "start"]
