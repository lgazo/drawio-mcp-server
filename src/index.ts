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
  log.debug(`[bridge] received; passing to #${conns.length}`, event);
  for (let i = 0; i < conns.length; i++) {
    try {
      conns[i].send(JSON.stringify(event));
    } catch (e) {
      log.debug(`[bridge] error forwarding request at conn = ${i}`);
    }
  }
};
emitter.on(bus_request_stream, bus_to_ws_forwarder_listener);

const ws_handler: uWS.WebSocketBehavior<unknown> = {
  open: (ws) => {
    log.debug("A WebSocket connected!");
    conns.push(ws);
  },
  message: (ws, message, isBinary) => {
    // ws.send(message, isBinary);
    const decoder = new TextDecoder();
    const str = decoder.decode(message);
    const json = JSON.parse(str);
    log.debug(`[ws] received from Extension`, json);
    // const event_name = message.__event;
    emitter.emit(bus_reply_stream, json);
  },
  close: (ws, code, message) => {
    log.debug("WebSocket closed");
    //todo remove conn
  },
};

const app = uWS
  .App()
  .ws("/*", ws_handler)
  .listen(3000, (token) => {
    if (token) {
      log.debug("Listening to port 3000");
    }
  });

// Create server instance
const server = new McpServer({
  name: "drawio-mcp-server",
  version: "1.0.0",
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

server.tool(
  "get-selected-cell",
  "This tool allows you to retrieve selected cell on the current page of a Draw.io diagram. The response is a JSON containing attributes of the cell.",
  {},
  // GSC.tool(context),
  default_tool("get-selected-cell", context),
);

server.tool(
  "add-rectangle",
  "This tool allows you to add new Rectangle object on the current page of a Draw.io diagram. It accepts multiple optional input parameter.",
  {
    x: z
      .number()
      .optional()
      .describe("X-axis position of the Rectangle cell")
      .default(100),
    y: z
      .number()
      .optional()
      .describe("Y-axis position of the Rectangle cell")
      .default(100),
    width: z
      .number()
      .optional()
      .describe("Width of the Rectangle cell")
      .default(200),
    height: z
      .number()
      .optional()
      .describe("Height of the Rectangle cell")
      .default(100),
    text: z
      .string()
      .optional()
      .describe("Text content placed inside of the Rectangle cell")
      .default("New Cell"),
    style: z
      .string()
      .optional()
      .describe(
        "Semi-colon separated list of Draw.io visual styles, in the form of `key=value`. Example: `whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#666666;`",
      )
      .default("whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;"),
  },
  // GSC.tool(context),
  default_tool("add-rectangle", context),
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
