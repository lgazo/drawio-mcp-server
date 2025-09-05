import { jest } from "@jest/globals";
import { create_logger } from "./mcp_server_logger.js";

describe("create_logger", () => {
  let mock_send_logging_message: jest.Mock;
  let mock_set_request_handler: jest.Mock;
  let mock_server: {
    server: {
      sendLoggingMessage: typeof mock_send_logging_message;
      setRequestHandler: typeof mock_set_request_handler;
    };
  };

  beforeEach(() => {
    mock_send_logging_message = jest.fn();
    mock_set_request_handler = jest.fn();
    mock_server = {
      server: {
        sendLoggingMessage: mock_send_logging_message,
        setRequestHandler: mock_set_request_handler,
      },
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return a Logger object with log and debug methods", () => {
    const logger = create_logger(mock_server as any);

    expect(logger).toBeDefined();
    expect(typeof logger.log).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });

  it("log should call sendLoggingMessage with level and data (message is ignored by implementation)", () => {
    const logger = create_logger(mock_server as any);
    const test_message = "test message";
    const test_data = { key: "value" };
    const test_level = "info";

    logger.log(test_level, test_message, test_data);

    expect(mock_send_logging_message).toHaveBeenCalledTimes(1);
    expect(mock_send_logging_message).toHaveBeenCalledWith({
      level: "info",
      logger: ".",
      data: { message: test_message, data: [test_data] },
    });
  });

  it("debug should call sendLoggingMessage with debug level and data", async () => {
    const logger = create_logger(mock_server as any);
    const test_message = "debug message";
    const test_data = { debug: true };

    const set_level_handler = mock_set_request_handler.mock.calls[1][1] as any;
    await set_level_handler({
      method: "logging/setLevel",
      params: { level: "debug" },
    });
    mock_send_logging_message.mockClear();

    logger.debug(test_message, test_data);

    expect(mock_send_logging_message).toHaveBeenCalledTimes(1);
    expect(mock_send_logging_message).toHaveBeenCalledWith({
      level: "debug",
      logger: ".",
      data: { message: test_message, data: [test_data] },
    });
  });

  it("should handle no additional data parameters", async () => {
    const logger = create_logger(mock_server as any);
    const test_message = "message without data";

    logger.log("warning", test_message);
    expect(mock_send_logging_message).toHaveBeenCalledWith({
      level: "warning",
      logger: ".",
      data: { message: test_message, data: [] },
    });

    const set_level_handler = mock_set_request_handler.mock.calls[1][1] as any;
    await set_level_handler({
      method: "logging/setLevel",
      params: { level: "debug" },
    });
    mock_send_logging_message.mockClear();

    logger.debug(test_message);
    expect(mock_send_logging_message).toHaveBeenCalledWith({
      level: "debug",
      logger: ".",
      data: { message: test_message, data: [] },
    });
  });

  it("should handle multiple data parameters", async () => {
    const logger = create_logger(mock_server as any);
    const test_message = "message with multiple data";
    const data1 = { key1: "value1" };
    const data2 = { key2: "value2" };
    const data3 = "string data";

    logger.log("error", test_message, data1, data2, data3);
    expect(mock_send_logging_message).toHaveBeenCalledWith({
      level: "error",
      logger: ".",
      data: { message: test_message, data: [data1, data2, data3] },
    });

    const set_level_handler = mock_set_request_handler.mock.calls[1][1] as any;
    await set_level_handler({
      method: "logging/setLevel",
      params: { level: "debug" },
    });
    mock_send_logging_message.mockClear();

    logger.debug(test_message, data1, data2, data3);
    expect(mock_send_logging_message).toHaveBeenCalledWith({
      level: "debug",
      logger: ".",
      data: { message: test_message, data: [data1, data2, data3] },
    });
  });
  it("should not log and print error if an invalid log level is used directly", () => {
    const logger = create_logger(mock_server as any);

    const console_error_spy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    logger.log("invalid_level", "this should not be logged");

    expect(console_error_spy).toHaveBeenCalledWith(
      "Internal Error: Invalid log level used: invalid_level",
    );
    expect(mock_send_logging_message).not.toHaveBeenCalled();

    console_error_spy.mockRestore();
  });

  it("should log a warning if logging/setLevel receives an invalid log level", async () => {
    create_logger(mock_server as any);

    const set_level_handler = mock_set_request_handler.mock.calls[1][1] as any;
    await set_level_handler({
      method: "logging/setLevel",
      params: { level: "not_a_level" },
    });

    expect(mock_send_logging_message).toHaveBeenCalledWith({
      level: "warning",
      logger: "logging",
      data: {
        message: "Invalid log level 'not_a_level' received",
      },
    });
  });

  it("should support valid per-logger setLevels, and emit debug message", async () => {
    create_logger(mock_server as any);

    const set_levels_handler = mock_set_request_handler.mock.calls[0][1] as any;
    const set_level_handler = mock_set_request_handler.mock.calls[1][1] as any;

    await set_level_handler({
      method: "logging/setLevel",
      params: { level: "debug" },
    });
    mock_send_logging_message.mockClear();

    await set_levels_handler({
      method: "logging/setLevels",
      params: { levels: { app: "error" } },
    });

    expect(mock_send_logging_message).toHaveBeenCalledWith({
      level: "debug",
      logger: "logging",
      data: {
        message: "Set log level for logger 'app' to 'error'",
      },
    });
  });

  it("should reset per-logger level to default when null is provided", async () => {
    create_logger(mock_server as any);

    const set_levels_handler = mock_set_request_handler.mock.calls[0][1] as any;
    const set_level_handler = mock_set_request_handler.mock.calls[1][1] as any;

    await set_level_handler({
      method: "logging/setLevel",
      params: { level: "debug" },
    });
    mock_send_logging_message.mockClear();

    await set_levels_handler({
      method: "logging/setLevels",
      params: { levels: { app: "warning" } },
    });

    await set_levels_handler({
      method: "logging/setLevels",
      params: { levels: { app: null } },
    });

    expect(
      mock_send_logging_message.mock.calls.some((call) => {
        const arg = call[0] as any;
        return (
          arg.level === "debug" &&
          arg.logger === "logging" &&
          arg.data &&
          arg.data.message === "Reset log level for logger: app"
        );
      }),
    ).toBe(true);
  });

  it("should log a warning for invalid per-logger level in setLevels", async () => {
    create_logger(mock_server as any);

    const set_levels_handler = mock_set_request_handler.mock.calls[0][1] as any;
    const set_level_handler = mock_set_request_handler.mock.calls[1][1] as any;

    await set_level_handler({
      method: "logging/setLevel",
      params: { level: "debug" },
    });
    mock_send_logging_message.mockClear();

    await set_levels_handler({
      method: "logging/setLevels",
      params: { levels: { "my.logger": "invalid" } },
    });

    expect(mock_send_logging_message).toHaveBeenCalledWith({
      level: "warning",
      logger: "logging",
      data: {
        message: "Invalid log level 'invalid' received for logger 'my.logger'",
      },
    });
  });
});
