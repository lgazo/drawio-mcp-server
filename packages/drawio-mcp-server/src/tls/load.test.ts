import { describe, it, expect } from "@jest/globals";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadManualMaterial } from "./load.js";

function tmpFile(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), "tls-load-"));
  const path = join(dir, "file.pem");
  writeFileSync(path, content);
  return path;
}

const VALID_CERT = `-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n`;
const VALID_KEY = `-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----\n`;

describe("loadManualMaterial", () => {
  it("reads cert and key from disk", () => {
    const certPath = tmpFile(VALID_CERT);
    const keyPath = tmpFile(VALID_KEY);
    const m = loadManualMaterial({ certPath, keyPath });
    expect(m.cert).toBe(VALID_CERT);
    expect(m.key).toBe(VALID_KEY);
  });

  it("throws when cert file missing", () => {
    const keyPath = tmpFile(VALID_KEY);
    expect(() =>
      loadManualMaterial({ certPath: "/nope/cert.pem", keyPath }),
    ).toThrow(/cert.*not found/i);
  });

  it("throws when key file missing", () => {
    const certPath = tmpFile(VALID_CERT);
    expect(() =>
      loadManualMaterial({ certPath, keyPath: "/nope/key.pem" }),
    ).toThrow(/key.*not found/i);
  });

  it("throws when cert lacks BEGIN CERTIFICATE marker", () => {
    const certPath = tmpFile("not pem");
    const keyPath = tmpFile(VALID_KEY);
    expect(() => loadManualMaterial({ certPath, keyPath })).toThrow(
      /BEGIN CERTIFICATE/,
    );
  });

  it("throws when key lacks PRIVATE KEY marker", () => {
    const certPath = tmpFile(VALID_CERT);
    const keyPath = tmpFile("not pem");
    expect(() => loadManualMaterial({ certPath, keyPath })).toThrow(
      /PRIVATE KEY/,
    );
  });
});
