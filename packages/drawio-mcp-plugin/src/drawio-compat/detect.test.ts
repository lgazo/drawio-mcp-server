import { describe, expect, it, beforeEach } from "@jest/globals";
import {
  detectDrawioVersion,
  getDetectedDrawioVersion,
  resetDetectedDrawioVersionCache,
} from "./detect.js";

const g = globalThis as any;

describe("detectDrawioVersion", () => {
  beforeEach(() => {
    delete g.EditorUi;
    resetDetectedDrawioVersionCache();
  });

  it("reads globalThis.EditorUi.VERSION", () => {
    g.EditorUi = { VERSION: "30.2.6" };
    expect(detectDrawioVersion()).toEqual({
      ok: true,
      raw: "30.2.6",
      semver: [30, 2, 6],
    });
  });

  it("falls back to ui.constructor.VERSION", () => {
    const ui = { constructor: { VERSION: "29.6.7" } };
    expect(detectDrawioVersion(ui)).toEqual({
      ok: true,
      raw: "29.6.7",
      semver: [29, 6, 7],
    });
  });

  it("reports `missing` when nothing is present", () => {
    expect(detectDrawioVersion()).toEqual({
      ok: false,
      reason: "missing",
      raw: null,
    });
  });

  it("reports `unparseable` when VERSION is not a semver head", () => {
    g.EditorUi = { VERSION: "nightly" };
    expect(detectDrawioVersion()).toEqual({
      ok: false,
      reason: "unparseable",
      raw: "nightly",
    });
  });
});

describe("getDetectedDrawioVersion (memoized)", () => {
  beforeEach(() => {
    delete g.EditorUi;
    resetDetectedDrawioVersionCache();
  });

  it("caches the first successful result", () => {
    g.EditorUi = { VERSION: "30.2.6" };
    const first = getDetectedDrawioVersion();
    g.EditorUi = { VERSION: "99.0.0" };
    const second = getDetectedDrawioVersion();
    expect(second).toBe(first);
  });
});
