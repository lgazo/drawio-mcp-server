import { expect } from "@jest/globals";

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import type { RealEnvironmentContext } from "./types.js";

export async function callToolJson<T>(
  context: RealEnvironmentContext,
  name: string,
  args: Record<string, unknown>,
) {
  const result = (await context.client.callTool({
    name,
    arguments: args,
  })) as CallToolResult;

  expect(result.isError).not.toBe(true);

  const content = result.content as Array<{ text?: string; type: string }>;
  expect(content[0]?.type).toBe("text");

  return {
    raw: result,
    payload: JSON.parse(String(content[0]?.text ?? "{}")) as T,
  };
}

export async function callToolRaw(
  context: RealEnvironmentContext,
  name: string,
  args: Record<string, unknown>,
) {
  const result = (await context.client.callTool({
    name,
    arguments: args,
  })) as CallToolResult;

  expect(result.isError).not.toBe(true);

  return result;
}
