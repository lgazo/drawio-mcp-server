/**
 * Application configuration interface
 */
export interface ServerConfig {
  readonly extensionPort: number;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: ServerConfig = {
  extensionPort: 3333,
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

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === "--extension-port" || arg === "-p") {
      const nextValue = args[i + 1];

      if (nextValue === undefined) {
        return new Error("--extension-port flag requires a port number");
      }

      portValue = nextValue;
      i += 1; // Skip the value we just consumed
    }
  }

  if (portValue !== undefined) {
    const extensionPort = parseExtensionPortValue(portValue);

    if (extensionPort instanceof Error) {
      return extensionPort;
    }

    return {
      ...DEFAULT_CONFIG,
      extensionPort,
    };
  }

  // Return default configuration
  return DEFAULT_CONFIG;
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
