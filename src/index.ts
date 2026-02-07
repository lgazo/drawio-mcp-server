#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import type { ServerType } from "@hono/node-server";
import { buildConfig, shouldShowHelp, parseLoggerType, VERSION, type ServerConfig } from "./config.js";
import {
  create_logger as create_console_logger } from "./loggers/mcp_console_logger.js";
import {
  create_logger as create_server_logger,
  validLogLevels,
} from "./loggers/mcp_server_logger.js";
import { createHandlers } from "./tools.js";
import { createToolHandlerFactory } from "./tool_handler.js";
import { initializeShapes, resetAzureIconLibrary } from "./shapes/azure_icon_library.js";
import { diagram } from "./diagram_model.js";
import { registerTools } from "./tool_registrations.js";
import { readRelativeFile } from "./utils.js";

/**
 * Display help message and exit
 */
function showHelp(): never {
  console.log(`
Draw.io MCP Server (${VERSION})

Usage: drawio-mcp-server [options]

Options:
  --http-port <number>     HTTP server port for MCP clients (default: 8080)
  --transport <type>       Transport type: stdio, http, or stdio,http (default: stdio)
  --help, -h              Show this help message

Environment variables:
  HTTP_PORT                Same as --http-port (CLI takes precedence)
  TRANSPORT                Same as --transport (CLI takes precedence)
  LOGGER_TYPE              Logger type: console or mcp_server (default: console)
  AZURE_ICON_LIBRARY_PATH  Path to Azure icon library XML file (auto-detected if unset)

Examples:
  drawio-mcp-server                           # Use stdio transport
  drawio-mcp-server --transport http          # Use HTTP transport on port 8080
  drawio-mcp-server --http-port 4000          # Use HTTP on port 4000
  drawio-mcp-server --transport stdio,http    # Use both transports
  `);
  process.exit(0);
}

// Resolve logger type early so server capabilities are set correctly.
// Validation is centralized in config.ts via parseLoggerType.
const loggerTypeResult = parseLoggerType(process.env.LOGGER_TYPE);
const loggerType = loggerTypeResult instanceof Error ? "console" : loggerTypeResult;

let capabilities: any = {
  resources: {},
  tools: {},
};
if (loggerType === "mcp_server") {
  capabilities = {
    ...capabilities,
    logging: {
      setLevels: true,
      levels: validLogLevels,
    },
  };
}

// ─── Server Instructions ───────────────────────────────────────
// Loaded from src/instructions.md and sent to MCP clients during
// initialization so the calling model follows diagram-generation
// conventions without extra round trips.
const SERVER_INSTRUCTIONS = readRelativeFile(import.meta.url, "instructions.md");

// Create server instance
const server = new McpServer(
  {
    name: "drawio-mcp-server",
    version: VERSION,
  },
  {
    capabilities,
    instructions: SERVER_INSTRUCTIONS,
  },
);

const log =
  loggerType === "mcp_server"
    ? create_server_logger(server)
    : create_console_logger();

/**
 * Create tool handler factory that logs session/request metadata and delegates to handlers.
 */
const handlers = createHandlers(log);
const createToolHandler = createToolHandlerFactory(handlers, log);

// Register all MCP tools (schemas + descriptions)
registerTools(server, createToolHandler);

// ─── Shutdown Infrastructure ───────────────────────────────────

/** HTTP server reference, captured for graceful shutdown */
let httpServer: ServerType | undefined;

/** Guard against double-shutdown (signal re-delivery, etc.) */
let isShuttingDown = false;

/**
 * Gracefully shut down all resources.
 * Idempotent — safe to call more than once.
 */
async function shutdown(reason: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  log.debug(`Shutting down (reason: ${reason})`);

  // 1. Stop accepting new HTTP connections
  if (httpServer) {
    await new Promise<void>((resolve) => {
      httpServer!.close(() => resolve());
      // Force-close after 5 s so we don't hang indefinitely
      setTimeout(resolve, 5_000).unref();
    });
    httpServer = undefined;
    log.debug("HTTP server closed");
  }

  // 2. Close the MCP server (flushes pending messages, disconnects transport)
  try {
    await server.close();
    log.debug("MCP server closed");
  } catch {
    // best-effort — transport may already be gone
  }

  // 3. Release cached resources so memory is freed immediately
  diagram.clear();
  resetAzureIconLibrary();

  log.debug("Shutdown complete");
}

// ─── Signal & Process Error Handlers ───────────────────────────

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
  process.on(signal, () => {
    shutdown(signal).finally(() => process.exit(0));
  });
}

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  shutdown("uncaughtException").finally(() => process.exit(1));
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
  shutdown("unhandledRejection").finally(() => process.exit(1));
});

// ─── Transport Startup ────────────────────────────────────────

async function start_stdio_transport() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.debug(`Draw.io MCP Server STDIO transport active`);
}

async function start_streamable_http_transport(http_port: number) {
  // Create a stateless transport (no options = no session management)
  const transport = new WebStandardStreamableHTTPServerTransport();

  // Create the Hono app
  const app = new Hono();

  // Enable CORS for all origins
  app.use(
    "*",
    cors({
      origin: "*",
      allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowHeaders: [
        "Content-Type",
        "mcp-session-id",
        "Last-Event-ID",
        "mcp-protocol-version",
      ],
      exposeHeaders: ["mcp-session-id", "mcp-protocol-version"],
    }),
  );

  app.get("/health", (c) =>
    c.json({ status: server.isConnected() ? "ok" : "mcp not ready" }),
  );

  app.all("/mcp", (c) => transport.handleRequest(c.req.raw));

  await server.connect(transport);

  httpServer = serve({
    fetch: app.fetch,
    port: http_port,
  });
  log.debug(`Draw.io MCP Server Streamable HTTP transport active`);
  log.debug(`Health check: http://localhost:${http_port}/health`);
  log.debug(`MCP endpoint: http://localhost:${http_port}/mcp`);
}

async function main() {
  // Check if help was requested (before parsing config)
  if (shouldShowHelp(process.argv.slice(2))) {
    showHelp();
    // never returns
  }

  // Build configuration from command line args
  const configResult = buildConfig();

  // Handle errors from configuration parsing
  if (configResult instanceof Error) {
    console.error(`Error: ${configResult.message}`);
    process.exit(1);
  }

  const config: ServerConfig = configResult;

  log.debug(`Draw.io MCP Server v${VERSION} starting`);
  log.debug(`Transports: ${config.transports.join(", ")}`);

  // Eagerly load all shapes at startup so they are ready for the first tool call.
  // initializeShapes also verifies the file is readable; getAzureIconLibrary()
  // will re-attempt loading on subsequent calls if shapes are still empty.
  const shapeLibrary = initializeShapes(config.azureIconLibraryPath);
  log.debug(`Loaded ${shapeLibrary.shapes.length} Azure icon(s) across ${shapeLibrary.categories.size} categories`);

  if (config.transports.indexOf("stdio") > -1) {
    await start_stdio_transport();
  }
  if (config.transports.indexOf("http") > -1) {
    await start_streamable_http_transport(config.httpPort);
  }

  log.debug(`Draw.io MCP Server v${VERSION} is ready`);
}

main().catch((error) => {
  log.debug("Fatal error in main():", error);
  process.exit(1);
});
