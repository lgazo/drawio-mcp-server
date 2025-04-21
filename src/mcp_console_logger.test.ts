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
    expect(mockConsoleError).toHaveBeenCalledWith(testMessage, testData);
  });

  it("debug method should call console.error with message and data", () => {
    const logger = create_logger();
    const testMessage = "debug message";
    const testData = { debug: true };

    logger.debug(testMessage, testData);

    expect(mockConsoleError).toHaveBeenCalledTimes(1);
    expect(mockConsoleError).toHaveBeenCalledWith(testMessage, testData);
  });

  it("should handle undefined data parameter", () => {
    const logger = create_logger();
    const testMessage = "message without data";

    logger.log("warn", testMessage);
    expect(mockConsoleError).toHaveBeenCalledWith(testMessage, undefined);

    mockConsoleError.mockClear();

    logger.debug(testMessage);
    expect(mockConsoleError).toHaveBeenCalledWith(testMessage, undefined);
  });
});
