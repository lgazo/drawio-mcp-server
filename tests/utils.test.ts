import { describe, test, expect } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs";
import { esmDirname, readRelativeFile } from "../src/utils.js";

// ─── esmDirname ────────────────────────────────────────────────

describe("esmDirname", () => {
  test("returns the directory of the calling module", () => {
    const dir = esmDirname(import.meta.url);
    // This test file lives in tests/, so esmDirname should resolve to that folder
    expect(dir).toMatch(/tests$/);
  });

  test("returns an absolute path", () => {
    const dir = esmDirname(import.meta.url);
    expect(path.isAbsolute(dir)).toBe(true);
  });

  test("does not include a trailing separator", () => {
    const dir = esmDirname(import.meta.url);
    expect(dir.endsWith(path.sep)).toBe(false);
  });
});

// ─── readRelativeFile ──────────────────────────────────────────

describe("readRelativeFile", () => {
  test("reads a file relative to the calling module", () => {
    // Read package.json from tests/ → ..
    const content = readRelativeFile(import.meta.url, "..", "package.json");
    const pkg = JSON.parse(content);
    expect(pkg.name).toBe("drawio-mcp-server");
  });

  test("supports multiple path segments", () => {
    // Read the instructions file through two segments: "..", "src"
    const content = readRelativeFile(import.meta.url, "..", "src", "instructions.md");
    expect(content.length).toBeGreaterThan(0);
  });

  test("returns UTF-8 string content", () => {
    const content = readRelativeFile(import.meta.url, "..", "package.json");
    expect(typeof content).toBe("string");
    // Ensure it's not garbled — valid JSON means valid UTF-8
    expect(() => JSON.parse(content)).not.toThrow();
  });

  test("throws for non-existent file", () => {
    expect(() =>
      readRelativeFile(import.meta.url, "this-file-does-not-exist.txt"),
    ).toThrow();
  });

  test("resolves relative to the module, not cwd", () => {
    // Verify the resolution is module-relative by checking the resolved path
    const dir = esmDirname(import.meta.url);
    const expectedPath = path.resolve(dir, "..", "package.json");
    expect(fs.existsSync(expectedPath)).toBe(true);

    // Reading via readRelativeFile should produce the same content
    const viaUtil = readRelativeFile(import.meta.url, "..", "package.json");
    const viaDirect = fs.readFileSync(expectedPath, "utf-8");
    expect(viaUtil).toBe(viaDirect);
  });
});
