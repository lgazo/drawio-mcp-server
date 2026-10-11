import { describe, expect, it } from "@jest/globals";

import {
  compareCatalogs,
  lookupMessage,
  selectLanguage,
  substitute,
  type Messages,
} from "./i18n";

describe("selectLanguage", () => {
  it("honors an explicit override", () => {
    expect(selectLanguage("zh-CN", "en-US")).toBe("zh-CN");
    expect(selectLanguage("en", "zh-CN")).toBe("en");
  });

  it("follows the browser locale on auto", () => {
    expect(selectLanguage("auto", "zh-CN")).toBe("zh-CN");
    expect(selectLanguage("auto", "zh_TW")).toBe("zh-CN");
    expect(selectLanguage("auto", "en-US")).toBe("en");
    expect(selectLanguage("auto", "")).toBe("en");
  });

  it("falls back to en on unknown overrides", () => {
    expect(selectLanguage("klingon", "en-US")).toBe("en");
    expect(selectLanguage(undefined, "en-US")).toBe("en");
  });
});

describe("substitute", () => {
  it("replaces positional placeholders", () => {
    expect(substitute("mode: $1 · $2 pages · current: $3", ["edit", 4, "Page 1"]))
      .toBe("mode: edit · 4 pages · current: Page 1");
  });

  it("replaces repeated placeholders", () => {
    expect(substitute("$1 and $1", ["x"])).toBe("x and x");
  });

  it("replaces named placeholders in both notations", () => {
    expect(substitute("Hello %%name%%, bye $name$", { name: "Ada" }))
      .toBe("Hello Ada, bye Ada");
  });
});

describe("lookupMessage", () => {
  const primary: Messages = {
    greeting: { message: "你好" },
    positional: { message: "已连接文档（$1）" },
  };
  const fallback: Messages = {
    greeting: { message: "Hello" },
    only_en: { message: "English only $1" },
  };

  it("prefers the primary catalog", () => {
    expect(lookupMessage({ primary, fallback }, "greeting")).toBe("你好");
  });

  it("falls back to the English catalog", () => {
    expect(lookupMessage({ primary, fallback }, "only_en", ["ok"]))
      .toBe("English only ok");
  });

  it("returns the key when no catalog has it", () => {
    expect(lookupMessage({ primary, fallback }, "missing")).toBe("missing");
  });
});

describe("compareCatalogs", () => {
  it("finds keys missing in either direction", () => {
    expect(
      compareCatalogs({ a: { message: "a" }, b: { message: "b" } }, { b: { message: "b" } }),
    ).toEqual({ missingInTarget: ["a"], missingInSource: [] });
  });
});