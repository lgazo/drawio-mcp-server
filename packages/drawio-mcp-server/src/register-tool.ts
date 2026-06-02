import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { stripSchemaRecursively } from "./strip-schema.js";

/**
 * Wraps an `McpServer` so that the `tools/list` response strips the
 * `$schema` key from every tool's `inputSchema` and `outputSchema`.
 *
 * Why this is necessary:
 *
 * - The MCP SDK lazily serializes tool schemas: it stores the Zod object
 *   verbatim at registration time and only converts to JSON Schema
 *   (via `zodToJsonSchema` / `z4mini.toJSONSchema`) when a client issues
 *   `tools/list`. The conversion emits a top-level
 *   `"$schema": "http://json-schema.org/draft-07/schema#"` field.
 *
 * - Claude Code's MCP ingest layer can't tolerate the `$` character in
 *   schema keys (Anthropic's parameter-name regex is
 *   `^[a-zA-Z0-9_.-]{1,64}$`). When `$schema` is present, the entire
 *   `properties` object is dropped, leaving tools effectively schemaless.
 *   The user can see the tool name but the LLM has no way to know which
 *   arguments to send, so calls fail at runtime.
 *
 * - A previous attempt at this fix tried to strip `$schema` from the
 *   stored `_registeredTools[name].inputSchema` via `setTimeout(0)`.
 *   That was a no-op against modern SDKs because the stored value at
 *   that point is the raw Zod object (which doesn't have `$schema`).
 *   The `$schema` key is added by `toJsonSchemaCompat` at serialization
 *   time, not at registration time.
 *
 * The fix here intercepts the `tools/list` request handler that the SDK
 * registers internally on the first `server.tool(...)` call, and wraps
 * it so the response runs through `stripSchemaRecursively` before being
 * returned to the client.
 */
export function createServerWithSchemaStripping(server: McpServer): McpServer {
  const originalTool = server.tool.bind(server);
  let patched = false;

  server.tool = function tool(...args: Parameters<typeof originalTool>) {
    const result = originalTool(...args);
    // The SDK lazily registers the tools/list handler on the first
    // server.tool() call (via setToolRequestHandlers). After that call
    // returns, the handler is in place and we can wrap it.
    if (!patched) {
      patched = true;
      patchToolsListHandler(server);
    }
    return result;
  } as typeof originalTool;

  return server;
}

function patchToolsListHandler(server: McpServer): void {
  // The McpServer wraps an inner Server (the low-level protocol layer).
  // Its `_requestHandlers` Map stores per-method handlers keyed by the
  // method name literal (e.g. "tools/list").
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const innerServer = (server as any).server;
  const handlers: Map<string, (...args: unknown[]) => unknown> | undefined =
    innerServer?._requestHandlers;
  if (!handlers) {
    // SDK internals changed; fail closed (no-op) so we don't crash the
    // server. The tools will still work but schemas will leak `$schema`.
    return;
  }

  const original = handlers.get("tools/list");
  if (!original) {
    return;
  }

  handlers.set("tools/list", async (...callArgs: unknown[]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: any = await original(...callArgs);
    if (response && Array.isArray(response.tools)) {
      response.tools = response.tools.map(stripToolSchemas);
    }
    return response;
  });
}

interface ToolDefinition {
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  [key: string]: unknown;
}

function stripToolSchemas(tool: ToolDefinition): ToolDefinition {
  const next: ToolDefinition = { ...tool };
  if (next.inputSchema) {
    next.inputSchema = stripSchemaRecursively(next.inputSchema);
  }
  if (next.outputSchema) {
    next.outputSchema = stripSchemaRecursively(next.outputSchema);
  }
  return next;
}
