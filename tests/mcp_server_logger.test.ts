/**
 * Tests for the MCP server logger.
 * Verifies log levels, sendLoggingMessage dispatch, setLevel / setLevels handlers,
 * invalid level handling, and per-logger level management.
 */
import { describe, it, beforeEach } from "@std/testing/bdd";
import { assertEquals, assert, assertExists } from "@std/assert";
import { spy, stub, assertSpyCalls, assertSpyCallArgs, type Spy } from "@std/testing/mock";
import { create_logger } from "../src/loggers/mcp_server_logger.ts";

describe("create_logger", () => {
  let mockSendLoggingMessage: Spy;
  let mockSetRequestHandler: Spy;
  let mockServer: {
    server: {
      sendLoggingMessage: Spy;
      setRequestHandler: Spy;
    };
  };

  beforeEach(() => {
    mockSendLoggingMessage = spy();
    mockSetRequestHandler = spy();
    mockServer = {
      server: {
        sendLoggingMessage: mockSendLoggingMessage,
        setRequestHandler: mockSetRequestHandler,
      },
    };
  });

  it("should return a Logger object with log and debug methods", () => {
    const logger = create_logger(mockServer as any);

    assert(logger !== undefined);
    assertEquals(typeof logger.log, "function");
    assertEquals(typeof logger.debug, "function");
  });

  it("log should call sendLoggingMessage with level and data (message is ignored by implementation)", () => {
    const logger = create_logger(mockServer as any);
    const testMessage = "test message";
    const testData = { key: "value" };
    const testLevel = "info";

    logger.log(testLevel, testMessage, testData);

    assertSpyCalls(mockSendLoggingMessage, 1);
    assertSpyCallArgs(mockSendLoggingMessage, 0, [{
      level: "info",
      logger: ".",
      data: { message: testMessage, data: [testData] },
    }]);
  });

  it("debug should call sendLoggingMessage with debug level and data", async () => {
    const logger = create_logger(mockServer as any);
    const testMessage = "debug message";
    const testData = { debug: true };

    // Enable debug logging via the setLevel handler (second registered handler)
    const setLevelHandler = mockSetRequestHandler.calls[1].args[1] as any;
    await setLevelHandler({
      method: "logging/setLevel",
      params: { level: "debug" },
    });

    // Track calls after enabling debug
    const callsBefore = mockSendLoggingMessage.calls.length;

    logger.debug(testMessage, testData);

    assertEquals(mockSendLoggingMessage.calls.length, callsBefore + 1);
    const lastCall = mockSendLoggingMessage.calls[mockSendLoggingMessage.calls.length - 1];
    assertEquals(lastCall.args[0], {
      level: "debug",
      logger: ".",
      data: { message: testMessage, data: [testData] },
    });
  });

  it("should handle no additional data parameters", async () => {
    const logger = create_logger(mockServer as any);
    const testMessage = "message without data";

    logger.log("warning", testMessage);
    assertSpyCallArgs(mockSendLoggingMessage, 0, [{
      level: "warning",
      logger: ".",
      data: { message: testMessage, data: [] },
    }]);

    // Enable debug logging
    const setLevelHandler = mockSetRequestHandler.calls[1].args[1] as any;
    await setLevelHandler({
      method: "logging/setLevel",
      params: { level: "debug" },
    });

    logger.debug(testMessage);

    const lastCall = mockSendLoggingMessage.calls[mockSendLoggingMessage.calls.length - 1];
    assertEquals(lastCall.args[0], {
      level: "debug",
      logger: ".",
      data: { message: testMessage, data: [] },
    });
  });

  it("should handle multiple data parameters", async () => {
    const logger = create_logger(mockServer as any);
    const testMessage = "message with multiple data";
    const data1 = { key1: "value1" };
    const data2 = { key2: "value2" };
    const data3 = "string data";

    logger.log("error", testMessage, data1, data2, data3);
    assertSpyCallArgs(mockSendLoggingMessage, 0, [{
      level: "error",
      logger: ".",
      data: { message: testMessage, data: [data1, data2, data3] },
    }]);

    // Enable debug logging
    const setLevelHandler = mockSetRequestHandler.calls[1].args[1] as any;
    await setLevelHandler({
      method: "logging/setLevel",
      params: { level: "debug" },
    });

    logger.debug(testMessage, data1, data2, data3);

    const lastCall = mockSendLoggingMessage.calls[mockSendLoggingMessage.calls.length - 1];
    assertEquals(lastCall.args[0], {
      level: "debug",
      logger: ".",
      data: { message: testMessage, data: [data1, data2, data3] },
    });
  });

  it("should not log and print error if an invalid log level is used directly", () => {
    const logger = create_logger(mockServer as any);

    const consoleErrorStub = stub(console, "error", () => {});
    try {
      logger.log("invalid_level", "this should not be logged");

      assertSpyCalls(consoleErrorStub, 1);
      assertSpyCallArgs(consoleErrorStub, 0, [
        "Internal Error: Invalid log level used: invalid_level",
      ]);
      // sendLoggingMessage should not have been called for the invalid log call
      // (only prior calls from create_logger setup, if any)
      const invalidLevelCalls = mockSendLoggingMessage.calls.filter(
        (c: any) => c.args[0]?.data?.message === "this should not be logged",
      );
      assertEquals(invalidLevelCalls.length, 0);
    } finally {
      consoleErrorStub.restore();
    }
  });

  it("should log a warning if logging/setLevel receives an invalid log level", async () => {
    create_logger(mockServer as any);

    const setLevelHandler = mockSetRequestHandler.calls[1].args[1] as any;
    await setLevelHandler({
      method: "logging/setLevel",
      params: { level: "not_a_level" },
    });

    // Find the warning call
    const warningCall = mockSendLoggingMessage.calls.find(
      (c: any) => c.args[0]?.level === "warning" && c.args[0]?.data?.message?.includes("Invalid log level"),
    );
    assertExists(warningCall);
    assertEquals(warningCall!.args[0], {
      level: "warning",
      logger: "logging",
      data: {
        message: "Invalid log level 'not_a_level' received",
      },
    });
  });

  it("should support valid per-logger setLevels, and emit debug message", async () => {
    create_logger(mockServer as any);

    const setLevelsHandler = mockSetRequestHandler.calls[0].args[1] as any;
    const setLevelHandler = mockSetRequestHandler.calls[1].args[1] as any;

    // Enable debug logging first
    await setLevelHandler({
      method: "logging/setLevel",
      params: { level: "debug" },
    });
    const callsBefore = mockSendLoggingMessage.calls.length;

    await setLevelsHandler({
      method: "logging/setLevels",
      params: { levels: { app: "error" } },
    });

    // Find the debug message about setting the level
    const debugCall = mockSendLoggingMessage.calls.find(
      (c: any, i: number) =>
        i >= callsBefore &&
        c.args[0]?.level === "debug" &&
        c.args[0]?.data?.message?.includes("Set log level for logger 'app'"),
    );
    assertExists(debugCall);
    assertEquals(debugCall!.args[0], {
      level: "debug",
      logger: "logging",
      data: {
        message: "Set log level for logger 'app' to 'error'",
      },
    });
  });

  it("should reset per-logger level to default when null is provided", async () => {
    create_logger(mockServer as any);

    const setLevelsHandler = mockSetRequestHandler.calls[0].args[1] as any;
    const setLevelHandler = mockSetRequestHandler.calls[1].args[1] as any;

    // Enable debug logging
    await setLevelHandler({
      method: "logging/setLevel",
      params: { level: "debug" },
    });

    await setLevelsHandler({
      method: "logging/setLevels",
      params: { levels: { app: "warning" } },
    });

    await setLevelsHandler({
      method: "logging/setLevels",
      params: { levels: { app: null } },
    });

    // Find the reset message
    const resetCall = mockSendLoggingMessage.calls.find(
      (c: any) =>
        c.args[0]?.level === "debug" &&
        c.args[0]?.logger === "logging" &&
        c.args[0]?.data?.message === "Reset log level for logger: app",
    );
    assertExists(resetCall);
  });

  it("should log a warning for invalid per-logger level in setLevels", async () => {
    create_logger(mockServer as any);

    const setLevelsHandler = mockSetRequestHandler.calls[0].args[1] as any;
    const setLevelHandler = mockSetRequestHandler.calls[1].args[1] as any;

    // Enable debug logging
    await setLevelHandler({
      method: "logging/setLevel",
      params: { level: "debug" },
    });

    await setLevelsHandler({
      method: "logging/setLevels",
      params: { levels: { "my.logger": "invalid" } },
    });

    // Find the warning message
    const warningCall = mockSendLoggingMessage.calls.find(
      (c: any) =>
        c.args[0]?.level === "warning" &&
        c.args[0]?.data?.message?.includes("Invalid log level 'invalid'"),
    );
    assertExists(warningCall);
    assertEquals(warningCall!.args[0], {
      level: "warning",
      logger: "logging",
      data: {
        message: "Invalid log level 'invalid' received for logger 'my.logger'",
      },
    });
  });
});
