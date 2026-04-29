import { describe, it, expect } from "@jest/globals";
import { caInstallHint } from "./install-hint.js";

describe("caInstallHint", () => {
  it("Linux hint mentions update-ca-certificates and Firefox NSS", () => {
    const hint = caInstallHint({ platform: "linux", caPath: "/x/ca.crt" });
    expect(hint).toContain("/x/ca.crt");
    expect(hint).toMatch(/update-ca-certificates|trust anchor/i);
    expect(hint).toMatch(/firefox/i);
  });

  it("macOS hint mentions security add-trusted-cert", () => {
    const hint = caInstallHint({ platform: "darwin", caPath: "/x/ca.crt" });
    expect(hint).toContain("security add-trusted-cert");
    expect(hint).toContain("/x/ca.crt");
  });

  it("Windows hint mentions certutil -addstore", () => {
    const hint = caInstallHint({
      platform: "win32",
      caPath: "C:\\x\\ca.crt",
    });
    expect(hint).toContain("certutil");
    expect(hint).toContain("ROOT");
    expect(hint).toContain("C:\\x\\ca.crt");
  });

  it("falls back to generic hint on unknown platform", () => {
    const hint = caInstallHint({
      platform: "freebsd" as NodeJS.Platform,
      caPath: "/x/ca.crt",
    });
    expect(hint).toContain("/x/ca.crt");
    expect(hint).toMatch(/trust store/i);
  });
});
