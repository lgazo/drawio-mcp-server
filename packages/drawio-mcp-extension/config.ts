// Configuration interface
export interface ExtensionConfig {
  websocketPort: number;
  urlPatterns: string[];
}

import { safeMigrateConfig } from './utils/configMigration';

// Default configuration
export const DEFAULT_CONFIG: ExtensionConfig = {
  websocketPort: 3333,
  urlPatterns: ["*://app.diagrams.net/*"],
};

// Storage key
export const CONFIG_STORAGE_KEY = 'drawio-mcp-config';

// Configuration service functions

/**
 * Load configuration from storage, apply migration, or return defaults
 */
export async function getConfig(): Promise<ExtensionConfig> {
  try {
    const storage = browser.storage.sync || browser.storage.local;
    const result = await storage.get(CONFIG_STORAGE_KEY);

    if (result && result[CONFIG_STORAGE_KEY]) {
      const storedConfig = result[CONFIG_STORAGE_KEY];

      // Migrate config (adds urlPatterns if missing)
      const migratedConfig = safeMigrateConfig(storedConfig);

      // Return migrated config
      return migratedConfig;
    }
  } catch (error) {
    console.warn('[config] Failed to load config from storage:', error);
  }

  // Return defaults if storage fails or is invalid
  return { ...DEFAULT_CONFIG };
}

/**
 * Save configuration to storage
 */
export async function saveConfig(config: ExtensionConfig): Promise<void> {
  try {
    const storage = browser.storage.sync || browser.storage.local;
    await storage.set({
      [CONFIG_STORAGE_KEY]: config
    });
  } catch (error) {
    console.error('[config] Failed to save config to storage:', error);
    throw error;
  }
}

/**
 * Build WebSocket URL from stored config
 */
export async function getWebSocketUrl(): Promise<string> {
  const config = await getConfig();
  return `ws://localhost:${config.websocketPort}`;
}

/**
 * Reset configuration to defaults
 */
export async function resetConfigToDefaults(): Promise<void> {
  await saveConfig({ ...DEFAULT_CONFIG });
}
