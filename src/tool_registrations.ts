/**
 * MCP tool registrations — loops over TOOL_DEFINITIONS to register all tools.
 *
 * Tool metadata (name, description, inputSchema, hasArgs) lives in
 * tool_definitions.ts; this file just wires them to the MCP server.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { createToolHandlerFactory } from "./tool_handler.ts";
import { TOOL_DEFINITIONS } from "./tool_definitions.ts";

export { TOOL_NAMES, TOOL_DEFINITIONS } from "./tool_definitions.ts";
export type { ToolDefinition, ToolDefinitionWithArgs, ToolDefinitionWithoutArgs } from "./tool_definitions.ts";

/** The handler factory function type returned by createToolHandlerFactory */
type CreateToolHandler = ReturnType<typeof createToolHandlerFactory>;

/**
 * Register all MCP tools on the given server.
 *
 * Iterates TOOL_DEFINITIONS and calls server.registerTool() for each entry,
 * branching on hasArgs to satisfy the overloaded signatures.
 */
export function registerTools(server: McpServer, createToolHandler: CreateToolHandler): void {
  for (const tool of TOOL_DEFINITIONS) {
    if (tool.hasArgs) {
      server.registerTool(
        tool.name,
        { description: tool.description, inputSchema: tool.inputSchema },
        createToolHandler(tool.name, true),
      );
    } else {
      server.registerTool(
        tool.name,
        { description: tool.description },
        createToolHandler(tool.name),
      );
    }
  }
}
