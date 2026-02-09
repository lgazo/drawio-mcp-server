/**
 * Tests for the tool handler factory.
 * Verifies handler dispatch, structured errors for unknown tools,
 * logging (tool prefix padding, duration, payload size), and helper functions.
 */
import { describe, it, beforeEach } from "@std/testing/bdd";
import { assertEquals, assert, assertExists } from "@std/assert";
import { spy, assertSpyCalls, type Spy } from "@std/testing/mock";
import {
  createToolHandlerFactory,
  formatBytes,
  timestamp,
  type ToolLogger,
  type ToolHandlerMap,
} from "../src/tool_handler.ts";

describe("createToolHandlerFactory", () => {
  let debugSpy: Spy;
  let log: ToolLogger;
  const mockExtra = { sessionId: "test-session", requestId: "req-1" };

  beforeEach(() => {
    debugSpy = spy((..._args: any[]) => {});
    log = { debug: debugSpy };
  });

  describe("formatBytes", () => {
    it("should format small values in KB", () => {
      assertEquals(formatBytes(500), "0.49 KB");
    });

    it("should format exact kilobytes", () => {
      assertEquals(formatBytes(2048), "2.00 KB");
    });

    it("should format large values in KB", () => {
      assertEquals(formatBytes(1048576), "1024.00 KB");
    });
  });

  describe("timestamp", () => {
    it("should return an ISO 8601 string", () => {
      const ts = timestamp();
      assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(ts));
    });

    it("should return a recent timestamp", () => {
      const before = Date.now();
      const ts = timestamp();
      const after = Date.now();
      const parsed = new Date(ts).getTime();
      assert(parsed >= before);
      assert(parsed <= after);
    });
  });

  describe("handler dispatch", () => {
    it("should dispatch to the correct handler with args when hasArgs=true", async () => {
      const mockResult = {
        content: [{ type: "text" as const, text: '{"success":true}' }],
      };
      const handlerSpy = spy((_args: any) => Promise.resolve(mockResult));
      const handlerMap: ToolHandlerMap = { "my-tool": handlerSpy };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("my-tool", true);
      const result = await handler({ x: 100, y: 200 }, mockExtra);

      assertSpyCalls(handlerSpy, 1);
      assertEquals(handlerSpy.calls[0].args[0], { x: 100, y: 200 });
      assertEquals(result, mockResult);
    });

    it("should pass empty args when hasArgs is false", async () => {
      const mockResult = {
        content: [{ type: "text" as const, text: '{"data":"ok"}' }],
      };
      const handlerSpy = spy((_args: any) => Promise.resolve(mockResult));
      const handlerMap: ToolHandlerMap = { "no-args-tool": handlerSpy };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("no-args-tool");
      const result = await handler(mockExtra);

      assertSpyCalls(handlerSpy, 1);
      assertEquals(handlerSpy.calls[0].args[0], {});
      assertEquals(result, mockResult);
    });

    it("should return structured error for unknown tool name", async () => {
      const createToolHandler = createToolHandlerFactory({}, log);
      const handler = createToolHandler("nonexistent-tool", true);
      const result = await handler({}, mockExtra);

      assertEquals(result.isError, true);
      assertEquals(result.content[0].type, "text");
      const parsed = JSON.parse(result.content[0].text);
      assert(parsed.error.includes("nonexistent-tool"));
      assert(parsed.error.includes("not available"));
    });

    it("should return structured error for unknown tool without args", async () => {
      const createToolHandler = createToolHandlerFactory({}, log);
      const handler = createToolHandler("missing-tool");
      const result = await handler(mockExtra);

      assertEquals(result.isError, true);
      const parsed = JSON.parse(result.content[0].text);
      assert(parsed.error.includes("missing-tool"));
    });
  });

  describe("logging", () => {
    it("should log tool call with session and request IDs", async () => {
      const mockResult = {
        content: [{ type: "text" as const, text: "{}" }],
      };
      const handlerSpy = spy((_args: any) => Promise.resolve(mockResult));
      const handlerMap: ToolHandlerMap = { "logged-tool": handlerSpy };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("logged-tool", true);
      await handler({}, mockExtra);

      const firstCallMsg = debugSpy.calls[0].args[0] as string;
      assert(!firstCallMsg.includes("session="));
      assert(firstCallMsg.includes("req=req-1"));
    });

    it("should handle missing sessionId without logging session", async () => {
      const mockResult = {
        content: [{ type: "text" as const, text: "{}" }],
      };
      const handlerSpy = spy((_args: any) => Promise.resolve(mockResult));
      const handlerMap: ToolHandlerMap = { "tool": handlerSpy };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("tool", true);
      await handler({}, { requestId: "r1" });

      const firstCallMsg = debugSpy.calls[0].args[0] as string;
      assert(!firstCallMsg.includes("session="));
      assert(firstCallMsg.includes("req=r1"));
    });

    it("should handle undefined extra without logging session", async () => {
      const mockResult = {
        content: [{ type: "text" as const, text: "{}" }],
      };
      const handlerSpy = spy((_args: any) => Promise.resolve(mockResult));
      const handlerMap: ToolHandlerMap = { "tool": handlerSpy };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("tool");
      await handler(undefined);

      const firstCallMsg = debugSpy.calls[0].args[0] as string;
      assert(!firstCallMsg.includes("session="));
    });

    it("should log the called line without args by default", async () => {
      const mockResult = {
        content: [{ type: "text" as const, text: "{}" }],
      };
      const handlerSpy = spy((_args: any) => Promise.resolve(mockResult));
      const handlerMap: ToolHandlerMap = { "args-tool": handlerSpy };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("args-tool", true);
      await handler({ x: 100, text: "hello" }, mockExtra);

      const calledCall = debugSpy.calls.find(
        (c: any) => (c.args[0] as string).includes("called"),
      );
      assertExists(calledCall);
      assertEquals(calledCall!.args.length, 1);
    });

    it("should log called line without args when hasArgs is false", async () => {
      const mockResult = {
        content: [{ type: "text" as const, text: "{}" }],
      };
      const handlerSpy = spy((_args: any) => Promise.resolve(mockResult));
      const handlerMap: ToolHandlerMap = { "no-args": handlerSpy };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("no-args");
      await handler(mockExtra);

      const calledCall = debugSpy.calls.find(
        (c: any) => (c.args[0] as string).includes("called"),
      );
      assertExists(calledCall);
      assertEquals(calledCall!.args.length, 1);
    });

    it("should log 'ok' with payload size for successful handler results", async () => {
      const successResult = {
        content: [{ type: "text" as const, text: "{}" }],
      };
      const handlerSpy = spy((_args: any) => Promise.resolve(successResult));
      const handlerMap: ToolHandlerMap = { "ok-tool": handlerSpy };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("ok-tool", true);
      await handler({}, mockExtra);

      const debugMessages = debugSpy.calls.map((c: any) => c.args[0] as string);
      const resultLog = debugMessages.find((msg: string) => msg.includes("ok in"));
      assertExists(resultLog);
      assert(resultLog!.includes("[tool:ok-tool]"));
      assert(/[\d.]+ KB/.test(resultLog!));
    });

    it("should log 'error' with payload size for handler results with isError=true", async () => {
      const errorResult = {
        content: [{ type: "text" as const, text: '{"error":"fail"}' }],
        isError: true,
      };
      const handlerSpy = spy((_args: any) => Promise.resolve(errorResult));
      const handlerMap: ToolHandlerMap = { "error-tool": handlerSpy };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("error-tool", true);
      await handler({}, mockExtra);

      const debugMessages = debugSpy.calls.map((c: any) => c.args[0] as string);
      const resultLog = debugMessages.find((msg: string) => msg.includes("error in"));
      assertExists(resultLog);
      assert(resultLog!.includes("[tool:error-tool]"));
      assert(/[\d.]+ KB/.test(resultLog!));
    });

    it("should log 'not found' for unknown tools", async () => {
      const createToolHandler = createToolHandlerFactory({}, log);
      const handler = createToolHandler("missing", true);
      await handler({}, mockExtra);

      const hasNotFound = debugSpy.calls.some(
        (c: any) => typeof c.args[0] === "string" && (c.args[0] as string).includes("not found"),
      );
      assert(hasNotFound);
    });

    it("should format payload size in KB for larger payloads", async () => {
      const largeText = "x".repeat(2048);
      const largeResult = {
        content: [{ type: "text" as const, text: largeText }],
      };
      const handlerSpy = spy((_args: any) => Promise.resolve(largeResult));
      const handlerMap: ToolHandlerMap = { "large-tool": handlerSpy };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("large-tool", true);
      await handler({}, mockExtra);

      const debugMessages = debugSpy.calls.map((c: any) => c.args[0] as string);
      const resultLog = debugMessages.find((msg: string) => msg.includes("ok in"));
      assertExists(resultLog);
      assert(/[\d.]+ KB/.test(resultLog!));
    });

    it("should log 0.00 KB when content has no text property", async () => {
      const imageResult = {
        content: [{ type: "image" as const, data: "abc", mimeType: "image/png" }],
      };
      const handlerSpy = spy((_args: any) => Promise.resolve(imageResult));
      const handlerMap: ToolHandlerMap = { "img-tool": handlerSpy };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("img-tool", true);
      await handler({}, mockExtra);

      const debugMessages = debugSpy.calls.map((c: any) => c.args[0] as string);
      const resultLog = debugMessages.find((msg: string) => msg.includes("ok in"));
      assertExists(resultLog);
      assert(resultLog!.includes("0.00 KB"));
    });

    it("should include duration in success log", async () => {
      const mockResult = {
        content: [{ type: "text" as const, text: "{}" }],
      };
      const handlerSpy = spy((_args: any) => Promise.resolve(mockResult));
      const handlerMap: ToolHandlerMap = { "timed-tool": handlerSpy };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("timed-tool", true);
      await handler({}, mockExtra);

      const debugMessages = debugSpy.calls.map((c: any) => c.args[0] as string);
      const resultLog = debugMessages.find((msg: string) => msg.includes("ms"));
      assertExists(resultLog);
      assert(/\d+ms/.test(resultLog!));
    });

    it("should pad tool prefix to align status words", async () => {
      const mockResult = {
        content: [{ type: "text" as const, text: "{}" }],
      };
      const handlerSpy = spy((_args: any) => Promise.resolve(mockResult));
      const handlerMap: ToolHandlerMap = { "a": handlerSpy };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("a", true);
      await handler({}, mockExtra);

      const debugMessages = debugSpy.calls.map((c: any) => c.args[0] as string);
      const calledLog = debugMessages.find((msg: string) => msg.includes("called"));
      const okLog = debugMessages.find((msg: string) => msg.includes("ok in"));
      // Both lines should start with an ISO timestamp followed by the padded tool prefix
      assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[tool:a\]\s+called/.test(calledLog!));
      assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[tool:a\]\s+ok in/.test(okLog!));
      // "called" and "ok in" should start at the same column (aligned by padEnd)
      assertEquals(calledLog!.indexOf("called"), okLog!.indexOf("ok in"));
    });
  });
});
