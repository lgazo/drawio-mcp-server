import { describe, it } from "@std/testing/bdd";
import { assertEquals, assertInstanceOf, assert } from "@std/assert";
import {
  parseHttpPortValue,
  shouldShowHelp,
  parseConfig,
  buildConfig,
  parseTransports,
  parseLoggerType,
  type ServerConfig,
} from "../src/config.ts";

describe("parseHttpPortValue", () => {
  it("valid port returns number", () => {
    assertEquals(parseHttpPortValue("8080"), 8080);
  });
  it("undefined input returns Error", () => {
    assertInstanceOf(parseHttpPortValue(undefined), Error);
  });
  it("non-numeric string returns Error", () => {
    assertInstanceOf(parseHttpPortValue("abc"), Error);
  });
  it("out of range returns Error", () => {
    assertInstanceOf(parseHttpPortValue("70000"), Error);
  });
});

describe("parseTransports", () => {
  it("returns default when undefined", () => {
    assertEquals(parseTransports(undefined), ["stdio"]);
  });
  it("parses single transport", () => {
    assertEquals(parseTransports(["stdio"]), ["stdio"]);
  });
  it("parses comma separated list", () => {
    assertEquals(parseTransports(["stdio,http"]), ["stdio", "http"]);
  });
  it("deduplicates transports", () => {
    assertEquals(parseTransports(["stdio", "stdio"]), ["stdio"]);
  });
  it("rejects empty string", () => {
    const result = parseTransports([""]);
    assertInstanceOf(result, Error);
  });
  it("rejects unknown transport", () => {
    const result = parseTransports(["foo"]);
    assertInstanceOf(result, Error);
  });
});

describe("parseLoggerType", () => {
  it("returns default for undefined", () => {
    assertEquals(parseLoggerType(undefined), "console");
  });
  it("returns default for empty string", () => {
    assertEquals(parseLoggerType(""), "console");
  });
  it("returns default for whitespace-only string", () => {
    assertEquals(parseLoggerType("   "), "console");
  });
  it("accepts console", () => {
    assertEquals(parseLoggerType("console"), "console");
  });
  it("accepts mcp_server", () => {
    assertEquals(parseLoggerType("mcp_server"), "mcp_server");
  });
  it("is case-insensitive", () => {
    assertEquals(parseLoggerType("MCP_SERVER"), "mcp_server");
  });
  it("trims whitespace", () => {
    assertEquals(parseLoggerType("  console  "), "console");
  });
  it("rejects invalid value", () => {
    const result = parseLoggerType("invalid");
    assertInstanceOf(result, Error);
    assert((result as Error).message.includes("Invalid logger type"));
  });
});

describe("shouldShowHelp", () => {
  it("returns true for --help", () => {
    assertEquals(shouldShowHelp(["--help"]), true);
  });
  it("returns true for -h", () => {
    assertEquals(shouldShowHelp(["-h"]), true);
  });
  it("returns false for no help flag", () => {
    assertEquals(shouldShowHelp(["--http-port", "8080"]), false);
  });
  it("returns false for empty args", () => {
    assertEquals(shouldShowHelp([]), false);
  });
});

describe("parseConfig", () => {
  const DEFAULT_RESULT: ServerConfig = {
    httpPort: 8080,
    transports: ["stdio"],
    loggerType: "console",
    azureIconLibraryPath: undefined,
  };

  it("no args returns default config", () => {
    assertEquals(parseConfig([]), DEFAULT_RESULT);
  });
  it("--http-port flag sets custom port", () => {
    assertEquals(parseConfig(["--http-port", "4242"]), {
      ...DEFAULT_RESULT,
      httpPort: 4242,
    });
  });
  it("help flag is ignored in config parsing", () => {
    assertEquals(parseConfig(["--help"]), DEFAULT_RESULT);
  });
  it("invalid port returns Error", () => {
    const result = parseConfig(["--http-port", "abc"]);
    assertInstanceOf(result, Error);
    assert((result as Error).message.includes("Invalid port number"));
  });
  it("missing http port value returns Error", () => {
    const result = parseConfig(["--http-port"]);
    assertInstanceOf(result, Error);
  });
  it("out of range port returns Error", () => {
    const result = parseConfig(["--http-port", "70000"]);
    assertInstanceOf(result, Error);
    assert((result as Error).message.includes("Invalid port number"));
  });
  it("last http-port flag wins", () => {
    assertEquals(parseConfig(["--http-port", "4000", "--http-port", "5000"]), {
      ...DEFAULT_RESULT,
      httpPort: 5000,
    });
  });
  it("sets single transport", () => {
    assertEquals(parseConfig(["--transport", "stdio"]), DEFAULT_RESULT);
  });
  it("sets multiple transports", () => {
    assertEquals(parseConfig(["--transport", "stdio,http"]), {
      ...DEFAULT_RESULT,
      transports: ["stdio", "http"],
    });
  });
  it("rejects unknown transport", () => {
    const result = parseConfig(["--transport", "foo"]);
    assertInstanceOf(result, Error);
  });
  it("missing transport value returns Error", () => {
    const result = parseConfig(["--transport"]);
    assertInstanceOf(result, Error);
  });
  // env variable tests
  it("reads HTTP_PORT from env when no CLI flag", () => {
    const result = parseConfig([], { HTTP_PORT: "3000" });
    assertEquals(result, { ...DEFAULT_RESULT, httpPort: 3000 });
  });
  it("CLI --http-port takes precedence over env HTTP_PORT", () => {
    const result = parseConfig(["--http-port", "5000"], { HTTP_PORT: "3000" });
    assertEquals(result, { ...DEFAULT_RESULT, httpPort: 5000 });
  });
  it("reads TRANSPORT from env when no CLI flag", () => {
    const result = parseConfig([], { TRANSPORT: "http" });
    assertEquals(result, { ...DEFAULT_RESULT, transports: ["http"] });
  });
  it("CLI --transport takes precedence over env TRANSPORT", () => {
    const result = parseConfig(["--transport", "stdio"], { TRANSPORT: "http" });
    assertEquals(result, DEFAULT_RESULT);
  });
  it("reads LOGGER_TYPE from env", () => {
    const result = parseConfig([], { LOGGER_TYPE: "mcp_server" });
    assertEquals(result, { ...DEFAULT_RESULT, loggerType: "mcp_server" });
  });
  it("invalid LOGGER_TYPE in env returns Error", () => {
    const result = parseConfig([], { LOGGER_TYPE: "invalid" });
    assertInstanceOf(result, Error);
    assert((result as Error).message.includes("Invalid logger type"));
  });
  it("reads AZURE_ICON_LIBRARY_PATH from env", () => {
    const result = parseConfig([], { AZURE_ICON_LIBRARY_PATH: "/custom/path.xml" });
    assertEquals(result, { ...DEFAULT_RESULT, azureIconLibraryPath: "/custom/path.xml" });
  });
  it("trims whitespace from AZURE_ICON_LIBRARY_PATH", () => {
    const result = parseConfig([], { AZURE_ICON_LIBRARY_PATH: "  /path.xml  " });
    assertEquals(result, { ...DEFAULT_RESULT, azureIconLibraryPath: "/path.xml" });
  });
  it("treats empty AZURE_ICON_LIBRARY_PATH as undefined", () => {
    const result = parseConfig([], { AZURE_ICON_LIBRARY_PATH: "" });
    assertEquals(result, DEFAULT_RESULT);
  });
  it("treats whitespace-only AZURE_ICON_LIBRARY_PATH as undefined", () => {
    const result = parseConfig([], { AZURE_ICON_LIBRARY_PATH: "   " });
    assertEquals(result, DEFAULT_RESULT);
  });
  it("combines CLI and env settings", () => {
    const result = parseConfig(
      ["--http-port", "9000"],
      { TRANSPORT: "http", LOGGER_TYPE: "mcp_server", AZURE_ICON_LIBRARY_PATH: "/icons.xml" },
    );
    assertEquals(result, {
      httpPort: 9000,
      transports: ["http"],
      loggerType: "mcp_server",
      azureIconLibraryPath: "/icons.xml",
    });
  });
  it("invalid HTTP_PORT in env returns Error", () => {
    const result = parseConfig([], { HTTP_PORT: "abc" });
    assertInstanceOf(result, Error);
  });
  it("invalid TRANSPORT in env returns Error", () => {
    const result = parseConfig([], { TRANSPORT: "websocket" });
    assertInstanceOf(result, Error);
  });
});

describe("buildConfig", () => {
  it("uses default config with empty args", () => {
    const result = buildConfig(["deno", "script.ts"]);
    assert(!(result instanceof Error));
    assertEquals(result.httpPort, 8080);
    assertEquals(result.transports, ["stdio"]);
    assertEquals(result.loggerType, "console");
  });
  it("parses custom http port from argv", () => {
    const result = buildConfig(["deno", "script.ts", "--http-port", "4242"]);
    assert(!(result instanceof Error));
    assertEquals(result.httpPort, 4242);
  });
  it("returns Error for invalid config", () => {
    const result = buildConfig(["deno", "script.ts", "--http-port", "abc"]);
    assertInstanceOf(result, Error);
  });
  it("reads LOGGER_TYPE from env param", () => {
    const result = buildConfig(["deno", "script.ts"], { LOGGER_TYPE: "mcp_server" });
    assert(!(result instanceof Error));
    assertEquals(result.loggerType, "mcp_server");
  });
});
