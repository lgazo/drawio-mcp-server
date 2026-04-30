import { describe, it, expect } from "@jest/globals";
import { mkdtempSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveTlsMaterial } from "./index.js";
import { tlsFilePaths } from "./paths.js";

function tmpDir(prefix = "tls-resolve-"): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

function writePem(dir: string, name: string, body: string): string {
  const p = join(dir, name);
  writeFileSync(p, body);
  return p;
}

const VALID_CERT = `-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n`;
const VALID_KEY = `-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----\n`;

describe("resolveTlsMaterial — none", () => {
  it("returns null when TLS disabled", () => {
    expect(
      resolveTlsMaterial({
        config: { tlsEnabled: false },
        log: () => {},
      }),
    ).toBeNull();
  });
});

describe("resolveTlsMaterial — manual", () => {
  it("loads cert + key from explicit paths", () => {
    const dir = tmpDir();
    const certPath = writePem(dir, "c.pem", VALID_CERT);
    const keyPath = writePem(dir, "k.pem", VALID_KEY);

    const m = resolveTlsMaterial({
      config: { tlsEnabled: true, tlsCert: certPath, tlsKey: keyPath },
      log: () => {},
    });

    expect(m).toEqual({ cert: VALID_CERT, key: VALID_KEY, caPath: undefined });
  });
});

describe("resolveTlsMaterial — auto", () => {
  it("first run generates CA + leaf and returns material with caPath", () => {
    const dir = tmpDir();
    const messages: string[] = [];

    const m = resolveTlsMaterial({
      config: { tlsEnabled: true, tlsAuto: true, tlsDir: dir, host: undefined },
      log: (msg) => messages.push(msg),
    });

    expect(m?.cert).toContain("BEGIN CERTIFICATE");
    expect(m?.key).toContain("PRIVATE KEY");
    expect(m?.caPath).toBe(tlsFilePaths(dir).caCert);
    expect(existsSync(tlsFilePaths(dir).caCert)).toBe(true);
    expect(existsSync(tlsFilePaths(dir).caKey)).toBe(true);
    expect(existsSync(tlsFilePaths(dir).serverCert)).toBe(true);
    expect(existsSync(tlsFilePaths(dir).serverKey)).toBe(true);
    expect(messages.some((m) => m.includes("Install the local CA"))).toBe(true);
  });

  it("second run reuses material when SAN unchanged and material valid", () => {
    const dir = tmpDir();
    const m1 = resolveTlsMaterial({
      config: { tlsEnabled: true, tlsAuto: true, tlsDir: dir, host: undefined },
      log: () => {},
    });
    const caBefore = readFileSync(tlsFilePaths(dir).caCert, "utf8");
    const leafBefore = readFileSync(tlsFilePaths(dir).serverCert, "utf8");

    const m2 = resolveTlsMaterial({
      config: { tlsEnabled: true, tlsAuto: true, tlsDir: dir, host: undefined },
      log: () => {},
    });

    expect(m2?.cert).toBe(m1?.cert);
    expect(readFileSync(tlsFilePaths(dir).caCert, "utf8")).toBe(caBefore);
    expect(readFileSync(tlsFilePaths(dir).serverCert, "utf8")).toBe(leafBefore);
  });

  it("regenerates leaf only (CA preserved) when SAN changes", () => {
    const dir = tmpDir();
    resolveTlsMaterial({
      config: { tlsEnabled: true, tlsAuto: true, tlsDir: dir, host: undefined },
      log: () => {},
    });
    const caBefore = readFileSync(tlsFilePaths(dir).caCert, "utf8");
    const leafBefore = readFileSync(tlsFilePaths(dir).serverCert, "utf8");

    const m2 = resolveTlsMaterial({
      config: {
        tlsEnabled: true,
        tlsAuto: true,
        tlsDir: dir,
        host: "192.168.1.10",
      },
      log: () => {},
    });

    expect(readFileSync(tlsFilePaths(dir).caCert, "utf8")).toBe(caBefore);
    expect(readFileSync(tlsFilePaths(dir).serverCert, "utf8")).not.toBe(
      leafBefore,
    );
    expect(m2?.cert).toContain("BEGIN CERTIFICATE");
  });

  it("throws when both manual and auto specified", () => {
    expect(() =>
      resolveTlsMaterial({
        config: {
          tlsEnabled: true,
          tlsAuto: true,
          tlsCert: "/c",
          tlsKey: "/k",
        },
        log: () => {},
      }),
    ).toThrow(/cannot combine.*--tls-auto.*--tls-cert/i);
  });

  it("throws when tlsEnabled but no mode chosen", () => {
    expect(() =>
      resolveTlsMaterial({ config: { tlsEnabled: true }, log: () => {} }),
    ).toThrow(/--tls requires either --tls-auto or --tls-cert\/--tls-key/i);
  });

  it("renews leaf only (CA preserved) when leaf is within 30-day window", () => {
    const dir = tmpDir();
    resolveTlsMaterial({
      config: { tlsEnabled: true, tlsAuto: true, tlsDir: dir, host: undefined },
      log: () => {},
      now: new Date("2024-01-01T00:00:00Z"),
    });
    const caBefore = readFileSync(tlsFilePaths(dir).caCert, "utf8");
    const leafBefore = readFileSync(tlsFilePaths(dir).serverCert, "utf8");

    const messages: string[] = [];
    resolveTlsMaterial({
      config: { tlsEnabled: true, tlsAuto: true, tlsDir: dir, host: undefined },
      log: (msg) => messages.push(msg),
      now: new Date("2024-12-10T00:00:00Z"),
    });

    expect(readFileSync(tlsFilePaths(dir).caCert, "utf8")).toBe(caBefore);
    expect(readFileSync(tlsFilePaths(dir).serverCert, "utf8")).not.toBe(
      leafBefore,
    );
    expect(messages.some((m) => m.includes("Renewed TLS leaf"))).toBe(true);
  });

  it("regenerates CA + leaf when CA is within 30-day window", () => {
    const dir = tmpDir();
    resolveTlsMaterial({
      config: { tlsEnabled: true, tlsAuto: true, tlsDir: dir, host: undefined },
      log: () => {},
      now: new Date("2024-01-01T00:00:00Z"),
    });
    const caBefore = readFileSync(tlsFilePaths(dir).caCert, "utf8");

    const messages: string[] = [];
    resolveTlsMaterial({
      config: { tlsEnabled: true, tlsAuto: true, tlsDir: dir, host: undefined },
      log: (msg) => messages.push(msg),
      now: new Date("2033-12-10T00:00:00Z"),
    });

    expect(readFileSync(tlsFilePaths(dir).caCert, "utf8")).not.toBe(caBefore);
    expect(messages.some((m) => m.includes("Install the local CA"))).toBe(true);
  });
});
