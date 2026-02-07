import { createRequire } from "node:module";
import { parseArgs } from "node:util";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

/**
 * Application version — read from package.json (single source of truth).
 */
export const VERSION: string = pkg.version;

/**
 * Application configuration interface
 */
export interface ServerConfig {
  readonly httpPort: number;
  readonly transports: TransportType[];
  readonly loggerType: LoggerType;
  readonly azureIconLibraryPath: string | undefined;
}

export type TransportType = "stdio" | "http";
export type LoggerType = "console" | "mcp_server";

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: ServerConfig = {
  httpPort: 8080,
  transports: ["stdio"],
  loggerType: "console",
  azureIconLibraryPath: undefined,
} as const;

/**
 * Valid port range
 */
const PORT_RANGE = {
  min: 1,
  max: 65535,
} as const;

const VALID_LOGGER_TYPES: readonly LoggerType[] = ["console", "mcp_server"] as const;

/**
 * CLI option definitions for node:util parseArgs.
 * Declared once so parseConfig and shouldShowHelp share the same schema.
 */
const CLI_OPTIONS = {
  "http-port": { type: "string", multiple: true },
  transport: { type: "string", multiple: true },
  help: { type: "boolean", short: "h" },
} as const;

/**
 * Parse http port value from string - pure function
 */
export const parseHttpPortValue = (
  value: string | undefined,
): number | Error => {
  if (!value) {
    return new Error("--http-port flag requires a port number");
  }

  const port = parseInt(value, 10);

  if (isNaN(port)) {
    return new Error(`Invalid port number "${value}". Port must be a number`);
  }

  if (port < PORT_RANGE.min || port > PORT_RANGE.max) {
    return new Error(
      `Invalid port number "${value}". Port must be between ${PORT_RANGE.min} and ${PORT_RANGE.max}`,
    );
  }

  return port;
};

/**
 * Parse logger type value - pure function
 */
export const parseLoggerType = (
  value: string | undefined,
): LoggerType | Error => {
  if (!value || value.trim().length === 0) {
    return DEFAULT_CONFIG.loggerType;
  }
  const normalized = value.trim().toLowerCase();
  if (VALID_LOGGER_TYPES.includes(normalized as LoggerType)) {
    return normalized as LoggerType;
  }
  return new Error(
    `Invalid logger type "${value}". Supported types: ${VALID_LOGGER_TYPES.join(", ")}`,
  );
};

export const parseTransports = (
  values: string[] | undefined,
): TransportType[] | Error => {
  if (!values || values.length === 0) {
    return DEFAULT_CONFIG.transports;
  }

  const normalized = values
    .flatMap((value) => value.split(","))
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);

  if (normalized.length === 0) {
    return new Error("At least one transport must be specified");
  }

  const validTransports: TransportType[] = [];

  for (const value of normalized) {
    if (value === "stdio" || value === "http") {
      validTransports.push(value);
    } else {
      return new Error(
        `Invalid transport "${value}". Supported transports: stdio, http`,
      );
    }
  }

  // Remove duplicates while preserving order
  return Array.from(new Set(validTransports));
};

/**
 * Check if help was requested - pure function
 */
export const shouldShowHelp = (args: readonly string[]): boolean => {
  return args.includes("--help") || args.includes("-h");
};

/**
 * Parse command line arguments into configuration object.
 * Uses node:util parseArgs for robust argument parsing.
 * Pure function - no side effects, deterministic output.
 */
export const parseConfig = (
  args: readonly string[],
  env: Record<string, string | undefined> = {},
): ServerConfig | Error => {
  // Parse CLI arguments using Node.js built-in parser.
  // strict:false silently ignores unknown flags and turns "--flag" (missing
  // value) into boolean `true` instead of throwing, so no try-catch needed.
  const { values } = parseArgs({
    args: args as string[],
    options: CLI_OPTIONS,
    strict: false,
  });

  // parseArgs with strict:false silently turns --flag (no value) into boolean `true`.
  // Detect that and surface a clear error before passing values onward.
  const httpPortArr = values["http-port"] as (string | boolean)[] | undefined;
  const transportArr = values.transport as (string | boolean)[] | undefined;

  if (httpPortArr?.some((v) => typeof v !== "string")) {
    return new Error("--http-port flag requires a port number");
  }
  if (transportArr?.some((v) => typeof v !== "string")) {
    return new Error("--transport flag requires a transport name");
  }

  // Last-wins semantics for repeated flags
  // ── HTTP port: CLI > env > default ──
  let httpPortValue = (httpPortArr as string[] | undefined)?.at(-1);
  if (httpPortValue === undefined && env.HTTP_PORT) {
    httpPortValue = env.HTTP_PORT;
  }
  let parsedHttpPort: number | undefined;
  if (httpPortValue !== undefined) {
    const httpPort = parseHttpPortValue(httpPortValue);
    if (httpPort instanceof Error) {
      return httpPort;
    }
    parsedHttpPort = httpPort;
  }

  // ── Transport: CLI > env > default ──
  let transportValues = (transportArr as string[] | undefined)?.length
    ? [(transportArr as string[]).at(-1)!]
    : undefined;
  if (transportValues === undefined && env.TRANSPORT) {
    transportValues = [env.TRANSPORT];
  }
  const transports = parseTransports(transportValues);
  if (transports instanceof Error) {
    return transports;
  }

  // ── Logger type: env only (no CLI flag) ──
  const loggerType = parseLoggerType(env.LOGGER_TYPE);
  if (loggerType instanceof Error) {
    return loggerType;
  }

  // ── Azure icon library path: env only ──
  const azureIconLibraryPath = env.AZURE_ICON_LIBRARY_PATH?.trim() || undefined;

  return {
    ...DEFAULT_CONFIG,
    httpPort:
      parsedHttpPort !== undefined ? parsedHttpPort : DEFAULT_CONFIG.httpPort,
    transports,
    loggerType,
    azureIconLibraryPath,
  };
};

/**
 * Build configuration from process.argv
 * This is the main entry point for configuration
 * Returns Error for invalid config, or ServerConfig
 */
export const buildConfig = (): ServerConfig | Error => {
  const args = process.argv.slice(2);
  return parseConfig(args, process.env);
};
