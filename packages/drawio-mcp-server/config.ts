/**
 * Application configuration interface
 */

export interface ServerConfig {
  readonly extensionPort: number;
  readonly httpPort: number;
  readonly transports: TransportType[];
  readonly editorEnabled: boolean;
  readonly assetPath?: string;
}

export type TransportType = "stdio" | "http";

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: ServerConfig = {
  extensionPort: 3333,
  httpPort: 3000,
  transports: ["stdio"],
  editorEnabled: false,
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
    }
  }

  if (httpPortValue !== undefined) {
    const httpPort = parseHttpPortValue(httpPortValue);
    if (httpPort instanceof Error) {
      return httpPort;
    }
    parsedHttpPort = httpPort;
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
  };
};

/**
 * Build configuration from process.argv
 * This is the main entry point for configuration
 * Returns Error for invalid config, or ServerConfig
 */
export const buildConfig = (): ServerConfig | Error => {
  const args = process.argv.slice(2);
  return parseConfig(args);
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
