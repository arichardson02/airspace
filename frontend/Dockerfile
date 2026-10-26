# Build from the repo root (docker build -f frontend/Dockerfile .), matching the backend,
# so contracts/ can be added here once the frontend calls the API.
FROM node:24-slim AS base
RUN npm install -g pnpm@12.15.0
WORKDIR /app/frontend

FROM base AS build
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
RUN pnpm build

FROM node:24-slim AS runtime
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
WORKDIR /app

COPY --from=build /app/frontend/.next/standalone ./
COPY --from=build /app/frontend/.next/static ./.next/static
COPY --from=build /app/frontend/public ./public

USER node
EXPOSE 3000
CMD ["node", "server.js"]
