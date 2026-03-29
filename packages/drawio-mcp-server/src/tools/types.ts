import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { Context } from "../types.js";

export type ToolRegistrar = (server: McpServer, context: Context) => void;
