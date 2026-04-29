import { describe, test, expect, beforeAll } from "@jest/globals";
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolveDrawioPluginsDir,
  installDesktopPlugin,
} from "./install-desktop-plugin.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("resolveDrawioPluginsDir", () => {
  test("linux with XDG_CONFIG_HOME unset uses ~/.config", () => {
    const result = resolveDrawioPluginsDir("linux", {});
    expect(result).toBe(join(homedir(), ".config", "draw.io", "plugins"));
  });

  test("linux with XDG_CONFIG_HOME set uses it", () => {
    const result = resolveDrawioPluginsDir("linux", {
      XDG_CONFIG_HOME: "/custom/xdg",
    });
    expect(result).toBe("/custom/xdg/draw.io/plugins");
  });

  test("darwin uses Library/Application Support", () => {
    const result = resolveDrawioPluginsDir("darwin", {});
    expect(result).toBe(
      join(
        homedir(),
        "Library",
        "Application Support",
        "draw.io",
        "plugins",
      ),
    );
  });

  test("win32 uses APPDATA", () => {
    const result = resolveDrawioPluginsDir("win32", {
      APPDATA: "C:\\Users\\test\\AppData\\Roaming",
    });
    expect(result).toBe(
      join("C:\\Users\\test\\AppData\\Roaming", "draw.io", "plugins"),
    );
  });

  test("win32 without APPDATA throws", () => {
    expect(() => resolveDrawioPluginsDir("win32", {})).toThrow(/APPDATA/);
  });
});

describe("installDesktopPlugin", () => {
  // The compiled tests live in build/, so __dirname is .../build, which makes
  // getBundledPluginPath() resolve to .../build/../build/plugin/mcp-plugin.js
  // i.e. .../build/plugin/mcp-plugin.js — same path the build script populates.
  const expectedSource = join(__dirname, "..", "build", "plugin", "mcp-plugin.js");

  beforeAll(() => {
    if (!existsSync(expectedSource)) {
      mkdirSync(dirname(expectedSource), { recursive: true });
      writeFileSync(expectedSource, "// fixture mcp-plugin.js\n");
    }
  });

  test("copies bundled plugin to target dir", async () => {
    const targetDir = mkdtempSync(join(tmpdir(), "drawio-plugin-install-"));

    const result = await installDesktopPlugin({ targetDir });

    expect(result.pluginsDir).toBe(targetDir);
    expect(result.installedPath).toBe(join(targetDir, "mcp-plugin.js"));
    expect(result.overwrote).toBe(false);
    expect(existsSync(result.installedPath)).toBe(true);
    expect(readFileSync(result.installedPath, "utf8")).toBe(
      readFileSync(expectedSource, "utf8"),
    );
  });

  test("second install overwrites and reports overwrote: true", async () => {
    const targetDir = mkdtempSync(join(tmpdir(), "drawio-plugin-install-"));

    await installDesktopPlugin({ targetDir });
    const result = await installDesktopPlugin({ targetDir });

    expect(result.overwrote).toBe(true);
  });

  test("creates plugins dir if missing", async () => {
    const parent = mkdtempSync(join(tmpdir(), "drawio-plugin-install-"));
    const targetDir = join(parent, "nested", "plugins");

    expect(existsSync(targetDir)).toBe(false);

    const result = await installDesktopPlugin({ targetDir });

    expect(existsSync(result.installedPath)).toBe(true);
  });
});
