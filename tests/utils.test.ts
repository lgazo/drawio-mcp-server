import { describe, it } from "@std/testing/bdd";
import { assertEquals, assert, assertMatch, assertThrows } from "@std/assert";
import { isAbsolute, resolve, SEPARATOR } from "@std/path";
import { esmDirname, readRelativeFile } from "../src/utils.ts";

// ─── esmDirname ────────────────────────────────────────────────

describe("esmDirname", () => {
  it("returns the directory of the calling module", () => {
    const dir = esmDirname(import.meta.url);
    // This test file lives in tests/, so esmDirname should resolve to that folder
    assertMatch(dir, /tests$/);
  });

  it("returns an absolute path", () => {
    const dir = esmDirname(import.meta.url);
    assertEquals(isAbsolute(dir), true);
  });

  it("does not include a trailing separator", () => {
    const dir = esmDirname(import.meta.url);
    assertEquals(dir.endsWith(SEPARATOR), false);
  });
});

// ─── readRelativeFile ──────────────────────────────────────────

describe("readRelativeFile", () => {
  it("reads a file relative to the calling module", () => {
    // Read deno.json from tests/ → ..
    const content = readRelativeFile(import.meta.url, "..", "deno.json");
    const config = JSON.parse(content);
    assertEquals(config.name, "@drawio/mcp-server");
  });

  it("supports multiple path segments", () => {
    // Read the instructions file through two segments: "..", "src"
    const content = readRelativeFile(import.meta.url, "..", "src", "instructions.md");
    assert(content.length > 0);
  });

  it("returns UTF-8 string content", () => {
    const content = readRelativeFile(import.meta.url, "..", "deno.json");
    assertEquals(typeof content, "string");
    // Ensure it's not garbled — valid JSON means valid UTF-8
    JSON.parse(content); // throws if invalid
  });

  it("throws for non-existent file", () => {
    assertThrows(() =>
      readRelativeFile(import.meta.url, "this-file-does-not-exist.txt"),
    );
  });

  it("resolves relative to the module, not cwd", () => {
    // Verify the resolution is module-relative by checking the resolved path
    const dir = esmDirname(import.meta.url);
    const expectedPath = resolve(dir, "..", "deno.json");

    // File should exist at the expected path
    const stat = Deno.statSync(expectedPath);
    assert(stat.isFile);

    // Reading via readRelativeFile should produce the same content
    const viaUtil = readRelativeFile(import.meta.url, "..", "deno.json");
    const viaDirect = Deno.readTextFileSync(expectedPath);
    assertEquals(viaUtil, viaDirect);
  });
});
