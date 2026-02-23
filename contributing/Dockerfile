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

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@10.8.1 --activate

# Copy only what pnpm needs to resolve dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install production dependencies only — no devDependencies
RUN pnpm install --frozen-lockfile --prod

# ---------------------------------------------------------------------------
# Stage 2: Build TypeScript
# ---------------------------------------------------------------------------
FROM node:22-slim AS build

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.8.1 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY src/ src/

# Install ALL dependencies (including devDependencies for tsc)
RUN pnpm install --frozen-lockfile

# Compile TypeScript → build/
RUN pnpm run build

# ---------------------------------------------------------------------------
# Stage 3: Distroless runtime — nothing but Node.js and our code
# ---------------------------------------------------------------------------
FROM gcr.io/distroless/nodejs22-debian12 AS runtime

WORKDIR /app

# Production node_modules from stage 1
COPY --from=deps /app/node_modules ./node_modules

# Compiled JavaScript from stage 2
COPY --from=build /app/build ./build

# package.json needed for ESM module resolution ("type": "module")
COPY package.json ./

# WebSocket extension port + HTTP transport port
EXPOSE 3333 3000

# Distroless has no shell — CMD is passed directly to the Node.js entrypoint
CMD ["build/index.js"]
