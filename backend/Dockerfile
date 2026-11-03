# Build from the repo root (docker build -f backend/Dockerfile .): the backend is part of the pnpm workspace there.
FROM node:24-slim AS base
RUN npm install -g pnpm@12.15.0
WORKDIR /app
# pnpm reads the shared lockfile against every package's package.json, so they all come in; only the backend's
# own dependencies (and contracts) get installed.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/
COPY contracts/package.json contracts/
COPY desktop/package.json desktop/
COPY frontend/package.json frontend/
COPY ui/package.json ui/

FROM base AS build
# contracts builds itself when installed (its prepare script), so its source goes in first.
COPY contracts/ contracts/
RUN pnpm install --frozen-lockfile --filter backend...
COPY backend/ backend/
RUN pnpm --filter backend build

FROM base AS runtime
ENV NODE_ENV=production
RUN pnpm install --frozen-lockfile --prod --ignore-scripts --filter backend...
COPY --from=build /app/contracts/dist contracts/dist
COPY --from=build /app/backend/dist backend/dist
COPY backend/drizzle backend/drizzle

WORKDIR /app/backend
USER node
EXPOSE 3000
# The pre-deploy job overrides this with: node dist/database/migrate.js
CMD ["node", "dist/main.js"]
