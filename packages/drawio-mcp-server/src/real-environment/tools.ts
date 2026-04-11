import { expect } from "@jest/globals";

import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import type { RealEnvironmentContext } from "./types.js";

const PAGE_SCOPED_TOOL_NAMES = new Set([
  "get-selected-cell",
  "add-rectangle",
  "add-edge",
  "delete-cell-by-id",
  "add-cell-of-shape",
  "set-cell-shape",
  "set-cell-data",
  "edit-cell",
  "edit-edge",
  "list-paged-model",
  "list-layers",
  "set-active-layer",
  "move-cell-to-layer",
  "get-active-layer",
  "create-layer",
  "set-cell-parent",
  "export-diagram",
  "import-diagram",
]);

function withDefaultTargetPage(
  name: string,
  args: Record<string, unknown>,
): Record<string, unknown> {
  if (!PAGE_SCOPED_TOOL_NAMES.has(name)) {
    return args;
  }

  if (name === "import-diagram" && args.mode === "new-page") {
    return args;
  }

  if (args.target_page) {
    return args;
  }

  return {
    target_page: { index: 0 },
    ...args,
  };
}

export async function callClientToolJson<T>(
  client: Client,
  name: string,
  args: Record<string, unknown>,
) {
  const result = (await client.callTool({
    name,
    arguments: withDefaultTargetPage(name, args),
  })) as CallToolResult;

  expect(result.isError).not.toBe(true);

  const content = result.content as Array<{ text?: string; type: string }>;
  expect(content[0]?.type).toBe("text");

  return {
    raw: result,
    payload: JSON.parse(String(content[0]?.text ?? "{}")) as T,
  };
}

export async function callToolJson<T>(
  context: RealEnvironmentContext,
  name: string,
  args: Record<string, unknown>,
) {
  return callClientToolJson<T>(context.client, name, args);
}

export async function callClientToolRaw(
  client: Client,
  name: string,
  args: Record<string, unknown>,
) {
  const result = (await client.callTool({
    name,
    arguments: withDefaultTargetPage(name, args),
  })) as CallToolResult;

  expect(result.isError).not.toBe(true);

  return result;
}

export async function callToolRaw(
  context: RealEnvironmentContext,
  name: string,
  args: Record<string, unknown>,
) {
  return callClientToolRaw(context.client, name, args);
}
