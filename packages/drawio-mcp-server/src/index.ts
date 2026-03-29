#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import EventEmitter from "node:events";
import { createServer } from "node:net";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";

import { WebSocket, WebSocketServer } from "ws";
const VERSION = process.env.npm_package_version ?? "2.0.0";
import {
  buildConfig,
  shouldShowHelp,
  type ServerConfig,
  getHttpFeatureConfig,
  type HttpFeatureConfig,
} from "./config.js";
import {
  Bus,
  bus_reply_stream,
  bus_request_stream,
  BusListener,
  Context,
} from "./types.js";
import { create_bus } from "./emitter_bus.js";
import { nanoid_id_generator } from "./nanoid_id_generator.js";
import { create_logger as create_console_logger } from "./mcp_console_logger.js";
import {
  create_logger as create_server_logger,
  validLogLevels,
} from "./mcp_server_logger.js";
import {
  getLocalPluginPath,
  isUsingLocalAssets,
  getAssetRoot,
  ensureAssets,
  type AssetConfig,
} from "./assets/index.js";
import { registerTools } from "./tools/index.js";

/**
 * Display help message and exit
 */
function showHelp(): never {
  console.log(`
Draw.io MCP Server (${VERSION})

Usage: drawio-mcp-server [options]

Options:
  --extension-port, -p <number>  WebSocket server port for browser extension (default: 3333)
  --editor, -e                   Enable draw.io editor endpoint
  --http-port                    HTTP server port for Streamable HTTP transport (default: 3000)
  --transport                    Transport type: stdio, http (default: stdio)
  --asset-path <path>           Custom path for downloaded assets
  --help, -h                     Show this help message

Examples:
  drawio-mcp-server                           # Use default extension port 3333
  drawio-mcp-server --extension-port 8080     # Use custom extension port 8080
  drawio-mcp-server -p 8080                   # Short form
  drawio-mcp-server --editor                  # Enable draw.io editor endpoint
  drawio-mcp-server -e --http                 # Enable editor and HTTP transport
  drawio-mcp-server --editor --asset-path /data/assets # Use custom asset path
  `);
  process.exit(0);
}

// No PORT constant needed - using dynamic config

async function checkPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();

    server.listen(port, () => {
      server.close(() => resolve(true));
    });

    server.on("error", () => resolve(false));
  });
}

const emitter = new EventEmitter();
const conns = new Set<WebSocket>();

const bus_to_ws_forwarder_listener = (event: any) => {
  log.debug(
    `[bridge] received; forwarding message to #${conns.size} clients`,
    event,
  );
  for (const ws of [...conns]) {
    if (ws.readyState !== WebSocket.OPEN) {
      conns.delete(ws);
      continue;
    }

    try {
      ws.send(JSON.stringify(event));
    } catch (e) {
      log.debug("[bridge] error forwarding request", e);
      conns.delete(ws);
    }
  }
};
emitter.on(bus_request_stream, bus_to_ws_forwarder_listener);

async function start_websocket_server(extensionPort: number) {
  log.debug(
    `Draw.io MCP Server (${VERSION}) starting (WebSocket extension port: ${extensionPort})`,
  );
  const isPortAvailable = await checkPortAvailable(extensionPort);

  if (!isPortAvailable) {
    console.error(
      `[start_websocket_server] Error: Port ${extensionPort} is already in use. Please stop the process using this port and try again.`,
    );
    process.exit(1);
  }

  const server = new WebSocketServer({ port: extensionPort });

  server.on("connection", (ws) => {
    log.debug(
      `[ws_handler] A WebSocket client #${conns.size} connected, presumably MCP Extension!`,
    );
    conns.add(ws);

    ws.on("message", (data) => {
      const str = typeof data === "string" ? data : data.toString();
      try {
        const json = JSON.parse(str);
        log.debug(`[ws] received from Extension`, json);
        emitter.emit(bus_reply_stream, json);
      } catch (error) {
        log.debug(`[ws] failed to parse message`, error);
      }
    });

    ws.on("close", (code) => {
      conns.delete(ws);
      log.debug(`[ws_handler] WebSocket client closed with code ${code}`);
    });

    ws.on("error", (error) => {
      log.debug(`[ws_handler] WebSocket client error`, error);
      conns.delete(ws);
    });
  });

  server.on("listening", () => {
    log.debug(`[start_websocket_server] Listening to port ${extensionPort}`);
  });

  server.on("error", (error) => {
    console.error(
      `[start_websocket_server] Error: Failed to listen on port ${extensionPort}`,
      error,
    );
    process.exit(1);
  });

  return server;
}

const logger_type = process.env.LOGGER_TYPE;
let capabilities: any = {
  resources: {},
  tools: {},
};
if (logger_type === "mcp_server") {
  capabilities = {
    ...capabilities,
    logging: {
      setLevels: true,
      levels: validLogLevels,
    },
  };
}

// Create server instance
const server = new McpServer(
  {
    name: "drawio-mcp-server",
    version: VERSION,
  },
  {
    capabilities,
  },
);

const log =
  logger_type === "mcp_server"
    ? create_server_logger(server)
    : create_console_logger();
const bus = create_bus(log)(emitter);
const id_generator = nanoid_id_generator();

const context: Context = {
  bus,
  id_generator,
  log,
};

registerTools(server, context);

async function start_stdio_transport() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.debug(`Draw.io MCP Server STDIO transport active`);
}

function setupCors(app: Hono) {
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
}

function registerHealthRoute(app: Hono) {
  app.get("/health", (c) =>
    c.json({ status: server.isConnected() ? "ok" : "mcp not ready" }),
  );
}

function registerConfigRoute(app: Hono, config: ServerConfig) {
  app.get("/api/config", (c) =>
    c.json({
      websocketPort: config.extensionPort,
      serverUrl: `http://localhost:${config.httpPort}`,
    }),
  );
}

function registerEditorRoutes(app: Hono, config: ServerConfig) {
  const assetConfig: AssetConfig = {
    assetPath: config.assetPath,
  };
  const isLocal = isUsingLocalAssets(assetConfig);
  const assetRoot = isLocal ? getAssetRoot(assetConfig) : null;
  const localPluginPath = getLocalPluginPath();

  app.get("/js/mcp-plugin.js", (c) => {
    if (existsSync(localPluginPath)) {
      const content = readFileSync(localPluginPath);
      c.header("Content-Type", "application/javascript");
      return c.body(content);
    }
    return c.text("Plugin not found", 404);
  });

  app.use("/*", async (c, next) => {
    let path = c.req.path;
    if (path === "" || path === "/") {
      path = "index.html";
    }

    if (!isLocal || !assetRoot) {
      await next();
      return;
    }

    let filePath = join(assetRoot, path);

    if (existsSync(filePath)) {
      const fileStats = statSync(filePath);

      if (fileStats.isDirectory()) {
        const normalizedPath = path.endsWith("/") ? path.slice(0, -1) : path;
        const parentDir = join(assetRoot, normalizedPath);
        if (existsSync(parentDir) && statSync(parentDir).isDirectory()) {
          const entries = readdirSync(parentDir);
          const firstFile = entries.find(
            (e: string) => !statSync(join(parentDir, e)).isDirectory(),
          );
          if (firstFile) {
            filePath = join(parentDir, firstFile);
          } else {
            await next();
            return;
          }
        } else {
          await next();
          return;
        }
      }

      let content = readFileSync(filePath);
      const ext = filePath.split(".").pop()?.toLowerCase();

      if (ext === "html") {
        const contentStr = content.toString("utf-8");
        if (
          contentStr.includes("</body>") &&
          !contentStr.includes("mcp-plugin.js")
        ) {
          const pluginScript = `<script src="/js/mcp-plugin.js"></script>`;
          content = Buffer.from(
            contentStr.replace("</body>", `${pluginScript}</body>`),
          );
        }
      }

      const contentTypes: Record<string, string> = {
        html: "text/html",
        css: "text/css",
        js: "application/javascript",
        json: "application/json",
        svg: "image/svg+xml",
        png: "image/png",
        ico: "image/x-icon",
        map: "application/json",
      };
      c.header("Content-Type", contentTypes[ext || ""] || "text/plain");
      return c.body(content);
    }
    await next();
  });

  app.get("/", (c) => {
    return c.redirect("/index.html?offline=1&local=1");
  });

  log.debug(`Draw.io editor enabled at: http://localhost:${config.httpPort}/`);
}

function registerMcpRoute(app: Hono): WebStandardStreamableHTTPServerTransport {
  const transport = new WebStandardStreamableHTTPServerTransport();
  app.all("/mcp", (c) => transport.handleRequest(c.req.raw));
  return transport;
}

function createHttpApp(
  config: ServerConfig,
  features: HttpFeatureConfig,
): {
  app: Hono;
  mcpTransport: WebStandardStreamableHTTPServerTransport | undefined;
} {
  const app = new Hono();
  setupCors(app);

  if (features.enableHealth) registerHealthRoute(app);
  if (features.enableConfig) registerConfigRoute(app, config);
  const mcpTransport = features.enableMcp ? registerMcpRoute(app) : undefined;
  if (features.enableEditor) registerEditorRoutes(app, config);

  return { app, mcpTransport };
}

async function startHttpServer(
  httpPort: number,
  config: ServerConfig,
  features: HttpFeatureConfig,
) {
  const { app, mcpTransport } = createHttpApp(config, features);

  if (mcpTransport) {
    await server.connect(mcpTransport);
  }

  serve({
    fetch: app.fetch,
    port: httpPort,
  });

  log.debug(`Draw.io MCP Server HTTP active on port ${httpPort}`);
  if (features.enableMcp) {
    log.debug(`MCP endpoint: http://localhost:${httpPort}/mcp`);
  }
  if (features.enableEditor) {
    log.debug(`Editor: http://localhost:${httpPort}/`);
  }
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
  const features = getHttpFeatureConfig(config);

  // Initialize assets if needed
  if (features.enableEditor) {
    console.log("Initializing draw.io assets...");
    const assetConfig: AssetConfig = {
      assetPath: config.assetPath,
    };
    await ensureAssets(assetConfig, (msg) => console.log(msg));
    console.log("Assets ready!");
  }

  await start_websocket_server(config.extensionPort);
  if (config.transports.indexOf("stdio") > -1) {
    await start_stdio_transport();
  }
  startHttpServer(config.httpPort, config, features);

  log.debug(`Draw.io MCP Server running on ${config.transports}`);
}

main().catch((error) => {
  log.debug("Fatal error in main():", error);
  process.exit(1);
});
