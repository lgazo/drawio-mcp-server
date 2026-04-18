// Pure functional migration logic for config versions
// Handles backward compatibility when config schema changes

import type { ExtensionConfig } from '../config'

/**
 * Pure migration function from old config to new config format
 * Migration removes websocketPort (moved to plugin localStorage) and ensures urlPatterns exist
 */
function isValidWsUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) {
    return false
  }
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'ws:' || parsed.protocol === 'wss:'
  } catch {
    return false
  }
}

export const migrateConfig = (oldConfig: any): ExtensionConfig => {
  if (!oldConfig || typeof oldConfig !== 'object') {
    // Return default config if old config is invalid
    return {
      websocketPort: 3333,
      urlPatterns: ['*://app.diagrams.net/*']
    }
  }

  // Start with clean slate
  const migrated: ExtensionConfig = {
    websocketPort:
      typeof oldConfig.websocketPort === 'number'
        ? oldConfig.websocketPort
        : 3333,
    urlPatterns: ['*://app.diagrams.net/*'] // default
  }

  // Preserve urlPatterns if they exist and are valid
  if (oldConfig.urlPatterns && Array.isArray(oldConfig.urlPatterns)) {
    migrated.urlPatterns = oldConfig.urlPatterns
  }

  // Preserve websocketUrl override if present and valid
  if (isValidWsUrl(oldConfig.websocketUrl)) {
    migrated.websocketUrl = oldConfig.websocketUrl
  }

  return migrated
}

/**
 * Pure function to validate migrated config integrity
 */
export const validateMigratedConfig = (config: ExtensionConfig): boolean => {
  if (typeof config.websocketPort !== 'number') {
    return false
  }
  if (
    !Array.isArray(config.urlPatterns) ||
    config.urlPatterns.length === 0 ||
    !config.urlPatterns.every(pattern => typeof pattern === 'string')
  ) {
    return false
  }
  if (config.websocketUrl !== undefined && !isValidWsUrl(config.websocketUrl)) {
    return false
  }
  return true
}

/**
 * Apply migration and validate result
 * Returns migrated config or throws on validation failure
 */
export const safeMigrateConfig = (oldConfig: any): ExtensionConfig => {
  const migrated = migrateConfig(oldConfig)

  if (!validateMigratedConfig(migrated)) {
    throw new Error('Config migration failed validation')
  }

  return migrated
}
