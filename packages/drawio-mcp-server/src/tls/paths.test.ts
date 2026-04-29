import { describe, it, expect } from "@jest/globals";
import { join } from "node:path";
import { resolveTlsDir, tlsFilePaths } from "./paths.js";

describe("resolveTlsDir", () => {
  it("uses explicit override when provided", () => {
    expect(resolveTlsDir({ override: "/tmp/x", platform: "linux", env: {}, home: "/h" }))
      .toBe("/tmp/x");
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
    expect(
      resolveTlsDir({ platform: "linux", env: {}, home: "/home/u" }),
    ).toBe("/home/u/.local/share/drawio-mcp-server/tls");
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
    ).toBe("C:\\Users\\u\\AppData\\Local\\drawio-mcp-server\\Data\\tls");
  });

  it("Windows: falls back to ~/AppData/Local when LOCALAPPDATA unset", () => {
    expect(
      resolveTlsDir({ platform: "win32", env: {}, home: "C:\\Users\\u" }),
    ).toBe("C:\\Users\\u\\AppData\\Local\\drawio-mcp-server\\Data\\tls");
  });

  it("treats empty XDG_DATA_HOME as unset", () => {
    expect(
      resolveTlsDir({ platform: "linux", env: { XDG_DATA_HOME: "" }, home: "/h" }),
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
