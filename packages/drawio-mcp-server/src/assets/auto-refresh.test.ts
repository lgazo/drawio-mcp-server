import { describe, expect, it, jest } from "@jest/globals";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureSupportedAssets } from "./auto-refresh.js";
import { SERVER_COMPAT_MATRIX } from "../drawio-compat/matrix.js";

function makeCachedVersion(version: string): string {
  const root = mkdtempSync(join(tmpdir(), "auto-refresh-"));
  const webapp = join(root, "webapp");
  const jsDir = join(webapp, "js");
  mkdirSync(jsDir, { recursive: true });
  writeFileSync(
    join(jsDir, "app.min.js"),
    `pre;EditorUi.VERSION="${version}";post`,
  );
  return root;
}

const logger = {
  log: jest.fn(),
} as any;

describe("ensureSupportedAssets", () => {
  it("returns cached version without refetch when in range", async () => {
    const cacheDir = makeCachedVersion("30.2.6");
    const download = jest.fn(async () => {});
    const result = await ensureSupportedAssets(
      { assetPath: cacheDir },
      SERVER_COMPAT_MATRIX,
      logger,
      { downloadAndExtract: download },
    );
    expect(download).not.toHaveBeenCalled();
    expect(result).toEqual({ version: "30.2.6", refetched: false });
  });

  it("wipes cache and re-downloads when cached is out of window", async () => {
    const cacheDir = makeCachedVersion("28.0.0");
    const download = jest.fn(async (target: string) => {
      const jsDir = join(target, "webapp", "js");
      mkdirSync(jsDir, { recursive: true });
      writeFileSync(
        join(jsDir, "app.min.js"),
        `pre;EditorUi.VERSION="30.2.6";post`,
      );
    });
    const result = await ensureSupportedAssets(
      { assetPath: cacheDir },
      SERVER_COMPAT_MATRIX,
      logger,
      { downloadAndExtract: download },
    );
    expect(download).toHaveBeenCalled();
    expect(result).toEqual({ version: "30.2.6", refetched: true });
  });

  it("logs error when refetched version is still out of window", async () => {
    const cacheDir = makeCachedVersion("28.0.0");
    const download = jest.fn(async (target: string) => {
      const jsDir = join(target, "webapp", "js");
      mkdirSync(jsDir, { recursive: true });
      writeFileSync(
        join(jsDir, "app.min.js"),
        `pre;EditorUi.VERSION="28.5.0";post`,
      );
    });
    const errorLogs: unknown[] = [];
    const trackingLogger = {
      log: (level: string, ...args: unknown[]) => {
        if (level === "error") errorLogs.push(args);
      },
    } as any;
    await ensureSupportedAssets(
      { assetPath: cacheDir },
      SERVER_COMPAT_MATRIX,
      trackingLogger,
      { downloadAndExtract: download },
    );
    expect(errorLogs.length).toBeGreaterThan(0);
  });
});
