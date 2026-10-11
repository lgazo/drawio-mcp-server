import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  LOCALE_DIRECTORY,
  lookupMessage,
  selectLanguage,
  type Language,
  type Messages,
  type ResolvedLanguage,
} from "./i18n";

/**
 * Browser-facing i18n runtime. In `auto` mode it delegates to the
 * WebExtension i18n API (which resolves the browser UI locale and applies
 * `default_locale`); with an explicit language override it loads both the
 * chosen catalog and the English catalog and looks messages up with an
 * English fallback.
 */

export type Translator = (key: string, ...replacements: (string | number)[]) => string;

type GetUrlPath = Parameters<typeof browser.runtime.getURL>[0];

async function loadCatalog(language: ResolvedLanguage): Promise<Messages> {
  const path = `/_locales/${LOCALE_DIRECTORY[language]}/messages.json` as GetUrlPath;
  const response = await fetch(browser.runtime.getURL(path));
  if (!response.ok) {
    throw new Error(
      `Failed to load _locales/${LOCALE_DIRECTORY[language]}/messages.json: ${response.status}`,
    );
  }
  return (await response.json()) as Messages;
}

function catalogTranslator(
  primary: Messages | null,
  fallback: Messages | null,
): Translator {
  return (key, ...replacements) => lookupMessage({ primary, fallback }, key, replacements);
}

function autoTranslator(): Translator {
  return (key, ...replacements) =>
    browser.i18n.getMessage(
      key as Parameters<typeof browser.i18n.getMessage>[0],
      replacements.map(String),
    ) || key;
}

async function buildTranslator(language: Language): Promise<Translator> {
  const resolved = selectLanguage(
    language,
    browser.i18n.getUILanguage?.() ?? "",
  );
  if (resolved === "en") {
    // Explicit English override: bypass the UI locale so a zh-browser
    // setting still shows English.
    return language === "en" ? catalogTranslator(await loadCatalog("en"), null) : autoTranslator();
  }
  return catalogTranslator(await loadCatalog("zh-CN"), await loadCatalog("en"));
}

export async function getActiveLanguage(): Promise<Language> {
  try {
    const storage = browser.storage.sync || browser.storage.local;
    const stored = await storage.get(LANGUAGE_STORAGE_KEY);
    const value = stored?.[LANGUAGE_STORAGE_KEY];
    if (value === "en" || value === "zh-CN" || value === "auto") return value;
  } catch (error) {
    console.warn("[i18n] Failed to read language preference:", error);
  }
  return DEFAULT_LANGUAGE;
}

export async function saveActiveLanguage(language: Language): Promise<void> {
  const storage = browser.storage.sync || browser.storage.local;
  await storage.set({ [LANGUAGE_STORAGE_KEY]: language });
}

/**
 * Load the translator honoring the stored language preference. The content
 * script and non-React callers use this directly.
 */
export async function loadTranslator(): Promise<{ t: Translator; language: Language }> {
  const language = await getActiveLanguage();
  const t = await buildTranslator(language);
  return { t, language };
}