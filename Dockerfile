# ──────────────────────────────────────────────────────────────
# Stage 1 — Compile a fully self-contained native binary
# ──────────────────────────────────────────────────────────────
FROM denoland/deno:latest AS builder

WORKDIR /app

# Copy dependency manifest first for layer caching.
# Deno downloads and caches deps on first use.
COPY deno.json ./

# Copy source, instructions, and asset files needed at compile time.
COPY src/ ./src/
COPY assets/ ./assets/

# Cache dependencies, then compile to a single native binary.
# --include flags embed the instructions markdown and Azure icon XML
# into the binary so no external files are needed at runtime.
RUN deno cache src/index.ts && \
    deno compile \
      --allow-net --allow-read --allow-env \
      --include=src/instructions.md \
      --include=assets/ \
      --output=drawio-mcp-server \
      src/index.ts

# ──────────────────────────────────────────────────────────────
# Stage 2 — Minimal, secure production image
# ──────────────────────────────────────────────────────────────
# distroless/cc provides only the C runtime (glibc, libgcc, libstdc++)
# required by the Deno-compiled binary. It has:
#   • No shell, no package manager, no coreutils
#   • Non-root user (uid 65532 "nonroot") baked in
#   • ~20 MB base layer
FROM gcr.io/distroless/cc-debian12:nonroot

WORKDIR /app

# Copy only the compiled binary — no source, no node_modules,
# no Deno runtime. The binary is fully self-contained.
COPY --from=builder --chown=nonroot:nonroot /app/drawio-mcp-server ./drawio-mcp-server

# 8080: HTTP for Streamable HTTP MCP transport
EXPOSE 8080

# Environment variables with defaults (can be overridden at runtime).
ENV HTTP_PORT=8080
ENV TRANSPORT=http
ENV LOGGER_TYPE=console

# distroless images default to the "nonroot" user (uid 65532).
# Explicit USER directive for clarity and auditability.
USER nonroot

ENTRYPOINT ["/app/drawio-mcp-server"]
CMD ["--transport", "http", "--http-port", "8080"]
