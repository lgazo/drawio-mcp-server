// Pure functional migration logic for config versions
// Handles backward compatibility when config schema changes

import type { ExtensionConfig } from '../config'

/**
 * Pure migration function from old config to new config format
 * Migration removes websocketPort (moved to plugin localStorage) and ensures urlPatterns exist
 */
export const migrateConfig = (oldConfig: any): ExtensionConfig => {
  if (!oldConfig || typeof oldConfig !== 'object') {
    // Return default config if old config is invalid
    return {
      urlPatterns: ['*://app.diagrams.net/*']
    }
  }

  // Start with clean slate
  const migrated: ExtensionConfig = {
    urlPatterns: ['*://app.diagrams.net/*'] // default
  }

  // Preserve urlPatterns if they exist and are valid
  if (oldConfig.urlPatterns && Array.isArray(oldConfig.urlPatterns)) {
    migrated.urlPatterns = oldConfig.urlPatterns
  }

  // Log migration if websocketPort was removed
  if (oldConfig.websocketPort !== undefined) {
    console.info('[config-migration] Migrating config: removed websocketPort (moved to plugin localStorage), preserving urlPatterns')
  }

  return migrated
}

/**
 * Pure function to validate migrated config integrity
 */
export const validateMigratedConfig = (config: ExtensionConfig): boolean => {
  return (
    Array.isArray(config.urlPatterns) &&
    config.urlPatterns.length > 0 &&
    config.urlPatterns.every(pattern => typeof pattern === 'string')
  )
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
