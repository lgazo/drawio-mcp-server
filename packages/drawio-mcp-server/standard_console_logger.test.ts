import { jest } from "@jest/globals";
import { create_logger } from "./standard_console_logger.js";

describe("create_logger", () => {
  let originalConsoleLog: typeof console.log;
  let originalConsoleDebug: typeof console.debug;
  let mockConsoleLog: jest.Mock;
  let mockConsoleDebug: jest.Mock;

  beforeEach(() => {
    // Save original console methods
    originalConsoleLog = console.log;
    originalConsoleDebug = console.debug;
    // Create mocks
    mockConsoleLog = jest.fn();
    mockConsoleDebug = jest.fn();
    console.log = mockConsoleLog;
    console.debug = mockConsoleDebug;
  });

  afterEach(() => {
    // Restore original console methods
    console.log = originalConsoleLog;
    console.debug = originalConsoleDebug;
    // Clear all mocks
    jest.clearAllMocks();
  });

  it("should return a Logger object with log and debug methods", () => {
    const logger = create_logger();

    expect(logger).toBeDefined();
    expect(typeof logger.log).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });

  it("log method should call console.log with message and data", () => {
    const logger = create_logger();
    const testMessage = "test message";
    const testData = { key: "value" };
    const testLevel = "info";

    logger.log(testLevel, testMessage, testData);

    expect(mockConsoleLog).toHaveBeenCalledTimes(1);
    expect(mockConsoleLog).toHaveBeenCalledWith(testMessage, testData);
  });

  it("debug method should call console.debug with message and data", () => {
    const logger = create_logger();
    const testMessage = "debug message";
    const testData = { debug: true };

    logger.debug(testMessage, testData);

    expect(mockConsoleDebug).toHaveBeenCalledTimes(1);
    expect(mockConsoleDebug).toHaveBeenCalledWith(testMessage, testData);
  });

  it("should handle no additional data parameters", () => {
    const logger = create_logger();
    const testMessage = "message without data";

    logger.log("warn", testMessage);
    expect(mockConsoleLog).toHaveBeenCalledWith(testMessage);

    mockConsoleLog.mockClear();

    logger.debug(testMessage);
    expect(mockConsoleDebug).toHaveBeenCalledWith(testMessage);
  });

  it("should ignore level parameter in log method", () => {
    const logger = create_logger();
    const testMessage = "test message";
    const testData = { key: "value" };

    // Test with different levels - should all behave the same
    logger.log("error", testMessage, testData);
    expect(mockConsoleLog).toHaveBeenCalledWith(testMessage, testData);

    mockConsoleLog.mockClear();

    logger.log("warn", testMessage, testData);
    expect(mockConsoleLog).toHaveBeenCalledWith(testMessage, testData);

    mockConsoleLog.mockClear();

    logger.log("info", testMessage, testData);
    expect(mockConsoleLog).toHaveBeenCalledWith(testMessage, testData);
  });

  it("should handle multiple data parameters", () => {
    const logger = create_logger();
    const testMessage = "message with multiple data";
    const data1 = { key1: "value1" };
    const data2 = { key2: "value2" };
    const data3 = "string data";

    logger.log("info", testMessage, data1, data2, data3);
    expect(mockConsoleLog).toHaveBeenCalledWith(
      testMessage,
      data1,
      data2,
      data3,
    );

    mockConsoleLog.mockClear();

    logger.debug(testMessage, data1, data2, data3);
    expect(mockConsoleDebug).toHaveBeenCalledWith(
      testMessage,
      data1,
      data2,
      data3,
    );
  });
});
