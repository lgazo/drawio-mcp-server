#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import EventEmitter from "node:events";

import uWS from "uWebSockets.js";
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
import { create_logger } from "./mcp_console_logger.js";

const log = create_logger();

const emitter = new EventEmitter();
const conns: uWS.WebSocket<unknown>[] = [];

const bus_to_ws_forwarder_listener = (event: any) => {
  log.debug(`[bridge] received event to forward`, event);
  
  if (conns.length === 0) {
    log.debug(`[bridge] No active WebSocket connections to forward to!`);
    return;
  }
  
  log.debug(`[bridge] Forwarding to ${conns.length} connection(s)`);
  for (let i = 0; i < conns.length; i++) {
    try {
      const jsonStr = JSON.stringify(event);
      log.debug(`[bridge] Sending to connection #${i}: ${jsonStr}`);
      conns[i].send(jsonStr);
      log.debug(`[bridge] Successfully sent to connection #${i}`);
    } catch (e) {
      log.debug(`[bridge] Error forwarding request to connection #${i}:`, e);
    }
  }
};
emitter.on(bus_request_stream, bus_to_ws_forwarder_listener);

const ws_handler: uWS.WebSocketBehavior<unknown> = {
  open: (ws) => {
    log.debug("A WebSocket connected!");
    conns.push(ws);
    log.debug(`Active connections: ${conns.length}`);
  },
  message: (ws, message, isBinary) => {
    const decoder = new TextDecoder();
    const str = decoder.decode(message);
    const json = JSON.parse(str);
    log.debug(`[ws] received from Extension`, json);
    
    if (json.__event) {
      log.debug(`[ws] Message contains __event: ${json.__event}`);
    } else if (json.type) {
      log.debug(`[ws] Message type: ${json.type}`);
    }
    
    emitter.emit(bus_reply_stream, json);
  },
  close: (ws, code, message) => {
    log.debug(`WebSocket closed with code ${code}`);
    
    const index = conns.indexOf(ws);
    if (index !== -1) {
      conns.splice(index, 1);
      log.debug(`Connection removed. Remaining connections: ${conns.length}`);
    } else {
      log.debug(`Connection not found in connections list`);
    }
  },
};

const app = uWS
  .App()
  .ws("/*", ws_handler)
  .listen(3333, (token) => {
    if (token) {
      log.debug("Listening to port 3333");
    }
  });

// Create server instance
const server = new McpServer({
  name: "drawio-mcp-server",
  version: "1.0.1",
  capabilities: {
    resources: {},
    tools: {},
  },
});

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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.debug("Draw.io MCP Server running on stdio");
}

main().catch((error) => {
  log.debug("Fatal error in main():", error);
  process.exit(1);
});
