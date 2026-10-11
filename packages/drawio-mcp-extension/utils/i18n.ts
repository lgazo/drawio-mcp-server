import { readFileSync } from "node:fs";

/**
 * Pure i18n core shared by the popup, the options page, the content script,
 * and the translation pipeline. No browser APIs here — the browser-facing
 * helpers consume these functions.
 */

export type Language = "auto" | "en" | "zh-CN";
export type ResolvedLanguage = "en" | "zh-CN";

export const LANGUAGE_STORAGE_KEY = "drawio-mcp-language";
export const DEFAULT_LANGUAGE: Language = "auto";
export const LOCALE_DIRECTORY: Record<ResolvedLanguage, string> = {
  en: "en",
  "zh-CN": "zh_CN",
};

export function isLanguage(value: unknown): value is Language {
  return value === "auto" || value === "en" || value === "zh-CN";
}

/**
 * Resolve the override setting and the browser's UI locale to a concrete
 * catalog language. `auto` (or an unknown override) follows the browser
 * locale: the zh-CN catalog wins for any zh* browser language; anything
 * else falls back to en.
 */
export function selectLanguage(
  override: unknown,
  browserLocale: string,
): ResolvedLanguage {
  if (override === "en" || override === "zh-CN") return override;
  const locale = (browserLocale ?? "").toLowerCase();
  if (locale.startsWith("zh")) return "zh-CN";
  return "en";
}

/**
 * Replace WebExtension-style placeholders ("$1", "$2", ...) and named
 * `placeholder` definitions ("%%name%%" -> content) in a catalog message.
 */
export function substitute(
  message: string,
  replacements: Record<string, string> | readonly (string | number)[] = [],
): string {
  let result = message;

  if (Array.isArray(replacements)) {
    for (let i = 0; i < replacements.length; i++) {
      result = result.replace(new RegExp(`\\$${i + 1}`, "g"), String(replacements[i]));
    }
    return result;
  }

  for (const [name, value] of Object.entries(replacements as Record<string, string>)) {
    result = result.replace(new RegExp(`%%${name}%%`, "g"), value);
    result = result.replace(new RegExp(`\\$${name}\\$`, "g"), value);
  }

  return result;
}

/**
 * Look a message up in a catalog with a fallback chain:
 * primary catalog -> fallback catalog -> the key itself.
 */
export function lookupMessage(
  catalogs: { primary: Messages | null; fallback: Messages | null },
  key: string,
  replacements?: Record<string, string> | readonly (string | number)[],
): string {
  const entry = catalogs.primary?.[key] ?? catalogs.fallback?.[key];
  if (!entry?.message) return key;
  return substitute(entry.message, replacements);
}

export type Messages = Record<
  string,
  | { message: string; description?: string }
  | undefined
>;

/**
 * Compare the key sets of two message catalogs. Used by tests and by the
 * translation pipeline's --check mode: every key in the source-of-truth
 * `en` catalog must exist in every translated catalog, and vice versa.
 */
export function compareCatalogs(
  source: Messages,
  target: Messages,
): { missingInTarget: string[]; missingInSource: string[] } {
  const sourceKeys = new Set(Object.keys(source));
  const targetKeys = new Set(Object.keys(target));
  return {
    missingInTarget: [...sourceKeys].filter((key) => !targetKeys.has(key)).sort(),
    missingInSource: [...targetKeys].filter((key) => !sourceKeys.has(key)).sort(),
  };
}

/** Read a catalog from disk (used by scripts/translate.mjs --check). */
export function readCatalog(sourcePath: string): Messages {
  return JSON.parse(readFileSync(sourcePath, "utf-8")) as Messages;
}