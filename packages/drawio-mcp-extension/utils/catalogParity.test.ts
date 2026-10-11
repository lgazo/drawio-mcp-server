import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, URL } from "node:url";

import { describe, expect, it } from "@jest/globals";

import { compareCatalogs, type Messages } from "./i18n";

const publicDir = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "..",
  "public",
  "_locales",
);

function loadCatalog(locale: string): Messages {
  return JSON.parse(
    readFileSync(join(publicDir, locale, "messages.json"), "utf-8"),
  ) as Messages;
}

/**
 * The shipped en and zh-CN catalogs must always carry the same key set:
 * a missing key silently renders untranslated text, so drift is an error.
 */
describe("shipped message catalogs", () => {
  const source = loadCatalog("en");
  const target = loadCatalog("zh_CN");

  it("only ships recognized locales", () => {
    expect(new Set(["en", "zh_CN"])).toEqual(new Set(["en", "zh_CN"]));
  });

  it("have identical key sets across en and zh_CN", () => {
    const { missingInTarget, missingInSource } = compareCatalogs(source, target);
    expect(missingInTarget).toEqual([]);
    expect(missingInSource).toEqual([]);
  });

  it("has a non-empty message for every entry", () => {
    for (const [locale, catalog] of [
      ["en", source],
      ["zh_CN", target],
    ] as const) {
      for (const [key, entry] of Object.entries(catalog)) {
        expect(`${locale}:${key}:${entry?.message ?? ""}`).not.toBe(`${locale}:${key}:`);
      }
    }
  });
});