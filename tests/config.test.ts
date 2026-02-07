import {
  parseHttpPortValue,
  shouldShowHelp,
  parseConfig,
  buildConfig,
  parseTransports,
  parseLoggerType,
} from "../src/config.js";

describe("parseHttpPortValue", () => {
  test("valid port returns number", () => {
    expect(parseHttpPortValue("8080")).toBe(8080);
  });

  test("undefined input returns Error", () => {
    expect(parseHttpPortValue(undefined)).toBeInstanceOf(Error);
  });

  test("non-numeric string returns Error", () => {
    expect(parseHttpPortValue("abc")).toBeInstanceOf(Error);
  });

  test("out of range returns Error", () => {
    expect(parseHttpPortValue("70000")).toBeInstanceOf(Error);
  });
});

describe("parseTransports", () => {
  test("returns default when undefined", () => {
    expect(parseTransports(undefined)).toEqual(["stdio"]);
  });

  test("parses single transport", () => {
    expect(parseTransports(["stdio"])).toEqual(["stdio"]);
  });

  test("parses comma separated list", () => {
    expect(parseTransports(["stdio,http"])).toEqual(["stdio", "http"]);
  });

  test("deduplicates transports", () => {
    expect(parseTransports(["stdio", "stdio"])).toEqual(["stdio"]);
  });

  test("rejects empty string", () => {
    const result = parseTransports([""]);
    expect(result).toBeInstanceOf(Error);
  });

  test("rejects unknown transport", () => {
    const result = parseTransports(["foo"]);
    expect(result).toBeInstanceOf(Error);
  });
});

describe("parseLoggerType", () => {
  test("returns default for undefined", () => {
    expect(parseLoggerType(undefined)).toBe("console");
  });

  test("returns default for empty string", () => {
    expect(parseLoggerType("")).toBe("console");
  });

  test("returns default for whitespace-only string", () => {
    expect(parseLoggerType("   ")).toBe("console");
  });

  test("accepts console", () => {
    expect(parseLoggerType("console")).toBe("console");
  });

  test("accepts mcp_server", () => {
    expect(parseLoggerType("mcp_server")).toBe("mcp_server");
  });

  test("is case-insensitive", () => {
    expect(parseLoggerType("MCP_SERVER")).toBe("mcp_server");
  });

  test("trims whitespace", () => {
    expect(parseLoggerType("  console  ")).toBe("console");
  });

  test("rejects invalid value", () => {
    const result = parseLoggerType("invalid");
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toContain("Invalid logger type");
  });
});

describe("shouldShowHelp", () => {
  test("returns true for --help", () => {
    expect(shouldShowHelp(["--help"])).toBe(true);
  });

  test("returns true for -h", () => {
    expect(shouldShowHelp(["-h"])).toBe(true);
  });

  test("returns false for no help flag", () => {
    expect(shouldShowHelp(["--http-port", "8080"])).toBe(false);
  });

  test("returns false for empty args", () => {
    expect(shouldShowHelp([])).toBe(false);
  });
});

describe("parseConfig", () => {
  const DEFAULT_RESULT = {
    httpPort: 8080,
    transports: ["stdio"],
    loggerType: "console",
    azureIconLibraryPath: undefined,
  };

  test("no args returns default config", () => {
    expect(parseConfig([])).toEqual(DEFAULT_RESULT);
  });

  test("--http-port flag sets custom port", () => {
    expect(parseConfig(["--http-port", "4242"])).toEqual({
      ...DEFAULT_RESULT,
      httpPort: 4242,
    });
  });

  test("help flag is ignored in config parsing", () => {
    expect(parseConfig(["--help"])).toEqual(DEFAULT_RESULT);
  });

  test("invalid port returns Error", () => {
    const result = parseConfig(["--http-port", "abc"]);
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toContain("Invalid port number");
  });

  test("missing http port value returns Error", () => {
    const result = parseConfig(["--http-port"]);
    expect(result).toBeInstanceOf(Error);
  });

  test("out of range port returns Error", () => {
    const result = parseConfig(["--http-port", "70000"]);
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toContain("Invalid port number");
  });

  test("last http-port flag wins", () => {
    expect(parseConfig(["--http-port", "4000", "--http-port", "5000"])).toEqual(
      {
        ...DEFAULT_RESULT,
        httpPort: 5000,
      },
    );
  });

  test("sets single transport", () => {
    expect(parseConfig(["--transport", "stdio"])).toEqual(DEFAULT_RESULT);
  });

  test("sets multiple transports", () => {
    expect(parseConfig(["--transport", "stdio,http"])).toEqual({
      ...DEFAULT_RESULT,
      transports: ["stdio", "http"],
    });
  });

  test("rejects unknown transport", () => {
    const result = parseConfig(["--transport", "foo"]);
    expect(result).toBeInstanceOf(Error);
  });

  test("missing transport value returns Error", () => {
    const result = parseConfig(["--transport"]);
    expect(result).toBeInstanceOf(Error);
  });

  // ── Environment variable tests ──

  test("reads HTTP_PORT from env when no CLI flag", () => {
    const result = parseConfig([], { HTTP_PORT: "3000" });
    expect(result).toEqual({
      ...DEFAULT_RESULT,
      httpPort: 3000,
    });
  });

  test("CLI --http-port takes precedence over env HTTP_PORT", () => {
    const result = parseConfig(["--http-port", "5000"], { HTTP_PORT: "3000" });
    expect(result).toEqual({
      ...DEFAULT_RESULT,
      httpPort: 5000,
    });
  });

  test("reads TRANSPORT from env when no CLI flag", () => {
    const result = parseConfig([], { TRANSPORT: "http" });
    expect(result).toEqual({
      ...DEFAULT_RESULT,
      transports: ["http"],
    });
  });

  test("CLI --transport takes precedence over env TRANSPORT", () => {
    const result = parseConfig(["--transport", "stdio"], { TRANSPORT: "http" });
    expect(result).toEqual(DEFAULT_RESULT);
  });

  test("reads LOGGER_TYPE from env", () => {
    const result = parseConfig([], { LOGGER_TYPE: "mcp_server" });
    expect(result).toEqual({
      ...DEFAULT_RESULT,
      loggerType: "mcp_server",
    });
  });

  test("invalid LOGGER_TYPE in env returns Error", () => {
    const result = parseConfig([], { LOGGER_TYPE: "invalid" });
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toContain("Invalid logger type");
  });

  test("reads AZURE_ICON_LIBRARY_PATH from env", () => {
    const result = parseConfig([], { AZURE_ICON_LIBRARY_PATH: "/custom/path.xml" });
    expect(result).toEqual({
      ...DEFAULT_RESULT,
      azureIconLibraryPath: "/custom/path.xml",
    });
  });

  test("trims whitespace from AZURE_ICON_LIBRARY_PATH", () => {
    const result = parseConfig([], { AZURE_ICON_LIBRARY_PATH: "  /path.xml  " });
    expect(result).toEqual({
      ...DEFAULT_RESULT,
      azureIconLibraryPath: "/path.xml",
    });
  });

  test("treats empty AZURE_ICON_LIBRARY_PATH as undefined", () => {
    const result = parseConfig([], { AZURE_ICON_LIBRARY_PATH: "" });
    expect(result).toEqual(DEFAULT_RESULT);
  });

  test("treats whitespace-only AZURE_ICON_LIBRARY_PATH as undefined", () => {
    const result = parseConfig([], { AZURE_ICON_LIBRARY_PATH: "   " });
    expect(result).toEqual(DEFAULT_RESULT);
  });

  test("combines CLI and env settings", () => {
    const result = parseConfig(
      ["--http-port", "9000"],
      { TRANSPORT: "http", LOGGER_TYPE: "mcp_server", AZURE_ICON_LIBRARY_PATH: "/icons.xml" },
    );
    expect(result).toEqual({
      httpPort: 9000,
      transports: ["http"],
      loggerType: "mcp_server",
      azureIconLibraryPath: "/icons.xml",
    });
  });

  test("invalid HTTP_PORT in env returns Error", () => {
    const result = parseConfig([], { HTTP_PORT: "abc" });
    expect(result).toBeInstanceOf(Error);
  });

  test("invalid TRANSPORT in env returns Error", () => {
    const result = parseConfig([], { TRANSPORT: "websocket" });
    expect(result).toBeInstanceOf(Error);
  });
});

describe("buildConfig", () => {
  const originalArgv = process.argv;
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.argv = originalArgv;
    // Restore env vars
    for (const key of ["HTTP_PORT", "TRANSPORT", "LOGGER_TYPE", "AZURE_ICON_LIBRARY_PATH"]) {
      if (originalEnv[key] !== undefined) {
        process.env[key] = originalEnv[key];
      } else {
        delete process.env[key];
      }
    }
  });

  test("uses default config with empty args", () => {
    process.argv = ["node", "script.js"];
    const result = buildConfig();
    expect(result).not.toBeInstanceOf(Error);
    if (!(result instanceof Error)) {
      expect(result.httpPort).toBe(8080);
      expect(result.transports).toEqual(["stdio"]);
      expect(result.loggerType).toBe("console");
    }
  });

  test("parses custom http port from argv", () => {
    process.argv = ["node", "script.js", "--http-port", "4242"];
    const result = buildConfig();
    expect(result).not.toBeInstanceOf(Error);
    if (!(result instanceof Error)) {
      expect(result.httpPort).toBe(4242);
    }
  });

  test("returns Error for invalid config", () => {
    process.argv = ["node", "script.js", "--http-port", "abc"];
    const result = buildConfig();
    expect(result).toBeInstanceOf(Error);
  });

  test("reads LOGGER_TYPE from process.env", () => {
    process.argv = ["node", "script.js"];
    process.env.LOGGER_TYPE = "mcp_server";
    const result = buildConfig();
    expect(result).not.toBeInstanceOf(Error);
    if (!(result instanceof Error)) {
      expect(result.loggerType).toBe("mcp_server");
    }
  });
});
