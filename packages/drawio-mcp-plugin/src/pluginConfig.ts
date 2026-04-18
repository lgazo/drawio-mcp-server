/**
 * Plugin Configuration Module
 *
 * Fetches configuration from server via HTTP API
 * Falls back to localStorage for offline/resilience
 */

export interface PluginConfig {
  websocketPort: number;
  serverUrl: string;
  websocketUrl?: string;
}

export const DEFAULT_PLUGIN_CONFIG: PluginConfig = {
  websocketPort: 3333,
  serverUrl: "",
};

function isValidWebSocketUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === "ws:" || parsed.protocol === "wss:";
  } catch {
    return false;
  }
}

const PLUGIN_CONFIG_KEY = "drawio-mcp-plugin-config";

let cachedConfig: PluginConfig | null = null;

export async function fetchPluginConfig(): Promise<PluginConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    const response = await fetch("/api/config");
    if (response.ok) {
      const serverConfig = await response.json();
      cachedConfig = {
        websocketPort:
          serverConfig.websocketPort || DEFAULT_PLUGIN_CONFIG.websocketPort,
        serverUrl: serverConfig.serverUrl || window.location.origin,
        websocketUrl: isValidWebSocketUrl(serverConfig.websocketUrl)
          ? serverConfig.websocketUrl
          : undefined,
      };
      writePluginConfig(cachedConfig);
      return cachedConfig;
    }
  } catch (error) {
    console.warn("[pluginConfig] Failed to fetch config from server:", error);
  }

  return readPluginConfig();
}

export function readPluginConfig(): PluginConfig {
  try {
    const stored = localStorage.getItem(PLUGIN_CONFIG_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const validated = validatePluginConfig(parsed);
      if (validated.isValid && validated.config) {
        return validated.config;
      }
    }
  } catch (error) {
    console.warn("[pluginConfig] Failed to read from localStorage:", error);
  }

  return { ...DEFAULT_PLUGIN_CONFIG };
}

export function writePluginConfig(config: PluginConfig): void {
  try {
    localStorage.setItem(PLUGIN_CONFIG_KEY, JSON.stringify(config));
    cachedConfig = config;
  } catch (error) {
    console.error("[pluginConfig] Failed to write to localStorage:", error);
    throw error;
  }
}

export function createDefaultPluginConfig(
  partial?: Partial<PluginConfig>,
): PluginConfig {
  return {
    websocketPort:
      partial?.websocketPort ?? DEFAULT_PLUGIN_CONFIG.websocketPort,
    serverUrl: partial?.serverUrl ?? DEFAULT_PLUGIN_CONFIG.serverUrl,
  };
}

export function validatePluginConfig(config: unknown): {
  isValid: boolean;
  config?: PluginConfig;
  error?: string;
} {
  if (!config || typeof config !== "object") {
    return { isValid: false, error: "Configuration must be an object" };
  }

  const cfg = config as any;

  if (typeof cfg.websocketPort !== "number") {
    return { isValid: false, error: "websocketPort must be a number" };
  }

  if (cfg.websocketPort < 1024 || cfg.websocketPort > 65535) {
    return {
      isValid: false,
      error: "websocketPort must be between 1024 and 65535",
    };
  }

  const websocketUrl = isValidWebSocketUrl(cfg.websocketUrl)
    ? cfg.websocketUrl
    : undefined;

  return {
    isValid: true,
    config: {
      websocketPort: cfg.websocketPort,
      serverUrl: cfg.serverUrl || "",
      websocketUrl,
    },
  };
}

export function buildWebSocketUrl(config: PluginConfig): string {
  if (config.websocketUrl) {
    return config.websocketUrl;
  }
  const scheme = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.hostname;
  return `${scheme}//${host}:${config.websocketPort}`;
}

export function resetPluginConfigToDefaults(): void {
  try {
    localStorage.removeItem(PLUGIN_CONFIG_KEY);
    cachedConfig = null;
  } catch (error) {
    console.error("[pluginConfig] Failed to reset config:", error);
    throw error;
  }
}
