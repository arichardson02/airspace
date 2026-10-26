# Build from the repo root (docker build -f backend/Dockerfile .) so contracts/ is in the context.
FROM node:24-slim AS base
RUN npm install -g pnpm@12.15.0
WORKDIR /app

FROM base AS build
COPY contracts/package.json contracts/pnpm-lock.yaml contracts/
RUN cd contracts && pnpm install --frozen-lockfile --ignore-scripts
COPY contracts/ contracts/
RUN cd contracts && pnpm build

COPY backend/package.json backend/pnpm-lock.yaml backend/pnpm-workspace.yaml backend/
RUN cd backend && pnpm install --frozen-lockfile
COPY backend/ backend/
RUN cd backend && pnpm build

FROM base AS runtime
ENV NODE_ENV=production

COPY contracts/package.json contracts/pnpm-lock.yaml contracts/
RUN cd contracts && pnpm install --frozen-lockfile --prod --ignore-scripts
COPY --from=build /app/contracts/dist contracts/dist

COPY backend/package.json backend/pnpm-lock.yaml backend/pnpm-workspace.yaml backend/
RUN cd backend && pnpm install --frozen-lockfile --prod
COPY --from=build /app/backend/dist backend/dist
COPY backend/drizzle backend/drizzle

WORKDIR /app/backend
USER node
EXPOSE 3000
# The pre-deploy job overrides this with: node dist/database/migrate.js
CMD ["node", "dist/main.js"]
