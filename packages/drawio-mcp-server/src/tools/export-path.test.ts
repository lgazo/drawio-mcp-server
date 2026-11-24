import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { resolveConfinedExportPath } from "./export-path.js";

function makeExportDir(): string {
  return mkdtempSync(join(tmpdir(), "export-confine-"));
}

describe("resolveConfinedExportPath", () => {
  let exportDir: string;

  beforeEach(() => {
    exportDir = makeExportDir();
  });

  test("absolute path inside export dir resolves unchanged", () => {
    const target = join(exportDir, "out.svg");
    const result = resolveConfinedExportPath(exportDir, target);
    expect(result).toBe(target);
  });

  test("relative path resolves inside export dir", () => {
    const result = resolveConfinedExportPath(exportDir, "out.svg");
    expect(result).toBe(join(exportDir, "out.svg"));
  });

  test("relative path with subdirectory resolves inside export dir", () => {
    const result = resolveConfinedExportPath(exportDir, "sub/out.svg");
    expect(result).toBe(join(exportDir, "sub", "out.svg"));
  });

  test("traversal escaping the dir is rejected", () => {
    const result = resolveConfinedExportPath(exportDir, "../escape.svg");
    expect(result).toBeInstanceOf(Error);
  });

  test("absolute path outside the dir is rejected", () => {
    const result = resolveConfinedExportPath(exportDir, "/etc/passwd");
    expect(result).toBeInstanceOf(Error);
  });

  test("sneaky traversal that lands back inside is allowed", () => {
    const result = resolveConfinedExportPath(exportDir, "sub/../in.svg");
    expect(result).toBe(join(exportDir, "in.svg"));
  });

  test("symlink inside the dir pointing outside is rejected", () => {
    const outside = mkdtempSync(join(tmpdir(), "outside-"));
    const linkDir = join(exportDir, "link");
    symlinkSync(outside, linkDir);
    const result = resolveConfinedExportPath(exportDir, "link/evil.svg");
    expect(result).toBeInstanceOf(Error);
  });

  test("dangling symlink tail pointing outside is rejected", () => {
    const outside = mkdtempSync(join(tmpdir(), "outside-"));
    const link = join(exportDir, "dangling.svg");
    symlinkSync(join(outside, "does-not-exist.svg"), link);
    const result = resolveConfinedExportPath(exportDir, "dangling.svg");
    expect(result).toBeInstanceOf(Error);
  });

  test("existing file target inside the dir is allowed (overwrite)", () => {
    const target = join(exportDir, "existing.svg");
    writeFileSync(target, "old");
    const result = resolveConfinedExportPath(exportDir, target);
    expect(result).toBe(target);
  });

  test("missing export dir is created on demand", () => {
    const nested = join(exportDir, "created/deep");
    const result = resolveConfinedExportPath(nested, "out.svg");
    expect(result).toBe(join(nested, "out.svg"));
  });

  test("error message names the export dir", () => {
    const result = resolveConfinedExportPath(exportDir, "../escape.svg");
    expect((result as Error).message).toContain(exportDir);
  });
});
