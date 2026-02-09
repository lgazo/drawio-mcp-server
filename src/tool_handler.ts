/**
 * Factory for creating MCP tool handlers with logging.
 * Extracted for testability and reuse.
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Minimal logger interface for tool handler logging.
 */
export interface ToolLogger {
  debug: (...args: any[]) => void;
}

/**
 * Map of tool names to their handler functions.
 * Handlers may be synchronous or asynchronous — the factory `await`s
 * the result regardless, which is safe for both.
 */
export type ToolHandlerMap = Record<string, (args: any) => CallToolResult | Promise<CallToolResult>>;

/**
 * Creates a factory function that produces MCP tool handlers with logging.
 *
 * Each returned handler:
 * 1. Extracts request metadata from the `extra` parameter
 * 2. Logs the tool invocation
 * 3. Dispatches to the matching handler in `handlerMap`
 * 4. Logs success/error and duration
 * 5. Returns a structured error if the tool name is not found
 *
 * @param handlerMap - Map of tool names to handler functions
 * @param log - Logger instance for debug output
 * @returns A `createToolHandler` function for registering tools
 */
export function formatBytes(bytes: number): string {
  return `${(bytes / 1024).toFixed(2)} KB`;
}

export function timestamp(): string {
  return new Date().toISOString();
}

export function createToolHandlerFactory(handlerMap: ToolHandlerMap, log: ToolLogger) {
  function createToolHandler(toolName: string, hasArgs: true): (args: any, extra: any) => Promise<any>;
  function createToolHandler(toolName: string, hasArgs?: false): (extra: any) => Promise<any>;
  function createToolHandler(toolName: string, hasArgs = false) {
    return async (...params: any[]) => {
      const extra = hasArgs ? params[1] : params[0];
      const args = hasArgs ? params[0] : {};
      const requestId = extra?.requestId;
      const prefix = `[tool:${toolName}]`.padEnd(30);
      //log.debug(`${timestamp()} ${prefix} called (req=${requestId})`, JSON.stringify(args));  // good for troubleshooting
      log.debug(`${timestamp()} ${prefix} called (req=${requestId})`);

      const handler = handlerMap[toolName];
      if (handler) {
        const start = Date.now();
        const result = await handler(args);
        const duration = Date.now() - start;
        const isError = result.isError ?? false;
        // Measure payload from the already-serialized text content to avoid re-serializing
        const textContent = result.content?.[0];
        const payloadLength = textContent && "text" in textContent ? textContent.text.length : 0;
        const payloadSize = formatBytes(payloadLength);
        log.debug(`${timestamp()} ${prefix} ${isError ? "error" : "ok"} in ${duration}ms, ${payloadSize} (req=${requestId})`);
        return result;
      }
      log.debug(`${timestamp()} ${prefix} not found (req=${requestId})`);
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: `Tool ${toolName} not available` }) }],
        isError: true,
      };
    };
  }

  return createToolHandler;
}
