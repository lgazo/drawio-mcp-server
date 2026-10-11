import { useEffect, useState } from "react";

import type { Language } from "./i18n";
import { loadTranslator, saveActiveLanguage, type Translator } from "./i18nRuntime";

// Synchronous first paint: `auto` behavior straight from the WebExtension
// i18n API. Once the stored preference resolves, the translator is swapped.
const initialTranslator: Translator = (key, ...replacements) =>
  browser.i18n.getMessage(
    key as Parameters<typeof browser.i18n.getMessage>[0],
    replacements.map(String),
  ) || key;

/**
 * React hook exposing the localized `t()`. Renders with the browser-locale
 * catalog immediately, then loads the stored language override (if any) in
 * an effect. Pages apply a language change on their next open.
 */
export function useI18n(): {
  t: Translator;
  language: Language | undefined;
  setLanguage: (language: Language) => Promise<void>;
} {
  const [t, setT] = useState<Translator>(() => initialTranslator);
  const [language, setLanguageState] = useState<Language | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    loadTranslator().then((result) => {
      if (!cancelled) {
        setT(() => result.t);
        setLanguageState(result.language);
      }
    }).catch((error) => console.warn("[i18n] Failed to load translator:", error));
    return () => {
      cancelled = true;
    };
  }, []);

  const setLanguage = async (next: Language) => {
    await saveActiveLanguage(next);
    const result = await loadTranslator();
    setT(() => result.t);
    setLanguageState(result.language);
  };

  return { t, language, setLanguage };
}