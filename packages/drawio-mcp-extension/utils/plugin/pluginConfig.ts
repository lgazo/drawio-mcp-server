/**
 * Plugin Configuration Module
 *
 * Pure functions for WebSocket port configuration management
 * Uses localStorage (origin-specific) instead of extension storage
 */

export interface PluginConfig {
  websocketPort: number;
}

// Default configuration
export const DEFAULT_PLUGIN_CONFIG: PluginConfig = {
  websocketPort: 3333,
};

// Storage key for localStorage
const PLUGIN_CONFIG_KEY = 'drawio-mcp-plugin-config';

/**
 * Read configuration from localStorage, or return defaults
 */
export function readPluginConfig(): PluginConfig {
  try {
    const stored = localStorage.getItem(PLUGIN_CONFIG_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validate the parsed config
      const validated = validatePluginConfig(parsed);
      if (validated.isValid && validated.config) {
        return validated.config;
      }
    }
  } catch (error) {
    console.warn('[pluginConfig] Failed to read from localStorage:', error);
  }

  // Return defaults if storage fails or is invalid
  return { ...DEFAULT_PLUGIN_CONFIG };
}

/**
 * Write configuration to localStorage
 */
export function writePluginConfig(config: PluginConfig): void {
  try {
    localStorage.setItem(PLUGIN_CONFIG_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('[pluginConfig] Failed to write to localStorage:', error);
    throw error;
  }
}

/**
 * Merge partial config with defaults
 */
export function createDefaultPluginConfig(partial?: Partial<PluginConfig>): PluginConfig {
  return {
    websocketPort: partial?.websocketPort ?? DEFAULT_PLUGIN_CONFIG.websocketPort,
  };
}

/**
 * Validate configuration object
 */
export function validatePluginConfig(config: unknown): { isValid: boolean; config?: PluginConfig; error?: string } {
  if (!config || typeof config !== 'object') {
    return { isValid: false, error: 'Configuration must be an object' };
  }

  const cfg = config as any;

  // Validate websocketPort
  if (typeof cfg.websocketPort !== 'number') {
    return { isValid: false, error: 'websocketPort must be a number' };
  }

  if (cfg.websocketPort < 1024 || cfg.websocketPort > 65535) {
    return { isValid: false, error: 'websocketPort must be between 1024 and 65535' };
  }

  return {
    isValid: true,
    config: {
      websocketPort: cfg.websocketPort,
    }
  };
}

/**
 * Build WebSocket URL from config
 */
export function buildWebSocketUrl(config: PluginConfig): string {
  return `ws://localhost:${config.websocketPort}`;
}

/**
 * Reset configuration to defaults by clearing from localStorage
 */
export function resetPluginConfigToDefaults(): void {
  try {
    localStorage.removeItem(PLUGIN_CONFIG_KEY);
  } catch (error) {
    console.error('[pluginConfig] Failed to reset config:', error);
    throw error;
  }
}
