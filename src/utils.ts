/**
 * Shared utility functions.
 *
 * Small, reusable helpers that appear in multiple modules.
 * Keeps path-resolution boilerplate out of business-logic files.
 *
 * Uses Deno-native APIs:
 *   - `@std/path` for path manipulation and `file://` URL conversion
 *   - `Deno.readTextFileSync` for synchronous file reads
 */

import { dirname, fromFileUrl, resolve } from "@std/path";

/**
 * ESM equivalent of the CommonJS `__dirname` global.
 *
 * Converts a `file://` URL (from `import.meta.url`) to its parent directory path.
 *
 * Usage:
 * ```ts
 * const __dirname = esmDirname(import.meta.url);
 * ```
 *
 * @param importMetaUrl — pass `import.meta.url` from the calling module.
 */
export function esmDirname(importMetaUrl: string): string {
  return dirname(fromFileUrl(importMetaUrl));
}

/**
 * Read a UTF-8 text file resolved relative to the calling module's directory.
 *
 * Combines `esmDirname`, `resolve`, and `Deno.readTextFileSync` into one call
 * so callers don't need to import multiple modules individually.
 *
 * @param importMetaUrl — pass `import.meta.url` from the calling module.
 * @param pathSegments  — path segments joined via `resolve` (same API as `path.join`).
 */
export function readRelativeFile(importMetaUrl: string, ...pathSegments: string[]): string {
  return Deno.readTextFileSync(resolve(esmDirname(importMetaUrl), ...pathSegments));
}
