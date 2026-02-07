/**
 * Shared utility functions.
 *
 * Small, reusable helpers that appear in multiple modules.
 * Keeps ESM boilerplate out of business-logic files.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * ESM equivalent of the CommonJS `__dirname` global.
 *
 * Usage:
 * ```ts
 * const __dirname = esmDirname(import.meta.url);
 * ```
 *
 * @param importMetaUrl — pass `import.meta.url` from the calling module.
 */
export function esmDirname(importMetaUrl: string): string {
  return dirname(fileURLToPath(importMetaUrl));
}

/**
 * Read a UTF-8 text file resolved relative to the calling module's directory.
 *
 * Combines `esmDirname`, `path.resolve`, and `readFileSync` into one call
 * so callers don't need to import three `node:` modules individually.
 *
 * @param importMetaUrl — pass `import.meta.url` from the calling module.
 * @param pathSegments  — path segments joined via `path.resolve` (same API as `path.join`).
 */
export function readRelativeFile(importMetaUrl: string, ...pathSegments: string[]): string {
  return readFileSync(resolve(esmDirname(importMetaUrl), ...pathSegments), "utf-8");
}
