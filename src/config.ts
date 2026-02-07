/**
 * Application configuration — CLI flags, environment variables, defaults.
 *
 * All parsing functions are pure (no side effects, deterministic output).
 * The only Deno-specific calls are in `buildConfig()` which reads `Deno.args`
 * and `Deno.env`.
 *
 * Uses `@std/cli/parse-args` (minimist-style) for CLI argument parsing.
 */

import { parseArgs as denoParseArgs } from "@std/cli/parse-args";

// Import version from deno.json (single source of truth).
// Deno resolves this via static JSON import — no filesystem read at runtime.
import denoConfig from "../deno.json" with { type: "json" };

/**
 * Application version — read from deno.json (single source of truth).
 */
export const VERSION: string = denoConfig.version;

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
 * CLI option definitions for `@std/cli/parse-args`.
 * Declared once so parseConfig and shouldShowHelp share the same schema.
 *
 * Note: `@std/cli/parse-args` (minimist-style) returns the last value for
 * repeated flags automatically — no need for a `multiple` option.  The
 * `collect` option gathers repeated flags into arrays when needed.
 */

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
 * Uses `@std/cli/parse-args` (minimist-style) for argument parsing.
 * Pure function — no side effects, deterministic output.
 */
export const parseConfig = (
  args: readonly string[],
  env: Record<string, string | undefined> = {},
): ServerConfig | Error => {
  // Parse CLI arguments using Deno standard library.
  // `@std/cli/parse-args` follows minimist conventions:
  //  - Unknown flags are silently stored in `_` or as properties.
  //  - `--flag` without a value is `true` (when not declared as `string`).
  //  - Repeated `string` flags keep the last value; with `collect`, they
  //    accumulate into arrays.
  const parsed = denoParseArgs(args as string[], {
    string: ["http-port", "transport"],
    boolean: ["help"],
    alias: { h: "help" },
    collect: ["http-port", "transport"],
  });

  // `collect` mode gathers repeated flags into arrays.
  // A bare `--flag` (no value) produces an empty string "" in the array.
  const httpPortArr = parsed["http-port"] as string[] | undefined;
  const transportArr = parsed["transport"] as string[] | undefined;

  // Detect bare flags (--http-port with no value → empty string)
  if (httpPortArr?.some((v) => v === "")) {
    return new Error("--http-port flag requires a port number");
  }
  if (transportArr?.some((v) => v === "")) {
    return new Error("--transport flag requires a transport name");
  }

  // Last-wins semantics for repeated flags
  // ── HTTP port: CLI > env > default ──
  let httpPortValue = httpPortArr?.at(-1);
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
  let transportValues = transportArr?.length
    ? [transportArr.at(-1)!]
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
 * Build configuration from Deno runtime context.
 *
 * Accepts optional overrides for testability — production code calls
 * `buildConfig()` with no arguments, which reads `Deno.args` and `Deno.env`.
 *
 * @param args — CLI arguments (defaults to `Deno.args`)
 * @param env  — environment variables (defaults to `Deno.env.toObject()`)
 */
export const buildConfig = (
  args: readonly string[] = Deno.args,
  env: Record<string, string | undefined> = Deno.env.toObject(),
): ServerConfig | Error => {
  return parseConfig(args, env);
};
