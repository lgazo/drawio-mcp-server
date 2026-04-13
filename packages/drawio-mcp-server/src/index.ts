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
import {
  readFileSync,
  existsSync,
  statSync,
  readdirSync,
  realpathSync,
} from "node:fs";
import { AddressInfo } from "node:net";

import { WebSocket, WebSocketServer } from "ws";
const VERSION = process.env.npm_package_version ?? "2.1.0";
import {
  buildConfig,
  defaultConfig,
  shouldShowHelp,
  type ServerConfig,
  getHttpFeatureConfig,
  type HttpFeatureConfig,
} from "./config.js";
import {
  bus_reply_stream,
  bus_request_stream,
  type ConnectedDocumentInfo,
  type Context,
  type CurrentDocumentPageInfo,
  type ResolvedDocumentTarget,
  type TargetDocumentSelector,
} from "./types.js";
import { create_bus } from "./emitter_bus.js";
import { nanoid_id_generator } from "./nanoid_id_generator.js";
import { create_request_queue } from "./request_queue.js";
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
import { createServerWithSchemaStripping } from "./register-tool.js";
import { target_document_field } from "./tools/shared.js";

const fatalLog = create_console_logger();

export type AppLogger = {
  log: (level: string, message?: any, ...data: any[]) => void;
  debug: (message?: any, ...data: any[]) => void;
};

export type DrawioMcpApp = {
  createMcpServer: () => McpServer;
  log: AppLogger;
  context: Context;
  emitter: EventEmitter;
  close: () => Promise<void>;
  startWebSocketServer: (
    extensionPort?: number,
    host?: string,
  ) => Promise<WebSocketServer>;
  startStdioTransport: () => Promise<void>;
  startHttpServer: (
    httpPort: number,
    config: ServerConfig,
    features: HttpFeatureConfig,
  ) => Promise<{ server: ReturnType<typeof serve>; port: number }>;
};

/**
 * Display help message and exit
 */
function showHelp(): never {
  fatalLog.log(
    "info",
    `
Draw.io MCP Server (${VERSION})

Usage: drawio-mcp-server [options]

Options:
  --extension-port, -p <number>  WebSocket server port for browser extension (default: 3333)
  --editor, -e                   Enable draw.io editor endpoint
  --http-port                    HTTP server port for Streamable HTTP transport (default: 3000)
  --transport                    Transport type: stdio, http (default: stdio)
  --asset-path <path>            Custom path for downloaded assets
  --host <ip>                    Bind address for all servers (default: OS-assigned, e.g. 127.0.0.1 or ::1)
  --logger <mode>                Logger mode: console (stderr) or mcp-server (MCP notifications/message) (default: console)
  --help, -h                     Show this help message

Examples:
  drawio-mcp-server                           # Use default extension port 3333
  drawio-mcp-server --extension-port 8080     # Use custom extension port 8080
  drawio-mcp-server -p 8080                   # Short form
  drawio-mcp-server --editor                  # Enable draw.io editor endpoint
  drawio-mcp-server -e --http                 # Enable editor and HTTP transport
  drawio-mcp-server --editor --asset-path /data/assets # Use custom asset path
  `,
  );
  process.exit(0);
}

// No PORT constant needed - using dynamic config

async function checkPortAvailable(
  port: number,
  host?: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();

    server.listen({ port, ...(host !== undefined ? { host } : {}) }, () => {
      server.close(() => resolve(true));
    });

    server.on("error", () => resolve(false));
  });
}

async function start_stdio_transport(
  createServer: () => McpServer,
  log: AppLogger,
): Promise<McpServer> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.debug(`Draw.io MCP Server STDIO transport active`);
  return server;
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
  app.get("/health", (c) => c.json({ status: "ok" }));
}

function registerConfigRoute(app: Hono, config: ServerConfig) {
  app.get("/api/config", (c) =>
    c.json({
      websocketPort: config.extensionPort,
      serverUrl: `http://localhost:${config.httpPort}`,
      websocketUrl: config.webSocketUrl,
    }),
  );
}

function registerEditorRoutes(app: Hono, config: ServerConfig, log: AppLogger) {
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

function registerMcpRoute(
  app: Hono,
  createServer: () => McpServer,
  disposeMcpServer: (server: McpServer) => void,
): void {
  app.all("/mcp", async (c) => {
    const transport = new WebStandardStreamableHTTPServerTransport();
    const server = createServer();
    await server.connect(transport);
    // Remove the server from the tracking set immediately so it does not
    // prevent garbage collection.  We intentionally do *not* call
    // server.close() here because the response may be a long-lived SSE
    // stream (e.g. for GET requests).  The transport / server will be
    // collected once the response is fully consumed.
    disposeMcpServer(server);
    return transport.handleRequest(c.req.raw);
  });
}

function createHttpApp(
  log: AppLogger,
  config: ServerConfig,
  features: HttpFeatureConfig,
  createServer: () => McpServer,
  disposeMcpServer: (server: McpServer) => void,
): { app: Hono } {
  const app = new Hono();
  setupCors(app);

  if (features.enableHealth) registerHealthRoute(app);
  if (features.enableConfig) registerConfigRoute(app, config);
  if (features.enableMcp) registerMcpRoute(app, createServer, disposeMcpServer);
  if (features.enableEditor) registerEditorRoutes(app, config, log);

  return { app };
}

async function startHttpServer(
  createServer: () => McpServer,
  disposeMcpServer: (server: McpServer) => void,
  log: AppLogger,
  httpPort: number,
  config: ServerConfig,
  features: HttpFeatureConfig,
): Promise<{
  server: ReturnType<typeof serve>;
  port: number;
}> {
  const { app } = createHttpApp(
    log,
    config,
    features,
    createServer,
    disposeMcpServer,
  );

  const httpServer = serve({
    fetch: app.fetch,
    port: httpPort,
    ...(config.host !== undefined ? { hostname: config.host } : {}),
  });

  const listeningPort =
    httpPort === 0
      ? ((httpServer.address() as AddressInfo | null)?.port ?? httpPort)
      : httpPort;

  log.debug(`Draw.io MCP Server HTTP active on port ${listeningPort}`);
  if (features.enableMcp) {
    log.debug(`MCP endpoint: http://localhost:${listeningPort}/mcp`);
  }
  if (features.enableEditor) {
    log.debug(`Editor: http://localhost:${listeningPort}/`);
  }

  return {
    server: httpServer,
    port: listeningPort,
  };
}

export function createDrawioMcpApp(options?: {
  config?: ServerConfig;
  log?: AppLogger;
}): DrawioMcpApp {
  const config = options?.config ?? defaultConfig();
  const emitter = new EventEmitter();
  const connectionIdGenerator = nanoid_id_generator();
  const mcpServers = new Set<McpServer>();

  const capabilities: {
    resources: Record<string, unknown>;
    tools: Record<string, unknown>;
    logging?: {
      setLevels: true;
      levels: typeof validLogLevels;
    };
  } = {
    resources: {},
    tools: {},
  };
  if (config.logger === "mcp-server") {
    capabilities.logging = {
      setLevels: true,
      levels: validLogLevels,
    };
  }

  type ConnectionEntry = {
    connection_id: string;
    ws: WebSocket;
    document: ConnectedDocumentInfo | null;
    updated_at: number;
    sync_waiters: Set<() => void>;
  };

  const conns = new Map<string, ConnectionEntry>();
  const DOCUMENT_SYNC_TIMEOUT_MS = 1000;

  // Lazily resolved log — uses console logger until a server logger is
  // explicitly requested via --logger mcp-server, in which case the first
  // McpServer created will be used for the logger binding.
  let _log: AppLogger | undefined = options?.log;
  let _serverLoggerBound = false;

  function getLog(): AppLogger {
    if (_log) return _log;
    _log = create_console_logger();
    return _log;
  }

  // Proxy logger that lazily resolves to the real logger, allowing the
  // mcp_server_logger to be bound after the first McpServer is created.
  const lazyLog: AppLogger = {
    log: (level, message, ...data) => getLog().log(level, message, ...data),
    debug: (message, ...data) => getLog().debug(message, ...data),
  };

  const bus = create_bus(lazyLog)(emitter);
  const id_generator = nanoid_id_generator();
  const request_queue = create_request_queue(lazyLog);

  function normalizeOptionalString(value: unknown): string | null {
    if (value === undefined || value === null || value === "") {
      return null;
    }

    return String(value);
  }

  function normalizeCurrentPage(value: unknown): CurrentDocumentPageInfo | null {
    if (!value || typeof value !== "object") {
      return null;
    }

    const record = value as Record<string, unknown>;
    const id = normalizeOptionalString(record.id);
    const name = normalizeOptionalString(record.name);
    const index = Number(record.index);

    if (!id || !name || !Number.isInteger(index) || index < 0) {
      return null;
    }

    return {
      index,
      id,
      name,
      is_current: true,
    };
  }

  function normalizeDocumentState(value: unknown): ConnectedDocumentInfo | null {
    if (!value || typeof value !== "object") {
      return null;
    }

    const record = value as Record<string, unknown>;
    const id = normalizeOptionalString(record.id);

    if (!id) {
      return null;
    }

    const page_count = Number(record.page_count);

    return {
      id,
      title: normalizeOptionalString(record.title),
      mode: normalizeOptionalString(record.mode),
      hash: normalizeOptionalString(record.hash),
      file_url: normalizeOptionalString(record.file_url),
      page_count:
        Number.isInteger(page_count) && page_count >= 0 ? page_count : 0,
      current_page: normalizeCurrentPage(record.current_page),
    };
  }

  function listKnownDocuments(): ConnectedDocumentInfo[] {
    return [...conns.values()]
      .map((entry) => entry.document)
      .filter((document): document is ConnectedDocumentInfo => document !== null);
  }

  function findConnectionByDocumentId(
    documentId: string,
  ): ConnectionEntry | undefined {
    return [...conns.values()].find((entry) => entry.document?.id === documentId);
  }

  function flushSyncWaiters(entry: ConnectionEntry) {
    for (const resolve of [...entry.sync_waiters]) {
      try {
        resolve();
      } catch {
        // ignore
      }
    }
    entry.sync_waiters.clear();
  }

  function sendControlMessage(entry: ConnectionEntry, control: string) {
    if (entry.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    entry.ws.send(
      JSON.stringify({
        __control: control,
      }),
    );
    return true;
  }

  function requestDocumentSync(entry: ConnectionEntry): Promise<void> {
    return new Promise((resolve) => {
      let settled = false;
      let timeout: ReturnType<typeof setTimeout> | undefined;

      const wrappedFinish = () => {
        if (settled) {
          return;
        }

        settled = true;
        if (timeout) {
          clearTimeout(timeout);
        }
        entry.sync_waiters.delete(wrappedFinish);
        resolve();
      };

      entry.sync_waiters.add(wrappedFinish);
      timeout = setTimeout(() => {
        wrappedFinish();
      }, DOCUMENT_SYNC_TIMEOUT_MS);

      if (!sendControlMessage(entry, "sync-document-state")) {
        wrappedFinish();
      }
    });
  }

  async function syncAllDocuments() {
    await Promise.all([...conns.values()].map((entry) => requestDocumentSync(entry)));
  }

  const document_routing = {
    list_documents: async (): Promise<ConnectedDocumentInfo[]> => {
      await syncAllDocuments();
      return listKnownDocuments();
    },
    resolve_target_document: async (
      args: Record<string, unknown>,
    ): Promise<ResolvedDocumentTarget> => {
      const rawSelector = args.target_document;

      if (rawSelector && typeof rawSelector === "object") {
        const selector = rawSelector as Partial<TargetDocumentSelector>;
        const documentId = normalizeOptionalString(selector.id);

        if (!documentId) {
          throw new Error("`target_document.id` is required");
        }

        let entry = findConnectionByDocumentId(documentId);

        if (!entry) {
          await syncAllDocuments();
          entry = findConnectionByDocumentId(documentId);
        }

        if (!entry || !entry.document) {
          throw new Error(`Document with ID ${documentId} was not found`);
        }

        return {
          connection_id: entry.connection_id,
          target_document: { id: documentId },
          document: entry.document,
        };
      }

      await syncAllDocuments();
      const documents = listKnownDocuments();

      if (documents.length === 0) {
        throw new Error("No connected Draw.io documents");
      }

      if (documents.length > 1) {
        throw new Error(
          "Multiple Draw.io documents are connected. Call `list-documents` and retry with `target_document`.",
        );
      }

      const document = documents[0];
      const entry = findConnectionByDocumentId(document.id);

      if (!entry) {
        throw new Error(`Document with ID ${document.id} was not found`);
      }

      return {
        connection_id: entry.connection_id,
        target_document: { id: document.id },
        document,
      };
    },
  };

  const context: Context = {
    bus,
    id_generator,
    request_queue,
    document_routing,
    get log() {
      return getLog();
    },
  };

  function createDocumentScopedServer(server: McpServer): McpServer {
    return new Proxy(server, {
      get(target, prop, receiver) {
        if (prop !== "tool") {
          return Reflect.get(target, prop, receiver);
        }

        return (
          name: string,
          description: string,
          params: Record<string, unknown>,
          handler: unknown,
        ) => {
          const scopedParams =
            name === "list-documents"
              ? params
              : {
                  ...params,
                  target_document: target_document_field().optional(),
                };

          return (
            target.tool as (
              ...args: [string, string, Record<string, unknown>, unknown]
            ) => unknown
          ).call(target, name, description, scopedParams, handler);
        };
      },
    }) as McpServer;
  }

  /**
   * Factory: creates a new McpServer instance with all tools registered.
   * Each transport must use its own McpServer since the MCP SDK only
   * allows a single transport connection per Protocol instance.
   */
  function createMcpServer(): McpServer {
    const server = new McpServer(
      {
        name: "drawio-mcp-server",
        version: VERSION,
      },
      {
        capabilities,
      },
    );

    // Bind the mcp_server logger to the first server created when the
    // mcp-server logger mode was selected.
    if (
      config.logger === "mcp-server" &&
      !_serverLoggerBound &&
      !options?.log
    ) {
      _log = create_server_logger(server);
      _serverLoggerBound = true;
    }

    registerTools(
      createDocumentScopedServer(createServerWithSchemaStripping(server)),
      context,
    );
    mcpServers.add(server);
    return server;
  }

  /**
   * Remove a previously created McpServer from the tracking set.
   * Used by the HTTP route handler to prevent unbounded growth of
   * the set when creating per-request servers in stateless mode.
   */
  function disposeMcpServer(server: McpServer): void {
    mcpServers.delete(server);
  }

  function createDisconnectedDocumentError(event: Record<string, unknown>) {
    const targetDocumentId =
      typeof (event.target_document as { id?: unknown } | undefined)?.id ===
        "string" &&
      (event.target_document as { id?: string }).id
        ? (event.target_document as { id: string }).id
        : null;
    const targetConnectionId =
      typeof event.__target_connection_id === "string"
        ? event.__target_connection_id
        : null;
    const targetLabel = targetDocumentId
      ? `Target document ${targetDocumentId}`
      : targetConnectionId
        ? `Target connection ${targetConnectionId}`
        : "Target Draw.io connection";

    return new Error(`${targetLabel} is no longer connected; call list-documents and retry`);
  }

  const bus_to_ws_forwarder_listener = (event: any) => {
    const targetConnectionId =
      typeof event?.__target_connection_id === "string"
        ? event.__target_connection_id
        : null;

    if (targetConnectionId) {
      const entry = conns.get(targetConnectionId);
      getLog().debug(`[bridge] forwarding message to #${targetConnectionId}`, event);

      if (!entry) {
        getLog().debug(
          `[bridge] target connection ${targetConnectionId} not found`,
        );
        throw createDisconnectedDocumentError(event);
      }

      if (entry.ws.readyState !== WebSocket.OPEN) {
        flushSyncWaiters(entry);
        conns.delete(targetConnectionId);
        throw createDisconnectedDocumentError(event);
      }

      try {
        entry.ws.send(JSON.stringify(event));
      } catch (error) {
        getLog().debug("[bridge] error forwarding request", error);
        flushSyncWaiters(entry);
        conns.delete(targetConnectionId);
        throw createDisconnectedDocumentError(event);
      }
      return;
    }

    getLog().debug(
      `[bridge] received; forwarding message to #${conns.size} clients`,
      event,
    );
    for (const [connectionId, entry] of [...conns.entries()]) {
      if (entry.ws.readyState !== WebSocket.OPEN) {
        flushSyncWaiters(entry);
        conns.delete(connectionId);
        continue;
      }

      try {
        entry.ws.send(JSON.stringify(event));
      } catch (error) {
        getLog().debug("[bridge] error forwarding request", error);
        flushSyncWaiters(entry);
        conns.delete(connectionId);
      }
    }
  };
  emitter.on(bus_request_stream, bus_to_ws_forwarder_listener);

  let wsServer: WebSocketServer | undefined;
  let httpServer: ReturnType<typeof serve> | undefined;

  async function startWebSocketServer(extensionPort = 3333, host?: string) {
    getLog().debug(
      `Draw.io MCP Server (${VERSION}) starting (WebSocket extension port: ${extensionPort})`,
    );

    if (extensionPort !== 0) {
      const isPortAvailable = await checkPortAvailable(extensionPort, host);
      if (!isPortAvailable) {
        throw new Error(
          `[start_websocket_server] Error: Port ${extensionPort} is already in use. Please stop the process using this port and try again.`,
        );
      }
    }

    wsServer = new WebSocketServer({
      port: extensionPort,
      ...(host !== undefined ? { host } : {}),
    });

    wsServer.on("connection", (ws) => {
      const connection_id = connectionIdGenerator.generate();
      const entry: ConnectionEntry = {
        connection_id,
        ws,
        document: null,
        updated_at: Date.now(),
        sync_waiters: new Set(),
      };

      getLog().debug(
        `[ws_handler] WebSocket client ${connection_id} connected, presumably MCP Extension!`,
      );
      conns.set(connection_id, entry);

      sendControlMessage(entry, "sync-document-state");

      ws.on("message", (data) => {
        const str = typeof data === "string" ? data : data.toString();
        try {
          const json = JSON.parse(str);
          getLog().debug(`[ws] received from Extension`, json);

          if (json?.__control === "document-state") {
            entry.document = normalizeDocumentState(json.document);
            entry.updated_at = Date.now();
            flushSyncWaiters(entry);
            return;
          }

          emitter.emit(bus_reply_stream, json);
        } catch (error) {
          getLog().debug(`[ws] failed to parse message`, error);
        }
      });

      ws.on("close", (code) => {
        flushSyncWaiters(entry);
        conns.delete(connection_id);
        getLog().debug(
          `[ws_handler] WebSocket client ${connection_id} closed with code ${code}`,
        );
      });

      ws.on("error", (error) => {
        getLog().debug(`[ws_handler] WebSocket client error`, error);
        flushSyncWaiters(entry);
        conns.delete(connection_id);
      });
    });

    await new Promise<void>((resolve, reject) => {
      const onListening = () => {
        wsServer?.off("error", onError);
        const address = wsServer?.address() as AddressInfo | null;
        getLog().debug(
          `[start_websocket_server] Listening to port ${address?.port ?? extensionPort}`,
        );
        resolve();
      };
      const onError = (error: Error) => {
        wsServer?.off("listening", onListening);
        reject(error);
      };
      wsServer?.once("listening", onListening);
      wsServer?.once("error", onError);
    });

    return wsServer;
  }

  async function close() {
    emitter.off(bus_request_stream, bus_to_ws_forwarder_listener);
    for (const entry of [...conns.values()]) {
      try {
        flushSyncWaiters(entry);
        entry.ws.close();
      } catch {
        // ignore
      }
    }
    conns.clear();

    for (const s of mcpServers) {
      await s.close();
    }
    mcpServers.clear();

    if (wsServer) {
      await new Promise<void>((resolve, reject) => {
        wsServer?.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
      wsServer = undefined;
    }

    if (httpServer) {
      await new Promise<void>((resolve, reject) => {
        httpServer?.close((error?: Error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
      httpServer = undefined;
    }
  }

  return {
    createMcpServer,
    get log() {
      return getLog();
    },
    context,
    emitter,
    close,
    startWebSocketServer,
    startStdioTransport: async () => {
      await start_stdio_transport(createMcpServer, getLog());
    },
    startHttpServer: async (httpPort, config, features) => {
      const started = await startHttpServer(
        createMcpServer,
        disposeMcpServer,
        getLog(),
        httpPort,
        config,
        features,
      );
      httpServer = started.server;
      return started;
    },
  };
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
    fatalLog.log("error", `Error: ${configResult.message}`);
    process.exit(1);
  }

  const config: ServerConfig = configResult;
  const features = getHttpFeatureConfig(config);

  const app = createDrawioMcpApp({ config });

  // Initialize assets if needed
  if (features.enableEditor) {
    app.log.debug("Initializing draw.io assets...");
    const assetConfig: AssetConfig = {
      assetPath: config.assetPath,
    };
    await ensureAssets(assetConfig, app.log);
    app.log.debug("Assets ready!");
  }

  await app.startWebSocketServer(config.extensionPort, config.host);
  if (config.transports.indexOf("stdio") > -1) {
    await app.startStdioTransport();
  }
  await app.startHttpServer(config.httpPort, config, features);

  app.log.debug(`Draw.io MCP Server running on ${config.transports}`);
}

const isMainModule = process.argv[1]
  ? realpathSync(fileURLToPath(import.meta.url)) ===
    realpathSync(process.argv[1])
  : false;

if (isMainModule) {
  main().catch((error) => {
    fatalLog.log("error", "Fatal error in main():", error);
    process.exit(1);
  });
}
