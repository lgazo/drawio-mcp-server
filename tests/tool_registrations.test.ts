import { describe, it, expect, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools, TOOL_NAMES, TOOL_DEFINITIONS } from "../src/tool_registrations.js";
import { createToolHandlerFactory, type ToolHandlerMap, type ToolLogger } from "../src/tool_handler.js";

describe("TOOL_NAMES", () => {
  it("should contain 32 tool name entries", () => {
    const entries = Object.entries(TOOL_NAMES);
    expect(entries.length).toBe(32);
  });

  it("should have all values in kebab-case format", () => {
    const kebabCasePattern = /^[a-z]+(-[a-z]+)*$/;
    for (const [key, value] of Object.entries(TOOL_NAMES)) {
      expect(value, `${key} should be kebab-case`).toMatch(kebabCasePattern);
    }
  });

  it("should have unique tool names (no duplicates)", () => {
    const values = Object.values(TOOL_NAMES);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });

  it("should have UPPER_SNAKE_CASE keys", () => {
    const upperSnakePattern = /^[A-Z]+(_[A-Z]+)*$/;
    for (const key of Object.keys(TOOL_NAMES)) {
      expect(key, `key "${key}" should be UPPER_SNAKE_CASE`).toMatch(upperSnakePattern);
    }
  });
});

describe("TOOL_DEFINITIONS", () => {
  it("should contain 32 tool definitions", () => {
    expect(TOOL_DEFINITIONS.length).toBe(32);
  });

  it("should have matching TOOL_NAMES derived from TOOL_DEFINITIONS", () => {
    for (const def of TOOL_DEFINITIONS) {
      expect(TOOL_NAMES[def.key], `TOOL_NAMES.${def.key} should equal "${def.name}"`).toBe(def.name);
    }
  });

  it("should have non-empty descriptions for all tools", () => {
    for (const def of TOOL_DEFINITIONS) {
      expect(def.description.length, `${def.name} description should be non-empty`).toBeGreaterThan(0);
    }
  });

  it("should have inputSchema when hasArgs is true and not when false", () => {
    for (const def of TOOL_DEFINITIONS) {
      if (def.hasArgs) {
        expect("inputSchema" in def, `${def.name} should have inputSchema when hasArgs is true`).toBe(true);
      } else {
        expect("inputSchema" in def, `${def.name} should not have inputSchema when hasArgs is false`).toBe(false);
      }
    }
  });
});

describe("registerTools", () => {
  function createMockToolHandler(): ReturnType<typeof createToolHandlerFactory> {
    const log: ToolLogger = { debug: vi.fn() };
    const handlerMap: ToolHandlerMap = {};

    // Populate the handler map with stubs for every tool name
    for (const name of Object.values(TOOL_NAMES)) {
      handlerMap[name] = vi.fn().mockResolvedValue({
        content: [{ type: "text" as const, text: "{}" }],
      });
    }

    return createToolHandlerFactory(handlerMap, log);
  }

  it("should register all tools without throwing", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const createToolHandler = createMockToolHandler();

    expect(() => registerTools(server, createToolHandler)).not.toThrow();
  });

  it("should register exactly 32 tools", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const registerSpy = vi.spyOn(server, "registerTool");
    const createToolHandler = createMockToolHandler();

    registerTools(server, createToolHandler);

    expect(registerSpy.mock.calls.length).toBe(32);
  });

  it("should register tools with names matching TOOL_NAMES values", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const registerSpy = vi.spyOn(server, "registerTool");
    const createToolHandler = createMockToolHandler();

    registerTools(server, createToolHandler);

    const registeredNames = registerSpy.mock.calls.map(call => call[0]);
    const expectedNames = Object.values(TOOL_NAMES);

    for (const name of expectedNames) {
      expect(registeredNames, `tool "${name}" should be registered`).toContain(name);
    }
  });

  it("should register each tool with a description", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const registerSpy = vi.spyOn(server, "registerTool");
    const createToolHandler = createMockToolHandler();

    registerTools(server, createToolHandler);

    for (const call of registerSpy.mock.calls) {
      const toolName = call[0] as string;
      const config = call[1] as { description?: string };
      expect(config.description, `tool "${toolName}" should have a description`).toBeDefined();
      expect(config.description!.length, `tool "${toolName}" description should be non-empty`).toBeGreaterThan(0);
    }
  });
});
