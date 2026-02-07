import { describe, it, expect, vi, beforeEach } from "vitest";
import { createToolHandlerFactory, formatBytes, timestamp, type ToolLogger, type ToolHandlerMap } from "../src/tool_handler.js";

describe("createToolHandlerFactory", () => {
  let log: ToolLogger;
  const mockExtra = { sessionId: "test-session", requestId: "req-1" };

  beforeEach(() => {
    log = { debug: vi.fn() };
  });

  describe("formatBytes", () => {
    it("should format small values in KB", () => {
      expect(formatBytes(500)).toBe("0.49 KB");
    });

    it("should format exact kilobytes", () => {
      expect(formatBytes(2048)).toBe("2.00 KB");
    });

    it("should format large values in KB", () => {
      expect(formatBytes(1048576)).toBe("1024.00 KB");
    });
  });

  describe("timestamp", () => {
    it("should return an ISO 8601 string", () => {
      const ts = timestamp();
      expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it("should return a recent timestamp", () => {
      const before = Date.now();
      const ts = timestamp();
      const after = Date.now();
      const parsed = new Date(ts).getTime();
      expect(parsed).toBeGreaterThanOrEqual(before);
      expect(parsed).toBeLessThanOrEqual(after);
    });
  });

  describe("handler dispatch", () => {
    it("should dispatch to the correct handler with args when hasArgs=true", async () => {
      const mockResult = {
        content: [{ type: "text" as const, text: '{"success":true}' }],
      };
      const handlerMap: ToolHandlerMap = {
        "my-tool": vi.fn().mockResolvedValue(mockResult),
      };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("my-tool", true);
      const result = await handler({ x: 100, y: 200 }, mockExtra);

      expect(handlerMap["my-tool"]).toHaveBeenCalledWith({ x: 100, y: 200 });
      expect(result).toBe(mockResult);
    });

    it("should pass empty args when hasArgs is false", async () => {
      const mockResult = {
        content: [{ type: "text" as const, text: '{"data":"ok"}' }],
      };
      const handlerMap: ToolHandlerMap = {
        "no-args-tool": vi.fn().mockResolvedValue(mockResult),
      };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("no-args-tool");
      const result = await handler(mockExtra);

      expect(handlerMap["no-args-tool"]).toHaveBeenCalledWith({});
      expect(result).toBe(mockResult);
    });

    it("should return structured error for unknown tool name", async () => {
      const createToolHandler = createToolHandlerFactory({}, log);
      const handler = createToolHandler("nonexistent-tool", true);
      const result = await handler({}, mockExtra);

      expect(result.isError).toBe(true);
      expect(result.content[0].type).toBe("text");
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain("nonexistent-tool");
      expect(parsed.error).toContain("not available");
    });

    it("should return structured error for unknown tool without args", async () => {
      const createToolHandler = createToolHandlerFactory({}, log);
      const handler = createToolHandler("missing-tool");
      const result = await handler(mockExtra);

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain("missing-tool");
    });
  });

  describe("logging", () => {
    it("should log tool call with session and request IDs", async () => {
      const mockResult = {
        content: [{ type: "text" as const, text: "{}" }],
      };
      const handlerMap: ToolHandlerMap = {
        "logged-tool": vi.fn().mockResolvedValue(mockResult),
      };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("logged-tool", true);
      await handler({}, mockExtra);

      const debugCalls = (log.debug as ReturnType<typeof vi.fn>).mock.calls;
      const firstCallArgs = debugCalls[0];
      expect(firstCallArgs[0]).not.toContain("session=");
      expect(firstCallArgs[0]).toContain("req=req-1");
    });

    it("should handle missing sessionId without logging session", async () => {
      const mockResult = {
        content: [{ type: "text" as const, text: "{}" }],
      };
      const handlerMap: ToolHandlerMap = {
        "tool": vi.fn().mockResolvedValue(mockResult),
      };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("tool", true);
      await handler({}, { requestId: "r1" });

      const debugCalls = (log.debug as ReturnType<typeof vi.fn>).mock.calls;
      const firstCallMsg = debugCalls[0][0];
      expect(firstCallMsg).not.toContain("session=");
      expect(firstCallMsg).toContain("req=r1");
    });

    it("should handle undefined extra without logging session", async () => {
      const mockResult = {
        content: [{ type: "text" as const, text: "{}" }],
      };
      const handlerMap: ToolHandlerMap = {
        "tool": vi.fn().mockResolvedValue(mockResult),
      };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("tool");
      await handler(undefined);

      const debugCalls = (log.debug as ReturnType<typeof vi.fn>).mock.calls;
      const firstCallMsg = debugCalls[0][0];
      expect(firstCallMsg).not.toContain("session=");
    });

    it("should log input args as JSON in the called log line", async () => {
      const mockResult = {
        content: [{ type: "text" as const, text: "{}" }],
      };
      const handlerMap: ToolHandlerMap = {
        "args-tool": vi.fn().mockResolvedValue(mockResult),
      };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("args-tool", true);
      await handler({ x: 100, text: "hello" }, mockExtra);

      const debugCalls = (log.debug as ReturnType<typeof vi.fn>).mock.calls;
      const calledCall = debugCalls.find(c => (c[0] as string).includes("called"));
      expect(calledCall).toBeDefined();
      expect(calledCall![1]).toBe(JSON.stringify({ x: 100, text: "hello" }));
    });

    it("should log empty args when hasArgs is false", async () => {
      const mockResult = {
        content: [{ type: "text" as const, text: "{}" }],
      };
      const handlerMap: ToolHandlerMap = {
        "no-args": vi.fn().mockResolvedValue(mockResult),
      };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("no-args");
      await handler(mockExtra);

      const debugCalls = (log.debug as ReturnType<typeof vi.fn>).mock.calls;
      const calledCall = debugCalls.find(c => (c[0] as string).includes("called"));
      expect(calledCall).toBeDefined();
      expect(calledCall![1]).toBe("{}");
    });

    it("should log 'ok' with payload size for successful handler results", async () => {
      const successResult = {
        content: [{ type: "text" as const, text: "{}" }],
      };
      const handlerMap: ToolHandlerMap = {
        "ok-tool": vi.fn().mockResolvedValue(successResult),
      };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("ok-tool", true);
      await handler({}, mockExtra);

      const debugCalls = (log.debug as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]);
      const resultLog = debugCalls.find((msg: string) => msg.includes("ok in"));
      expect(resultLog).toBeDefined();
      expect(resultLog).toContain("[tool:ok-tool]");
      expect(resultLog).toMatch(/[\d.]+ KB/);
    });

    it("should log 'error' with payload size for handler results with isError=true", async () => {
      const errorResult = {
        content: [{ type: "text" as const, text: '{"error":"fail"}' }],
        isError: true,
      };
      const handlerMap: ToolHandlerMap = {
        "error-tool": vi.fn().mockResolvedValue(errorResult),
      };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("error-tool", true);
      await handler({}, mockExtra);

      const debugCalls = (log.debug as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]);
      const resultLog = debugCalls.find((msg: string) => msg.includes("error in"));
      expect(resultLog).toBeDefined();
      expect(resultLog).toContain("[tool:error-tool]");
      expect(resultLog).toMatch(/[\d.]+ KB/);
    });

    it("should log 'not found' for unknown tools", async () => {
      const createToolHandler = createToolHandlerFactory({}, log);
      const handler = createToolHandler("missing", true);
      await handler({}, mockExtra);

      expect(log.debug).toHaveBeenCalledWith(
        expect.stringContaining("not found"),
      );
    });

    it("should format payload size in KB for larger payloads", async () => {
      const largeText = "x".repeat(2048);
      const largeResult = {
        content: [{ type: "text" as const, text: largeText }],
      };
      const handlerMap: ToolHandlerMap = {
        "large-tool": vi.fn().mockResolvedValue(largeResult),
      };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("large-tool", true);
      await handler({}, mockExtra);

      const debugCalls = (log.debug as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]);
      const resultLog = debugCalls.find((msg: string) => msg.includes("ok in"));
      expect(resultLog).toBeDefined();
      expect(resultLog).toMatch(/[\d.]+ KB/);
    });

    it("should include duration in success log", async () => {
      const mockResult = {
        content: [{ type: "text" as const, text: "{}" }],
      };
      const handlerMap: ToolHandlerMap = {
        "timed-tool": vi.fn().mockResolvedValue(mockResult),
      };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("timed-tool", true);
      await handler({}, mockExtra);

      const debugCalls = (log.debug as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]);
      const resultLog = debugCalls.find((msg: string) => msg.includes("ms"));
      expect(resultLog).toBeDefined();
      expect(resultLog).toMatch(/\d+ms/);
    });

    it("should pad tool prefix to align status words", async () => {
      const mockResult = {
        content: [{ type: "text" as const, text: "{}" }],
      };
      const handlerMap: ToolHandlerMap = {
        "a": vi.fn().mockResolvedValue(mockResult),
      };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("a", true);
      await handler({}, mockExtra);

      const debugCalls = (log.debug as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]);
      const calledLog = debugCalls.find((msg: string) => msg.includes("called"));
      const okLog = debugCalls.find((msg: string) => msg.includes("ok in"));
      // Both lines should start with an ISO timestamp followed by the padded tool prefix
      expect(calledLog).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[tool:a\]\s+called/);
      expect(okLog).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[tool:a\]\s+ok in/);
      // "called" and "ok in" should start at the same column (aligned by padEnd)
      expect(calledLog!.indexOf("called")).toBe(okLog!.indexOf("ok in"));
    });
  });
});
