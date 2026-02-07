# Build stage
FROM node:lts-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm --activate

WORKDIR /app

# Copy package files for dependency installation
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install all dependencies with optimizations
RUN pnpm install --frozen-lockfile && \
    pnpm store prune

# Copy source files
COPY tsconfig.json ./
COPY src ./src

# Build, then prune dev dependencies in single layer as we will copy the node_modules for the prod build
RUN pnpm run build && \
    pnpm prune --prod && \
    pnpm store prune

# ---------------------------------------------------------------

# Production stage
FROM node:lts-alpine AS production

# Add non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy production artifacts from builder (only the prod dependencies, build output, and any additional assets such as the Azure stencils)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/build ./build
COPY assets ./assets

USER nodejs

# 8080: HTTP for MCP server
EXPOSE 8080

# Environment variables with defaults (can be overridden at runtime)
ENV HTTP_PORT=8080
ENV TRANSPORT=http
ENV LOGGER_TYPE=console

ENTRYPOINT ["node", "build/index.js"]
CMD ["--transport", "http", "--http-port", "8080"]
