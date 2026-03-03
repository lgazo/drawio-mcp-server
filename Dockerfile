# =============================================================================
# Draw.io MCP Server — Distroless Container
# =============================================================================
# Multi-stage build:
#   1. deps    — install production dependencies only
#   2. build   — compile TypeScript
#   3. runtime — Google distroless (no shell, no package manager, minimal CVEs)
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Install production dependencies
# ---------------------------------------------------------------------------
FROM node:22-slim AS deps

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.8.1 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/drawio-mcp-plugin ./packages/drawio-mcp-plugin
COPY packages/drawio-mcp-server ./packages/drawio-mcp-server

RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# Stage 2: Build TypeScript
# ---------------------------------------------------------------------------
FROM node:22-slim AS build

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.8.1 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY packages/drawio-mcp-plugin ./packages/drawio-mcp-plugin
COPY packages/drawio-mcp-server ./packages/drawio-mcp-server

RUN pnpm install --frozen-lockfile

RUN pnpm --filter drawio-mcp-server run build

# ---------------------------------------------------------------------------
# Stage 3: Runtime — install production deps and run
# ---------------------------------------------------------------------------
FROM node:22-slim AS runtime

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.8.1 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/drawio-mcp-plugin ./packages/drawio-mcp-plugin
COPY packages/drawio-mcp-server ./packages/drawio-mcp-server

RUN pnpm install --frozen-lockfile --prod

COPY --from=build /app/packages/drawio-mcp-server/build ./packages/drawio-mcp-server/build

EXPOSE 3333 3000

CMD ["node", "packages/drawio-mcp-server/build/index.js", "--editor"]
