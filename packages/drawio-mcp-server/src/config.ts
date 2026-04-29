import { isIP } from "node:net";

/**
 * Application configuration interface
 */

export interface ServerConfig {
  readonly extensionPort: number;
  readonly httpPort: number;
  readonly transports: TransportType[];
  readonly editorEnabled: boolean;
  readonly assetPath?: string;
  readonly webSocketUrl?: string;
  readonly host?: string;
  readonly logger: LoggerMode;
  readonly tlsEnabled: boolean;
  readonly tlsAuto: boolean;
  readonly tlsCert?: string;
  readonly tlsKey?: string;
  readonly tlsDir?: string;
}

export type TransportType = "stdio" | "http";
export type LoggerMode = "console" | "mcp-server";

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: ServerConfig = {
  extensionPort: 3333,
  httpPort: 3000,
  transports: ["stdio"],
  editorEnabled: false,
  logger: "console",
  tlsEnabled: false,
  tlsAuto: false,
} as const;

/**
 * Valid port range
 */
const PORT_RANGE = {
  min: 1,
  max: 65535,
} as const;

/**
 * Parse extension port value from string - pure function
 */
export const parseExtensionPortValue = (
  value: string | undefined,
): number | Error => {
  if (!value) {
    return new Error("--extension-port flag requires a port number");
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
 * Parse WebSocket URL value - pure function
 * Accepts ws:// or wss:// URLs only
 */
export const parseWebSocketUrlValue = (
  value: string | undefined,
): string | Error => {
  if (!value) {
    return new Error("--websocket-url flag requires a URL");
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return new Error(`Invalid WebSocket URL "${value}"`);
  }

  if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") {
    return new Error(
      `Invalid WebSocket URL "${value}". Protocol must be ws:// or wss://`,
    );
  }

  return value;
};

/**
 * Parse host value - pure function
 * Accepts IPv4 or IPv6 addresses only (no hostnames)
 */
export const parseHostValue = (value: string | undefined): string | Error => {
  if (!value) {
    return new Error("--host flag requires an IP address");
  }

  if (isIP(value) === 0) {
    return new Error(
      `Invalid host "${value}". Must be a valid IPv4 or IPv6 address`,
    );
  }

  return value;
};

/**
 * Parse logger mode value - pure function
 * Accepts "console" or "mcp-server". For convenience the legacy underscore
 * form "mcp_server" is normalised to "mcp-server".
 */
export const parseLoggerValue = (
  value: string | undefined,
): LoggerMode | Error => {
  if (!value) {
    return new Error("--logger flag requires a mode (console|mcp-server)");
  }

  const normalized = value === "mcp_server" ? "mcp-server" : value;

  if (normalized === "console" || normalized === "mcp-server") {
    return normalized;
  }

  return new Error(
    `Invalid logger "${value}". Must be one of: console, mcp-server`,
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
 * Find argument value by flag name - pure function
 */
export const findArgValue = (
  args: readonly string[],
  ...flags: string[]
): string | undefined => {
  const index = args.findIndex((arg) => flags.includes(arg));
  return index !== -1 ? args[index + 1] : undefined;
};

/**
 * Check if any flag exists in arguments - pure function
 */
export const hasFlag = (
  args: readonly string[],
  ...flags: string[]
): boolean => {
  return args.some((arg) => flags.includes(arg));
};

/**
 * Check if help was requested - pure function
 */
export const shouldShowHelp = (args: readonly string[]): boolean => {
  return hasFlag(args, "--help", "-h");
};

/**
 * Parse command line arguments into configuration object
 * Pure function - no side effects, deterministic output
 */
export const parseConfig = (args: readonly string[]): ServerConfig | Error => {
  // Walk arguments so repeated flags allow "last wins" semantics
  let portValue: string | undefined;
  let httpPortValue: string | undefined;
  let parsedHttpPort: number | undefined;
  let transportValues: string[] | undefined;
  let editorEnabled = false;
  let assetPath: string | undefined;
  let webSocketUrlValue: string | undefined;
  let hostValue: string | undefined;
  let loggerValue: string | undefined;
  let tlsEnabled = false;
  let tlsAuto = false;
  let tlsCert: string | undefined;
  let tlsKey: string | undefined;
  let tlsDir: string | undefined;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === "--extension-port" || arg === "-p") {
      const nextValue = args[i + 1];

      if (nextValue === undefined) {
        return new Error("--extension-port flag requires a port number");
      }

      portValue = nextValue;
      i += 1; // Skip the value we just consumed
    } else if (arg === "--http-port") {
      const nextValue = args[i + 1];

      if (nextValue === undefined) {
        return new Error("--http-port flag requires a port number");
      }

      httpPortValue = nextValue;
      i += 1;
    } else if (arg === "--transport") {
      const nextValue = args[i + 1];

      if (nextValue === undefined) {
        return new Error("--transport flag requires a transport name");
      }

      transportValues = [nextValue];
      i += 1;
    } else if (arg === "--editor" || arg === "-e") {
      const nextValue = args[i + 1];
      if (
        nextValue !== undefined &&
        (nextValue === "false" || nextValue === "true")
      ) {
        editorEnabled = nextValue === "true";
        i += 1;
      } else {
        editorEnabled = true;
      }
    } else if (arg === "--editor=true") {
      editorEnabled = true;
    } else if (arg === "--editor=false") {
      editorEnabled = false;
    } else if (arg === "--asset-path") {
      const nextValue = args[i + 1];

      if (nextValue === undefined) {
        return new Error("--asset-path flag requires a path");
      }

      assetPath = nextValue;
      i += 1;
    } else if (arg === "--websocket-url") {
      const nextValue = args[i + 1];

      if (nextValue === undefined) {
        return new Error("--websocket-url flag requires a URL");
      }

      webSocketUrlValue = nextValue;
      i += 1;
    } else if (arg === "--host") {
      const nextValue = args[i + 1];

      if (nextValue === undefined) {
        return new Error("--host flag requires an IP address");
      }

      hostValue = nextValue;
      i += 1;
    } else if (arg === "--logger") {
      const nextValue = args[i + 1];

      if (nextValue === undefined) {
        return new Error("--logger flag requires a mode (console|mcp-server)");
      }

      loggerValue = nextValue;
      i += 1;
    } else if (arg === "--tls") {
      tlsEnabled = true;
    } else if (arg === "--tls-auto") {
      tlsAuto = true;
    } else if (arg === "--tls-cert") {
      const nextValue = args[i + 1];
      if (nextValue === undefined) {
        return new Error("--tls-cert flag requires a path");
      }
      tlsCert = nextValue;
      i += 1;
    } else if (arg === "--tls-key") {
      const nextValue = args[i + 1];
      if (nextValue === undefined) {
        return new Error("--tls-key flag requires a path");
      }
      tlsKey = nextValue;
      i += 1;
    } else if (arg === "--tls-dir") {
      const nextValue = args[i + 1];
      if (nextValue === undefined) {
        return new Error("--tls-dir flag requires a directory path");
      }
      tlsDir = nextValue;
      i += 1;
    }
  }

  let logger: LoggerMode = DEFAULT_CONFIG.logger;
  if (loggerValue !== undefined) {
    const parsed = parseLoggerValue(loggerValue);
    if (parsed instanceof Error) {
      return parsed;
    }
    logger = parsed;
  }

  let webSocketUrl: string | undefined;
  if (webSocketUrlValue !== undefined) {
    const parsed = parseWebSocketUrlValue(webSocketUrlValue);
    if (parsed instanceof Error) {
      return parsed;
    }
    webSocketUrl = parsed;
  }

  let host: string | undefined;
  if (hostValue !== undefined) {
    const parsed = parseHostValue(hostValue);
    if (parsed instanceof Error) {
      return parsed;
    }
    host = parsed;
  }

  if (httpPortValue !== undefined) {
    const httpPort = parseHttpPortValue(httpPortValue);
    if (httpPort instanceof Error) {
      return httpPort;
    }
    parsedHttpPort = httpPort;
  }

  // TLS validation
  if ((tlsCert || tlsKey || tlsAuto || tlsDir) && !tlsEnabled) {
    return new Error(
      "TLS sub-flags (--tls-cert, --tls-key, --tls-auto, --tls-dir) require --tls",
    );
  }
  if (tlsEnabled) {
    if (tlsCert && !tlsKey) {
      return new Error("--tls-cert requires --tls-key");
    }
    if (tlsKey && !tlsCert) {
      return new Error("--tls-key requires --tls-cert");
    }
    if (tlsAuto && (tlsCert || tlsKey)) {
      return new Error(
        "Cannot combine --tls-auto with --tls-cert/--tls-key. Pick one mode.",
      );
    }
  }

  if (portValue !== undefined) {
    const extensionPort = parseExtensionPortValue(portValue);

    if (extensionPort instanceof Error) {
      return extensionPort;
    }

    const transports = parseTransports(transportValues);
    if (transports instanceof Error) {
      return transports;
    }

    return {
      ...DEFAULT_CONFIG,
      extensionPort,
      httpPort:
        parsedHttpPort !== undefined ? parsedHttpPort : DEFAULT_CONFIG.httpPort,
      transports,
      editorEnabled,
      assetPath,
      webSocketUrl,
      host,
      logger,
      tlsEnabled,
      tlsAuto,
      tlsCert,
      tlsKey,
      tlsDir,
    };
  }

  if (httpPortValue !== undefined) {
    const transports = parseTransports(transportValues);
    if (transports instanceof Error) {
      return transports;
    }

    return {
      ...DEFAULT_CONFIG,
      httpPort: parsedHttpPort as number,
      transports,
      editorEnabled,
      assetPath,
      webSocketUrl,
      host,
      logger,
      tlsEnabled,
      tlsAuto,
      tlsCert,
      tlsKey,
      tlsDir,
    };
  }

  const transports = parseTransports(transportValues);
  if (transports instanceof Error) {
    return transports;
  }

  // Return default configuration
  return {
    ...DEFAULT_CONFIG,
    transports,
    editorEnabled,
    assetPath,
    webSocketUrl,
    host,
    logger,
    tlsEnabled,
    tlsAuto,
    tlsCert,
    tlsKey,
    tlsDir,
  };
};

/**
 * Map known DRAWIO_MCP_* environment variables to argv tokens.
 * Pure function - injected env in, argv out.
 *
 * Result is concatenated BEFORE real CLI args so that parseConfig's
 * last-wins semantics give CLI flags precedence over env vars.
 */
export const envToArgs = (env: NodeJS.ProcessEnv): string[] => {
  const out: string[] = [];

  const extPort = env.DRAWIO_MCP_EXTENSION_PORT;
  if (extPort && extPort.length > 0) {
    out.push("--extension-port", extPort);
  }

  const httpPort = env.DRAWIO_MCP_HTTP_PORT;
  if (httpPort && httpPort.length > 0) {
    out.push("--http-port", httpPort);
  }

  const transport = env.DRAWIO_MCP_TRANSPORT;
  if (transport && transport.length > 0) {
    out.push("--transport", transport);
  }

  const editor = env.DRAWIO_MCP_EDITOR;
  if (editor && editor.length > 0) {
    const normalized = editor.toLowerCase();
    if (normalized === "true" || normalized === "false") {
      out.push("--editor", normalized);
    }
  }

  const assetPath = env.DRAWIO_MCP_ASSET_PATH;
  if (assetPath && assetPath.length > 0) {
    out.push("--asset-path", assetPath);
  }

  const wsUrl = env.DRAWIO_MCP_WEBSOCKET_URL;
  if (wsUrl && wsUrl.length > 0) {
    out.push("--websocket-url", wsUrl);
  }

  const host = env.DRAWIO_MCP_HOST;
  if (host && host.length > 0) {
    out.push("--host", host);
  }

  const logger = env.DRAWIO_MCP_LOGGER;
  if (logger && logger.length > 0) {
    out.push("--logger", logger);
  }

  const tls = env.DRAWIO_MCP_TLS;
  if (tls && tls.toLowerCase() === "true") out.push("--tls");

  const tlsAuto = env.DRAWIO_MCP_TLS_AUTO;
  if (tlsAuto && tlsAuto.toLowerCase() === "true") out.push("--tls-auto");

  const tlsCert = env.DRAWIO_MCP_TLS_CERT;
  if (tlsCert && tlsCert.length > 0) out.push("--tls-cert", tlsCert);

  const tlsKey = env.DRAWIO_MCP_TLS_KEY;
  if (tlsKey && tlsKey.length > 0) out.push("--tls-key", tlsKey);

  const tlsDir = env.DRAWIO_MCP_TLS_DIR;
  if (tlsDir && tlsDir.length > 0) out.push("--tls-dir", tlsDir);

  return out;
};

/**
 * Build configuration from process.argv
 * This is the main entry point for configuration
 * Returns Error for invalid config, or ServerConfig
 */
export const buildConfig = (): ServerConfig | Error => {
  const envArgs = envToArgs(process.env);
  const cliArgs = process.argv.slice(2);
  return parseConfig([...envArgs, ...cliArgs]);
};

/**
 * Convenience: parse an empty argument list and return the default
 * ServerConfig. Used by test harnesses that need a config object but do not
 * exercise the parser.
 */
export const defaultConfig = (): ServerConfig => {
  const result = parseConfig([]);
  if (result instanceof Error) {
    throw result;
  }
  return result;
};

export interface HttpFeatureConfig {
  readonly enableMcp: boolean;
  readonly enableEditor: boolean;
  readonly enableHealth: boolean;
  readonly enableConfig: boolean;
}

export function getHttpFeatureConfig(config: ServerConfig): HttpFeatureConfig {
  return {
    enableMcp: config.transports.includes("http"),
    enableEditor: config.editorEnabled,
    enableHealth: true,
    enableConfig: true,
  };
}
