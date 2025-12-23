import {
  parseExtensionPortValue,
  parseHttpPortValue,
  findArgValue,
  hasFlag,
  shouldShowHelp,
  parseConfig,
  buildConfig,
  parseTransports,
} from "./config.js";

describe("parseExtensionPortValue", () => {
  test("valid port returns number", () => {
    expect(parseExtensionPortValue("8080")).toBe(8080);
  });

  test("undefined input returns Error", () => {
    expect(parseExtensionPortValue(undefined)).toBeInstanceOf(Error);
  });

  test("non-numeric string returns Error", () => {
    expect(parseExtensionPortValue("abc")).toBeInstanceOf(Error);
  });

  test("out of range (too low) returns Error", () => {
    expect(parseExtensionPortValue("0")).toBeInstanceOf(Error);
  });

  test("out of range (too high) returns Error", () => {
    expect(parseExtensionPortValue("70000")).toBeInstanceOf(Error);
  });

  test("port 1 is valid", () => {
    expect(parseExtensionPortValue("1")).toBe(1);
  });

  test("port 65535 is valid", () => {
    expect(parseExtensionPortValue("65535")).toBe(65535);
  });
});

describe("parseHttpPortValue", () => {
  test("valid port returns number", () => {
    expect(parseHttpPortValue("3000")).toBe(3000);
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

describe("findArgValue", () => {
  test("finds value after flag", () => {
    expect(findArgValue(["--port", "8080", "--help"], "--port")).toBe("8080");
  });

  test("returns undefined when flag not found", () => {
    expect(findArgValue(["--help"], "--port")).toBeUndefined();
  });

  test("returns undefined when flag is last argument", () => {
    expect(findArgValue(["--port"], "--port")).toBeUndefined();
  });

  test("finds value with short flag", () => {
    expect(findArgValue(["-p", "8080"], "-p")).toBe("8080");
  });

  test("works with readonly array", () => {
    const args = ["--port", "8080"] as const;
    expect(findArgValue(args, "--port")).toBe("8080");
  });
});

describe("hasFlag", () => {
  test("returns true when flag exists", () => {
    expect(hasFlag(["--help", "--port", "8080"], "--help")).toBe(true);
  });

  test("returns false when flag does not exist", () => {
    expect(hasFlag(["--port", "8080"], "--help")).toBe(false);
  });

  test("returns true with short flag", () => {
    expect(hasFlag(["-h"], "-h")).toBe(true);
  });

  test("works with multiple flags", () => {
    expect(hasFlag(["-h"], "-h", "--help")).toBe(true);
  });

  test("works with readonly array", () => {
    const args = ["--help"] as const;
    expect(hasFlag(args, "--help")).toBe(true);
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
    expect(shouldShowHelp(["--extension-port", "8080"])).toBe(false);
  });

  test("returns false for empty args", () => {
    expect(shouldShowHelp([])).toBe(false);
  });
});

describe("parseConfig", () => {
  test("no args returns default config", () => {
    expect(parseConfig([])).toEqual({
      extensionPort: 3333,
      httpPort: 3000,
      transports: ["stdio"],
    });
  });

  test("--extension-port flag sets custom port", () => {
    expect(parseConfig(["--extension-port", "8080"])).toEqual({
      extensionPort: 8080,
      httpPort: 3000,
      transports: ["stdio"],
    });
  });

  test("-p flag sets custom port", () => {
    expect(parseConfig(["-p", "8080"])).toEqual({
      extensionPort: 8080,
      httpPort: 3000,
      transports: ["stdio"],
    });
  });

  test("--http-port flag sets custom port", () => {
    expect(parseConfig(["--http-port", "4242"])).toEqual({
      extensionPort: 3333,
      httpPort: 4242,
      transports: ["stdio"],
    });
  });

  test("both ports can be configured", () => {
    expect(
      parseConfig(["--extension-port", "8080", "--http-port", "4242"]),
    ).toEqual({
      extensionPort: 8080,
      httpPort: 4242,
      transports: ["stdio"],
    });
  });

  test("help flag is ignored in config parsing", () => {
    expect(parseConfig(["--help"])).toEqual({
      extensionPort: 3333,
      httpPort: 3000,
      transports: ["stdio"],
    });
  });

  test("invalid port returns Error", () => {
    const result = parseConfig(["--extension-port", "abc"]);
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toContain("Invalid port number");
  });

  test("missing port value returns Error", () => {
    const result = parseConfig(["--extension-port"]);
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toContain(
      "--extension-port flag requires a port number",
    );
  });

  test("missing http port value returns Error", () => {
    const result = parseConfig(["--http-port"]);
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toContain(
      "--http-port flag requires a port number",
    );
  });

  test("out of range port returns Error", () => {
    const result = parseConfig(["--extension-port", "70000"]);
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toContain("Invalid port number");
  });

  test("multiple --extension-port flags uses last one", () => {
    expect(
      parseConfig(["--extension-port", "8080", "--extension-port", "9090"]),
    ).toEqual({
      extensionPort: 9090,
      httpPort: 3000,
      transports: ["stdio"],
    });
  });

  test("short and long form both work, last wins", () => {
    expect(parseConfig(["--extension-port", "8080", "-p", "9090"])).toEqual({
      extensionPort: 9090,
      httpPort: 3000,
      transports: ["stdio"],
    });
  });

  test("last http-port flag wins", () => {
    expect(
      parseConfig(["--http-port", "4000", "--http-port", "5000"]),
    ).toEqual({
      extensionPort: 3333,
      httpPort: 5000,
      transports: ["stdio"],
    });
  });

  test("sets single transport", () => {
    expect(parseConfig(["--transport", "stdio"])).toEqual({
      extensionPort: 3333,
      httpPort: 3000,
      transports: ["stdio"],
    });
  });

  test("sets multiple transports", () => {
    expect(parseConfig(["--transport", "stdio,http"])).toEqual({
      extensionPort: 3333,
      httpPort: 3000,
      transports: ["stdio", "http"],
    });
  });

  test("rejects unknown transport", () => {
    const result = parseConfig(["--transport", "foo"]);
    expect(result).toBeInstanceOf(Error);
  });
});

describe("buildConfig", () => {
  const originalArgv = process.argv;

  afterEach(() => {
    process.argv = originalArgv;
  });

  test("uses default config with empty args", () => {
    process.argv = ["node", "script.js"];
    const result = buildConfig();
    expect(result).toEqual({
      extensionPort: 3333,
      httpPort: 3000,
      transports: ["stdio"],
    });
  });

  test("parses custom port from argv", () => {
    process.argv = ["node", "script.js", "--extension-port", "8080"];
    const result = buildConfig();
    expect(result).toEqual({
      extensionPort: 8080,
      httpPort: 3000,
      transports: ["stdio"],
    });
  });

  test("parses custom http port from argv", () => {
    process.argv = ["node", "script.js", "--http-port", "4242"];
    const result = buildConfig();
    expect(result).toEqual({
      extensionPort: 3333,
      httpPort: 4242,
      transports: ["stdio"],
    });
  });

  test("returns Error for invalid config", () => {
    process.argv = ["node", "script.js", "--extension-port", "abc"];
    const result = buildConfig();
    expect(result).toBeInstanceOf(Error);
  });
});
