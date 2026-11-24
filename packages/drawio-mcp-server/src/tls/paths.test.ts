import { describe, it, expect } from "@jest/globals";
import { join } from "node:path";
import { resolveTlsDir, resolveExportDir, tlsFilePaths } from "./paths.js";

describe("resolveTlsDir", () => {
  it("uses explicit override when provided", () => {
    expect(
      resolveTlsDir({
        override: "/tmp/x",
        platform: "linux",
        env: {},
        home: "/h",
      }),
    ).toBe("/tmp/x");
  });

  it("Linux: honours XDG_DATA_HOME", () => {
    expect(
      resolveTlsDir({
        platform: "linux",
        env: { XDG_DATA_HOME: "/custom/data" },
        home: "/home/u",
      }),
    ).toBe("/custom/data/drawio-mcp-server/tls");
  });

  it("Linux: defaults to ~/.local/share when XDG_DATA_HOME is unset", () => {
    expect(resolveTlsDir({ platform: "linux", env: {}, home: "/home/u" })).toBe(
      "/home/u/.local/share/drawio-mcp-server/tls",
    );
  });

  it("macOS: defaults to ~/Library/Application Support", () => {
    expect(
      resolveTlsDir({ platform: "darwin", env: {}, home: "/Users/u" }),
    ).toBe("/Users/u/Library/Application Support/drawio-mcp-server/tls");
  });

  it("Windows: honours LOCALAPPDATA", () => {
    expect(
      resolveTlsDir({
        platform: "win32",
        env: { LOCALAPPDATA: "C:\\Users\\u\\AppData\\Local" },
        home: "C:\\Users\\u",
      }),
    ).toBe("C:\\Users\\u\\AppData\\Local\\drawio-mcp-server\\tls");
  });

  it("Windows: falls back to ~/AppData/Local when LOCALAPPDATA unset", () => {
    expect(
      resolveTlsDir({ platform: "win32", env: {}, home: "C:\\Users\\u" }),
    ).toBe("C:\\Users\\u\\AppData\\Local\\drawio-mcp-server\\tls");
  });

  it("treats empty XDG_DATA_HOME as unset", () => {
    expect(
      resolveTlsDir({
        platform: "linux",
        env: { XDG_DATA_HOME: "" },
        home: "/h",
      }),
    ).toBe("/h/.local/share/drawio-mcp-server/tls");
  });
});

describe("tlsFilePaths", () => {
  it("returns expected file names under given dir", () => {
    const p = tlsFilePaths("/base");
    expect(p.caCert).toBe(join("/base", "ca.crt"));
    expect(p.caKey).toBe(join("/base", "ca.key"));
    expect(p.serverCert).toBe(join("/base", "server.crt"));
    expect(p.serverKey).toBe(join("/base", "server.key"));
    expect(p.meta).toBe(join("/base", "meta.json"));
  });
});

describe("resolveExportDir", () => {
  it("override wins on every platform", () => {
    const dir = resolveExportDir({
      override: "/custom/exports",
      platform: "linux",
      env: {},
      home: "/home/u",
    });
    expect(dir).toBe("/custom/exports");
  });

  it("linux uses XDG_DATA_HOME", () => {
    const dir = resolveExportDir({
      platform: "linux",
      env: { XDG_DATA_HOME: "/xdg/data" },
      home: "/home/u",
    });
    expect(dir).toBe("/xdg/data/drawio-mcp-server/exports");
  });

  it("linux falls back to ~/.local/share without XDG_DATA_HOME", () => {
    const dir = resolveExportDir({
      platform: "linux",
      env: {},
      home: "/home/u",
    });
    expect(dir).toBe("/home/u/.local/share/drawio-mcp-server/exports");
  });

  it("darwin uses ~/Library/Application Support", () => {
    const dir = resolveExportDir({
      platform: "darwin",
      env: {},
      home: "/home/u",
    });
    expect(dir).toBe(
      "/home/u/Library/Application Support/drawio-mcp-server/exports",
    );
  });

  it("win32 uses LOCALAPPDATA", () => {
    const dir = resolveExportDir({
      platform: "win32",
      env: { LOCALAPPDATA: "C:\\Users\\u\\AppData\\Local" },
      home: "C:\\Users\\u",
    });
    expect(dir).toBe(
      "C:\\Users\\u\\AppData\\Local\\drawio-mcp-server\\exports",
    );
  });

  it("win32 falls back to AppData\\Local without LOCALAPPDATA", () => {
    const dir = resolveExportDir({
      platform: "win32",
      env: {},
      home: "C:\\Users\\u",
    });
    expect(dir).toBe(
      "C:\\Users\\u\\AppData\\Local\\drawio-mcp-server\\exports",
    );
  });
});
