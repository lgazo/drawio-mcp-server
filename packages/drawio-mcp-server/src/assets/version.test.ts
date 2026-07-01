import { describe, expect, it } from "@jest/globals";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readCachedDrawioVersion } from "./version.js";

function makeFixture(contents: string): string {
  const root = mkdtempSync(join(tmpdir(), "drawio-version-"));
  const jsDir = join(root, "js");
  mkdirSync(jsDir, { recursive: true });
  writeFileSync(join(jsDir, "app.min.js"), contents);
  return root;
}

describe("readCachedDrawioVersion", () => {
  it("returns the version parsed from app.min.js", async () => {
    const root = makeFixture(`prefix;EditorUi.VERSION="30.2.6";suffix`);
    await expect(readCachedDrawioVersion(root)).resolves.toBe("30.2.6");
  });

  it("returns null when app.min.js is missing", async () => {
    const root = mkdtempSync(join(tmpdir(), "drawio-version-"));
    await expect(readCachedDrawioVersion(root)).resolves.toBeNull();
  });

  it("returns null when VERSION assignment is absent", async () => {
    const root = makeFixture("no version marker here");
    await expect(readCachedDrawioVersion(root)).resolves.toBeNull();
  });
});
