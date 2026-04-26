import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { stripSchemaRecursively } from "./strip-schema.js";

/**
 * Creates a wrapped version of McpServer.tool that automatically strips
 * `$schema` from the inputSchema after tool registration.
 *
 * The `$schema` key injected by zodToJsonSchema causes Claude Code to silently
 * drop tools because the `$` character fails Anthropic's validation regex
 * `^[a-zA-Z0-9_.-]{1,64}$`.
 *
 * @param server - The McpServer instance to wrap
 * @returns The same server instance, but with a modified tool() method
 */
export function createServerWithSchemaStripping(server: McpServer): McpServer {
  // Store original tool method
  const originalTool = server.tool.bind(server);

  // Override tool method
  server.tool = function tool(
    name: string,
    description: string,
    inputSchema: Record<string, any>,
    handler: any,
  ) {
    // Call original tool method
    const result = originalTool(name, description, inputSchema, handler);

    // Strip $schema from the registered tool's inputSchema
    // This must be done after registration
    setTimeout(() => {
      const registeredTool = (server as any)._registeredTools?.get(name);
      if (registeredTool?.inputSchema) {
        registeredTool.inputSchema = stripSchemaRecursively(
          registeredTool.inputSchema,
        );
      }
    }, 0);

    return result;
  } as typeof originalTool;

  return server;
}
