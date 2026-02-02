#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { serve } from "@hono/node-server";
import { z } from "zod";
import { Hono } from "hono";
import { cors } from "hono/cors";

import EventEmitter from "node:events";
import { createServer } from "node:net";

import { WebSocket, WebSocketServer } from "ws";
import { buildConfig, shouldShowHelp, type ServerConfig } from "./config.js";
import {
  Bus,
  bus_reply_stream,
  bus_request_stream,
  BusListener,
  Context,
} from "./types.js";
import { create_bus } from "./emitter_bus.js";
import { default_tool } from "./tool.js";
import { nanoid_id_generator } from "./nanoid_id_generator.js";
import { create_logger as create_console_logger } from "./mcp_console_logger.js";
import {
  create_logger as create_server_logger,
  validLogLevels,
} from "./mcp_server_logger.js";


const VERSION = "1.6.1";

/**
 * Display help message and exit
 */
function showHelp(): never {
  console.log(`
Draw.io MCP Server (${VERSION})

Usage: drawio-mcp-server [options]

Options:
  --extension-port, -p <number>  WebSocket server port for browser extension (default: 3333)
  --help, -h                     Show this help message

Examples:
  drawio-mcp-server                           # Use default extension port 3333
  drawio-mcp-server --extension-port 8080     # Use custom extension port 8080
  drawio-mcp-server -p 8080                   # Short form
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

const TOOL_get_selected_cell = "get-selected-cell";
server.tool(
  TOOL_get_selected_cell,
  "This tool allows you to retrieve selected cell (whether vertex or edge) on the current page of a Draw.io diagram. The response is a JSON containing attributes of the cell.",
  {},
  default_tool(TOOL_get_selected_cell, context),
);

const TOOL_add_rectangle = "add-rectangle";
server.tool(
  TOOL_add_rectangle,
  "This tool allows you to add new Rectangle vertex cell (object) on the current page of a Draw.io diagram. It accepts multiple optional input parameter.",
  {
    x: z
      .number()
      .optional()
      .describe("X-axis position of the Rectangle vertex cell")
      .default(100),
    y: z
      .number()
      .optional()
      .describe("Y-axis position of the Rectangle vertex cell")
      .default(100),
    width: z
      .number()
      .optional()
      .describe("Width of the Rectangle vertex cell")
      .default(200),
    height: z
      .number()
      .optional()
      .describe("Height of the Rectangle vertex cell")
      .default(100),
    text: z
      .string()
      .optional()
      .describe("Text content placed inside of the Rectangle vertex cell")
      .default("New Cell"),
    style: z
      .string()
      .optional()
      .describe(
        "Semi-colon separated list of Draw.io visual styles, in the form of `key=value`. Example: `whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#666666;`",
      )
      .default("whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;"),
  },
  default_tool(TOOL_add_rectangle, context),
);

const TOOL_add_edge = "add-edge";
server.tool(
  TOOL_add_edge,
  "This tool creates an edge, sometimes called also a relation, between two vertexes (cells).",
  {
    source_id: z
      .string()
      .describe("Source ID of a cell. It is represented by `id` attribute."),
    target_id: z
      .string()
      .describe("Target ID of a cell. It is represented by `id` attribute."),
    text: z
      .string()
      .optional()
      .describe("Text content placed over the edge cell"),
    style: z
      .string()
      .optional()
      .describe(
        "Semi-colon separated list of Draw.io visual styles, in the form of `key=value`. Example: `edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;`",
      )
      .default(
        "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;",
      ),
  },
  default_tool(TOOL_add_edge, context),
);

const TOOL_delete_cell_by_id = "delete-cell-by-id";
server.tool(
  TOOL_delete_cell_by_id,
  "Deletes a cell, whether it is a vertex or edge.",
  {
    cell_id: z
      .string()
      .describe(
        "The ID of a cell to delete. The cell can be either vertex or edge. The ID is located in `id` attribute.",
      ),
  },
  default_tool(TOOL_delete_cell_by_id, context),
);

const TOOL_get_shape_categories = "get-shape-categories";
server.tool(
  TOOL_get_shape_categories,
  "Retrieves available shape categories from the diagram's library. Library is split into multiple categories.",
  {},
  default_tool(TOOL_get_shape_categories, context),
);

const TOOL_get_shapes_in_category = "get-shapes-in-category";
server.tool(
  TOOL_get_shapes_in_category,
  "Retrieve all shapes in the provided category from the diagram's library. A shape primarily contains `style` based on which you can create new vertex cells.",
  {
    category_id: z
      .string()
      .describe(
        "Identifier (ID / key) of the category from which all the shapes should be retrieved.",
      ),
  },
  default_tool(TOOL_get_shapes_in_category, context),
);

const TOOL_get_shape_by_name = "get-shape-by-name";
server.tool(
  TOOL_get_shape_by_name,
  "Retrieve a specific shape by its name from all available shapes in the diagram's library. It returns the shape and also the category it belongs.",
  {
    shape_name: z
      .string()
      .describe(
        "Name of the shape to retrieve from the shape library of the current diagram.",
      ),
  },
  default_tool(TOOL_get_shape_by_name, context),
);

const TOOL_add_cell_of_shape = "add-cell-of-shape";
server.tool(
  TOOL_add_cell_of_shape,
  "This tool allows you to add new vertex cell (object) on the current page of a Draw.io diagram by its shape name. It accepts multiple optional input parameter.",
  {
    shape_name: z
      .string()
      .describe(
        "Name of the shape to retrieved from the shape library of the current diagram.",
      ),
    x: z
      .number()
      .optional()
      .describe("X-axis position of the vertex cell of the shape")
      .default(100),
    y: z
      .number()
      .optional()
      .describe("Y-axis position of the vertex cell of the shape")
      .default(100),
    width: z
      .number()
      .optional()
      .describe("Width of the vertex cell of the shape")
      .default(200),
    height: z
      .number()
      .optional()
      .describe("Height of the vertex cell of the shape")
      .default(100),
    text: z
      .string()
      .optional()
      .describe("Text content placed inside of the vertex cell of the shape"),
    style: z
      .string()
      .optional()
      .describe(
        "Semi-colon separated list of Draw.io visual styles, in the form of `key=value`. Example: `whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#666666;`",
      ),
  },
  default_tool(TOOL_add_cell_of_shape, context),
);

const TOOL_set_cell_shape = "set-cell-shape";
server.tool(
  TOOL_set_cell_shape,
  "Updates the visual style of an existing vertex cell to match a library shape by name.",
  {
    cell_id: z
      .string()
      .describe(
        "Identifier (`id` attribute) of the cell whose shape should change.",
      ),
    shape_name: z
      .string()
      .describe(
        "Name of the library shape whose style should be applied to the existing cell.",
      ),
  },
  default_tool(TOOL_set_cell_shape, context),
);

const TOOL_set_cell_data = "set-cell-data";
server.tool(
  TOOL_set_cell_data,
  "Sets or updates a custom attribute on an existing cell.",
  {
    cell_id: z
      .string()
      .describe(
        "Identifier (`id` attribute) of the cell to update with custom data.",
      ),
    key: z.string().describe("Name of the attribute to set on the cell."),
    value: z
      .union([z.string(), z.number(), z.boolean()])
      .describe(
        "Value to store for the attribute. Non-string values are stringified before storage.",
      ),
  },
  default_tool(TOOL_set_cell_data, context),
);

const TOOL_edit_cell = "edit-cell";
server.tool(
  TOOL_edit_cell,
  "Update properties of an existing vertex/shape cell by its ID. Only provided fields are modified; unspecified properties remain unchanged.",
  {
    cell_id: z
      .string()
      .describe(
        "Identifier (`id` attribute) of the cell to update. Applies to vertex/shape cells.",
      ),
    text: z
      .string()
      .optional()
      .describe("Replace the cell's text/label content."),
    x: z
      .number()
      .optional()
      .describe("Set a new X-axis position for the cell."),
    y: z
      .number()
      .optional()
      .describe("Set a new Y-axis position for the cell."),
    width: z.number().optional().describe("Set a new width for the cell."),
    height: z.number().optional().describe("Set a new height for the cell."),
    style: z
      .string()
      .optional()
      .describe(
        "Replace the cell's style string (semi-colon separated `key=value` pairs).",
      ),
  },
  default_tool(TOOL_edit_cell, context),
);

const TOOL_edit_edge = "edit-edge";
server.tool(
  TOOL_edit_edge,
  "Update properties of an existing edge by its ID. Only provided fields are modified; unspecified properties remain unchanged.",
  {
    cell_id: z
      .string()
      .describe(
        "Identifier (`id` attribute) of the edge cell to update. The ID must reference an edge.",
      ),
    text: z.string().optional().describe("Replace the edge's label text."),
    source_id: z
      .string()
      .optional()
      .describe("Reassign the edge's source terminal to a different cell ID."),
    target_id: z
      .string()
      .optional()
      .describe("Reassign the edge's target terminal to a different cell ID."),
    style: z
      .string()
      .optional()
      .describe(
        "Replace the edge's style string (semi-colon separated `key=value` pairs).",
      ),
  },
  default_tool(TOOL_edit_edge, context),
);

const Attributes: z.ZodType<any> = z.lazy(() =>
  z
    .array(
      z.union([
        z.string(),
        Attributes, // recursion: nested arrays
      ]),
    )
    .refine((arr) => arr.length === 0 || typeof arr[0] === "string", {
      message: "If not empty, the first element must be a string operator",
    })
    .default([]),
);

const TOOL_list_paged_model = "list-paged-model";
server.tool(
  TOOL_list_paged_model,
  "Retrieves a paginated view of all cells (vertices and edges) in the current Draw.io diagram. This tool provides access to the complete model data with essential fields only, sanitized to remove circular dependencies and excessive data. It allows to filter based on multiple criteria and attribute boolean logic. Useful for programmatic inspection of diagram structure without overwhelming response sizes.",
  {
    page: z
      .number()
      .optional()
      .describe(
        "Zero-based page number for pagination. Page 0 returns the first batch of cells, page 1 returns the next batch, etc. Default is 0.",
      )
      .default(0),
    page_size: z
      .number()
      .optional()
      .describe(
        "Maximum number of cells to return in a single page. Controls response size and performance. Must be between 1 and 1000. Default is 50.",
      )
      .default(50),
    filter: z
      .object({
        cell_type: z
          .enum(["edge", "vertex", "object", "layer", "group"])
          .optional()
          .describe(
            "Filter by cell type: 'edge' for connection lines, 'vertex' for vertices/shapes, 'object' for any cell type, 'layer' for layer cells, 'group' for grouped cells",
          ),
        attributes: Attributes.optional().describe(
          'Boolean logic array expressions for filtering cell attributes. Format: ["and" | "or", ...expressions] or ["equal", key, value]. Matches against cell attributes and parsed style properties.',
        ),
      })
      .optional()
      .describe("Optional filter criteria to apply to cells before pagination")
      .default({}),
  },
  default_tool(TOOL_list_paged_model, context),
);

const TOOL_list_layers = "list-layers";
server.tool(
  TOOL_list_layers,
  "Lists all available layers in the diagram with their IDs and names.",
  {},
  default_tool(TOOL_list_layers, context),
);

const TOOL_set_active_layer = "set-active-layer";
server.tool(
  TOOL_set_active_layer,
  "Sets the active layer for creating new elements. All subsequent element creation will happen in this layer.",
  {
    layer_id: z.string().describe("ID of the layer to set as active"),
  },
  default_tool(TOOL_set_active_layer, context),
);

const TOOL_move_cell_to_layer = "move-cell-to-layer";
server.tool(
  TOOL_move_cell_to_layer,
  "Moves a cell from its current layer to a target layer.",
  {
    cell_id: z.string().describe("ID of the cell to move"),
    target_layer_id: z
      .string()
      .describe("ID of the target layer where the cell will be moved"),
  },
  default_tool(TOOL_move_cell_to_layer, context),
);

const TOOL_get_active_layer = "get-active-layer";
server.tool(
  TOOL_get_active_layer,
  "Gets the currently active layer information.",
  {},
  default_tool(TOOL_get_active_layer, context),
);

const TOOL_create_layer = "create-layer";
server.tool(
  TOOL_create_layer,
  "Creates a new layer in the diagram.",
  {
    name: z.string().describe("Name for the new layer"),
  },
  default_tool(TOOL_create_layer, context),
);

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

  serve({
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

  await start_websocket_server(config.extensionPort);
  if (config.transports.indexOf("stdio") > -1) {
    await start_stdio_transport();
  }
  if (config.transports.indexOf("http") > -1) {
    start_streamable_http_transport(config.httpPort);
  }

  log.debug(`Draw.io MCP Server running on ${config.transports}`);
}

main().catch((error) => {
  log.debug("Fatal error in main():", error);
  process.exit(1);
});
