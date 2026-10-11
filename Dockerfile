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
FROM node:26.7.0-slim AS deps

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.8.1 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages

RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# Stage 2: Build TypeScript
# ---------------------------------------------------------------------------
FROM node:26.7.0-slim AS build

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.8.1 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY packages ./packages

RUN pnpm install --frozen-lockfile

# Build order matters: the server's `vendor:compat` step copies
# ../drawio-mcp-compat/src, its build copies the bundled plugin from
# node_modules/drawio-mcp-plugin/dist, and tsc type-checks
# src/real-environment/, which imports drawio-mcp-dev-proxy.
RUN pnpm --filter drawio-mcp-compat run build \
 && pnpm --filter drawio-mcp-dev-proxy run build \
 && pnpm --filter drawio-mcp-plugin run build \
 && pnpm --filter drawio-mcp-server run build

# ---------------------------------------------------------------------------
# Stage 3: Runtime — install production deps and run
# ---------------------------------------------------------------------------
FROM node:26.7.0-slim AS runtime

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.8.1 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Runtime needs only these packages: compat is vendored into the server
# build and the plugin bundle is baked into build/plugin/. dev-proxy and
# extension have postinstall hooks (caddy download, `wxt prepare`) that
# fail or add bloat under --prod.
COPY packages/drawio-mcp-compat ./packages/drawio-mcp-compat
COPY packages/drawio-mcp-plugin ./packages/drawio-mcp-plugin
COPY packages/drawio-mcp-server ./packages/drawio-mcp-server

RUN pnpm install --frozen-lockfile --prod

COPY --from=build /app/packages/drawio-mcp-server/build ./packages/drawio-mcp-server/build

EXPOSE 3333 3000

# TLS material (auto-generated when --tls --tls-auto is set).
# Mount a host volume here to persist the local CA across container recreations:
#   docker run -v drawio-mcp-tls:/data/drawio-mcp-server/tls drawio-mcp-server ...
ENV XDG_DATA_HOME=/data
VOLUME ["/data/drawio-mcp-server/tls"]

CMD ["node", "packages/drawio-mcp-server/build/index.js", "--editor"]
