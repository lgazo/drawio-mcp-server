/**
 * Tests for the MCP console logger.
 * Verifies that log() and debug() correctly delegate to console.error
 * with proper level prefixes and spread data arguments.
 */
import { describe, it, beforeEach, afterEach } from "@std/testing/bdd";
import { assertEquals, assert } from "@std/assert";
import { spy, assertSpyCalls, assertSpyCallArgs, type Spy } from "@std/testing/mock";
import { create_logger } from "../src/loggers/mcp_console_logger.ts";

describe("create_logger", () => {
  let originalConsoleError: typeof console.error;
  let mockConsoleError: Spy;

  beforeEach(() => {
    // Save original console.error and replace with a spy
    originalConsoleError = console.error;
    mockConsoleError = spy();
    console.error = mockConsoleError;
  });

  afterEach(() => {
    // Restore original console.error
    console.error = originalConsoleError;
  });

  it("should return a Logger object with log and debug methods", () => {
    const logger = create_logger();

    assert(logger !== undefined);
    assertEquals(typeof logger.log, "function");
    assertEquals(typeof logger.debug, "function");
  });

  it("log method should call console.error with message and data", () => {
    const logger = create_logger();
    const testMessage = "test message";
    const testData = { key: "value" };
    const testLevel = "info";

    logger.log(testLevel, testMessage, testData);

    assertSpyCalls(mockConsoleError, 1);
    assertSpyCallArgs(mockConsoleError, 0, [
      `${testLevel.toUpperCase()}: ${testMessage}`,
      testData,
    ]);
  });

  it("debug method should call console.error with message and data", () => {
    const logger = create_logger();
    const testMessage = "debug message";
    const testData = { debug: true };

    logger.debug(testMessage, testData);

    assertSpyCalls(mockConsoleError, 1);
    assertSpyCallArgs(mockConsoleError, 0, [
      `DEBUG: ${testMessage}`,
      testData,
    ]);
  });

  it("should handle no additional data parameters", () => {
    const logger = create_logger();
    const testMessage = "message without data";

    logger.log("warn", testMessage);
    assertSpyCallArgs(mockConsoleError, 0, [`WARN: ${testMessage}`]);

    // Reset by creating a fresh spy
    mockConsoleError = spy();
    console.error = mockConsoleError;

    logger.debug(testMessage);
    assertSpyCallArgs(mockConsoleError, 0, [`DEBUG: ${testMessage}`]);
  });

  it("should handle multiple data parameters", () => {
    const logger = create_logger();
    const testMessage = "message with multiple data";
    const data1 = { key1: "value1" };
    const data2 = { key2: "value2" };
    const data3 = "string data";

    logger.log("error", testMessage, data1, data2, data3);
    assertSpyCallArgs(mockConsoleError, 0, [
      `ERROR: ${testMessage}`,
      data1,
      data2,
      data3,
    ]);

    // Reset by creating a fresh spy
    mockConsoleError = spy();
    console.error = mockConsoleError;

    logger.debug(testMessage, data1, data2, data3);
    assertSpyCallArgs(mockConsoleError, 0, [
      `DEBUG: ${testMessage}`,
      data1,
      data2,
      data3,
    ]);
  });
});
