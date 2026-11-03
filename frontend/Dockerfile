# Build from the repo root (docker build -f frontend/Dockerfile .): the frontend is part of the pnpm workspace there.
FROM node:24-slim AS base
RUN npm install -g pnpm@12.15.0
WORKDIR /app

FROM base AS build
# pnpm reads the shared lockfile against every package's package.json, so they all come in; only the frontend's
# own dependencies (and ui) get installed.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/
COPY contracts/package.json contracts/
COPY desktop/package.json desktop/
COPY frontend/package.json frontend/
COPY ui/package.json ui/
RUN pnpm install --frozen-lockfile --filter frontend...
COPY ui/ ui/
COPY frontend/ frontend/
RUN pnpm --filter frontend build

FROM node:24-slim AS runtime
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
WORKDIR /app

# Next traces files from the workspace root, so the standalone server sits in frontend/.
COPY --from=build /app/frontend/.next/standalone ./
COPY --from=build /app/frontend/.next/static ./frontend/.next/static
COPY --from=build /app/frontend/public ./frontend/public

USER node
EXPOSE 3000
CMD ["node", "frontend/server.js"]
