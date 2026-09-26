# One image, two commands: the web app and the worker share every dependency, so
# building them twice would only create a chance for them to drift.
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
# `corepack enable` installs shims; the package manager itself is downloaded on first use. That
# is fine during a build and wrong at runtime: the container would reach for the npm registry
# every time it started, and could not start at all on a host without that egress. Found by
# running the image — it exited with a corepack fetch failure before serving anything.
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
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

# The default command runs the server directly rather than through pnpm. Starting a production
# process should not depend on a package manager resolving a workspace filter, and node is the
# thing that actually has to work.
WORKDIR /app/apps/social-studio
CMD ["node", "node_modules/@react-router/serve/bin.js", "./build/server/index.js"]

# Worker:  docker run … --workdir /app pnpm --filter @spirithaus/worker start
# Migrate: docker run … --workdir /app pnpm --filter @spirithaus/db migrate
