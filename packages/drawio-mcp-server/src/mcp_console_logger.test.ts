import { jest } from "@jest/globals";
import { create_logger } from "./mcp_console_logger.js";

describe("create_logger", () => {
  let originalConsoleError: typeof console.error;
  let mockConsoleError: jest.Mock;

  beforeEach(() => {
    // Save original console.error
    originalConsoleError = console.error;
    // Create mock for console.error
    mockConsoleError = jest.fn();
    console.error = mockConsoleError;
  });

  afterEach(() => {
    // Restore original console.error
    console.error = originalConsoleError;
    // Clear all mocks
    jest.clearAllMocks();
  });

  it("should return a Logger object with log and debug methods", () => {
    const logger = create_logger();

    expect(logger).toBeDefined();
    expect(typeof logger.log).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });

  it("log method should call console.error with message and data", () => {
    const logger = create_logger();
    const testMessage = "test message";
    const testData = { key: "value" };
    const testLevel = "info";

    logger.log(testLevel, testMessage, testData);

    expect(mockConsoleError).toHaveBeenCalledTimes(1);
    expect(mockConsoleError).toHaveBeenCalledWith(
      `${testLevel.toUpperCase()}: ${testMessage}`,
      testData,
    );
  });

  it("debug method should call console.error with message and data", () => {
    const logger = create_logger();
    const testMessage = "debug message";
    const testData = { debug: true };

    logger.debug(testMessage, testData);

    expect(mockConsoleError).toHaveBeenCalledTimes(1);
    expect(mockConsoleError).toHaveBeenCalledWith(
      `DEBUG: ${testMessage}`,
      testData,
    );
  });

  it("should handle no additional data parameters", () => {
    const logger = create_logger();
    const testMessage = "message without data";

    logger.log("warn", testMessage);
    expect(mockConsoleError).toHaveBeenCalledWith(`WARN: ${testMessage}`);

    mockConsoleError.mockClear();

    logger.debug(testMessage);
    expect(mockConsoleError).toHaveBeenCalledWith(`DEBUG: ${testMessage}`);
  });

  it("should handle multiple data parameters", () => {
    const logger = create_logger();
    const testMessage = "message with multiple data";
    const data1 = { key1: "value1" };
    const data2 = { key2: "value2" };
    const data3 = "string data";

    logger.log("error", testMessage, data1, data2, data3);
    expect(mockConsoleError).toHaveBeenCalledWith(
      `ERROR: ${testMessage}`,
      data1,
      data2,
      data3,
    );

    mockConsoleError.mockClear();

    logger.debug(testMessage, data1, data2, data3);
    expect(mockConsoleError).toHaveBeenCalledWith(
      `DEBUG: ${testMessage}`,
      data1,
      data2,
      data3,
    );
  });
});
