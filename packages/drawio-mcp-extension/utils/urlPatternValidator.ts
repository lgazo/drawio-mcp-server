// Pure functional validation logic for MV3 match patterns
// All functions are pure, testable, and have no side effects

export type ValidationResult = {
  isValid: boolean
  error?: string
}

/**
 * Validate URL scheme (protocol) part of pattern
 * MV3 supports: *, http, https, file, ftp
 */
export const validateScheme = (pattern: string): ValidationResult => {
  const schemePattern = /^(\*|https?|file|ftp):\/\/.*$/
  if (schemePattern.test(pattern)) {
    return { isValid: true }
  }
  return {
    isValid: false,
    error: 'Invalid scheme. Use *, http, https, file, or ftp'
  }
}

/**
 * Validate host part of pattern
 * Supports: *, *.domain.com, domain.com
 */
export const validateHost = (pattern: string): ValidationResult => {
  // Extract host part from pattern: *://host/* → host
  const hostMatch = pattern.match(/^[^:]+:\/\/([^\/]+)/)
  if (!hostMatch) {
    return { isValid: false, error: 'Invalid URL pattern format' }
  }

  const host = hostMatch[1]

  // Valid patterns: *, *.domain, domain, domain.com
  // Individual host segments can contain only alphanumerics, _, -, and .
  const hostPattern = /^(\*|\*\.[^.]+\.|^([^.]+|[^.]+\.[^.]+|[^.]+\.[^.]+\.[^.]+))$/

  if (hostPattern.test(host)) {
    return { isValid: true }
  }

  return {
    isValid: false,
    error: 'Invalid host pattern. Use *, *.example.com, or example.com'
  }
}

/**
 * Validate path part of pattern
 * Path must start with / and can contain * wildcards
 */
export const validatePath = (pattern: string): ValidationResult => {
  // Extract path part from pattern: *://host/path → /path
  const pathMatch = pattern.match(/^[^\/]+:\/\/[^\/]+(\/.*)?/)
  if (!pathMatch) {
    return { isValid: false, error: 'Invalid URL pattern format' }
  }

  const path = pathMatch[1] || '/*' // Default to /* if no path specified

  // Path must start with / and can contain * wildcards
  const pathPattern = /^\/.*$/
  if (pathPattern.test(path)) {
    return { isValid: true }
  }

  return {
    isValid: false,
    error: 'Path must start with /'
  }
}

/**
 * Maintains are all validators in the system, allowing easy composition and management of validation logic
 */
const composeValidators = (validators: ((pattern: string) => ValidationResult)[]) =>
  (pattern: string): ValidationResult => {
    for (const validator of validators) {
      const result = validator(pattern)
      if (!result.isValid) {
        return result
      }
    }
    return { isValid: true }
  }

/**
 * Comprehensive MV3 match pattern validation
 * Combines scheme, host, and path validation
 */
export const validateMV3Pattern = composeValidators([
  validateScheme,
  validateHost,
  validatePath
])

/**
 * Normalize pattern to standard format
 * Converts shorthand patterns to full MV3 format
 */
export const normalizePattern = (pattern: string): string => {
  // Handle * shorthand - becomes *://*/*
  if (pattern === '*') {
    return '*://*/*'
  }

  // Ensure scheme and path are present
  let normalized = pattern

  // Add default scheme if missing
  if (!pattern.includes('://')) {
    normalized = `https://${pattern}`
  }

  // Add default path if missing
  if (!normalized.includes('/', normalized.indexOf('://') + 3)) {
    normalized = `${normalized}/*`
  }

  return normalized
}

/**
 * Check if two patterns are functionally equivalent
 */
export const patternsAreEquivalent = (p1: string, p2: string): boolean => {
  return normalizePattern(p1) === normalizePattern(p2)
}

/**
 * Remove duplicate patterns from array while preserving order
 */
export const deduplicatePatterns = (patterns: string[]): string[] => {
  const seen = new Set<string>()
  return patterns.filter(pattern => {
    const normalized = normalizePattern(pattern)
    if (seen.has(normalized)) {
      return false
    }
    seen.add(normalized)
    return true
  })
}

/**
 * Validate an entire list of patterns
 * Returns results for all patterns, including their indices
 */
export const validatePatternList = (patterns: string[]): Array<ValidationResult & { index: number }> => {
  return patterns.map((pattern, index) => ({
    index,
    ...validateMV3Pattern(pattern)
  }))
}

/**
 * Check if pattern list is valid (all patterns valid and not empty)
 */
export const isValidPatternList = (patterns: string[]): boolean => {
  const validations = validatePatternList(patterns)
  return patterns.length > 0 && validations.every(v => v.isValid)
}
