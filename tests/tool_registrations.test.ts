/**
 * Tests for MCP tool registration.
 * Verifies TOOL_NAMES constants, TOOL_DEFINITIONS structure,
 * and that registerTools wires all 32 tools to the MCP server.
 */
import { describe, it } from "@std/testing/bdd";
import { assertEquals, assert, assertExists } from "@std/assert";
import { spy } from "@std/testing/mock";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools, TOOL_NAMES, TOOL_DEFINITIONS } from "../src/tool_registrations.ts";
import { createToolHandlerFactory, type ToolHandlerMap, type ToolLogger } from "../src/tool_handler.ts";

describe("TOOL_NAMES", () => {
  it("should contain 26 tool name entries", () => {
    const entries = Object.entries(TOOL_NAMES);
    assertEquals(entries.length, 26);
  });

  it("should have all values in kebab-case format", () => {
    const kebabCasePattern = /^[a-z]+(-[a-z]+)*$/;
    for (const [key, value] of Object.entries(TOOL_NAMES)) {
      assert(kebabCasePattern.test(value), `${key} should be kebab-case, got "${value}"`);
    }
  });

  it("should have unique tool names (no duplicates)", () => {
    const values = Object.values(TOOL_NAMES);
    const uniqueValues = new Set(values);
    assertEquals(uniqueValues.size, values.length);
  });

  it("should have UPPER_SNAKE_CASE keys", () => {
    const upperSnakePattern = /^[A-Z]+(_[A-Z]+)*$/;
    for (const key of Object.keys(TOOL_NAMES)) {
      assert(upperSnakePattern.test(key), `key "${key}" should be UPPER_SNAKE_CASE`);
    }
  });
});

describe("TOOL_DEFINITIONS", () => {
  it("should contain 26 tool definitions", () => {
    assertEquals(TOOL_DEFINITIONS.length, 26);
  });

  it("should have matching TOOL_NAMES derived from TOOL_DEFINITIONS", () => {
    for (const def of TOOL_DEFINITIONS) {
      assertEquals(
        TOOL_NAMES[def.key],
        def.name,
        `TOOL_NAMES.${def.key} should equal "${def.name}"`,
      );
    }
  });

  it("should have non-empty descriptions for all tools", () => {
    for (const def of TOOL_DEFINITIONS) {
      assert(def.description.length > 0, `${def.name} description should be non-empty`);
    }
  });

  it("should have inputSchema when hasArgs is true and not when false", () => {
    for (const def of TOOL_DEFINITIONS) {
      if (def.hasArgs) {
        assert("inputSchema" in def, `${def.name} should have inputSchema when hasArgs is true`);
      } else {
        assert(!("inputSchema" in def), `${def.name} should not have inputSchema when hasArgs is false`);
      }
    }
  });
});

describe("registerTools", () => {
  /** Create a mock tool handler factory with stubs for every tool name. */
  function createMockToolHandler(): ReturnType<typeof createToolHandlerFactory> {
    const debugSpy = spy((..._args: any[]) => {});
    const log: ToolLogger = { debug: debugSpy };
    const handlerMap: ToolHandlerMap = {};

    // Populate the handler map with stubs for every tool name
    for (const name of Object.values(TOOL_NAMES)) {
      handlerMap[name] = spy((_args: any) =>
        Promise.resolve({
          content: [{ type: "text" as const, text: "{}" }],
        }),
      );
    }

    return createToolHandlerFactory(handlerMap, log);
  }

  it("should register all tools without throwing", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const createToolHandler = createMockToolHandler();

    // Should not throw
    registerTools(server, createToolHandler);
  });

  it("should register exactly 26 tools", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const registerSpy = spy(server, "registerTool");
    const createToolHandler = createMockToolHandler();

    registerTools(server, createToolHandler);

    assertEquals(registerSpy.calls.length, 26);
    registerSpy.restore();
  });

  it("should register tools with names matching TOOL_NAMES values", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const registerSpy = spy(server, "registerTool");
    const createToolHandler = createMockToolHandler();

    registerTools(server, createToolHandler);

    const registeredNames = registerSpy.calls.map((call: any) => call.args[0]);
    const expectedNames = Object.values(TOOL_NAMES);

    for (const name of expectedNames) {
      assert(registeredNames.includes(name), `tool "${name}" should be registered`);
    }
    registerSpy.restore();
  });

  it("should register each tool with a description", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const registerSpy = spy(server, "registerTool");
    const createToolHandler = createMockToolHandler();

    registerTools(server, createToolHandler);

    for (const call of registerSpy.calls) {
      const toolName = call.args[0] as string;
      const config = call.args[1] as { description?: string };
      assertExists(config.description, `tool "${toolName}" should have a description`);
      assert(config.description!.length > 0, `tool "${toolName}" description should be non-empty`);
    }
    registerSpy.restore();
  });
});
