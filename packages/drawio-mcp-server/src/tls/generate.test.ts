import { describe, it, expect } from "@jest/globals";
import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import forge from "node-forge";
import {
  generateCa,
  generateLeaf,
  writeMaterial,
  readMeta,
} from "./generate.js";
import { tlsFilePaths } from "./paths.js";
import { buildSanList } from "./san.js";

describe("generateCa", () => {
  it("produces a self-signed CA cert with basicConstraints CA:true", () => {
    const ca = generateCa({ now: new Date("2026-01-01T00:00:00Z") });
    const cert = forge.pki.certificateFromPem(ca.certPem);
    const bc = cert.getExtension("basicConstraints") as
      | { cA: boolean }
      | undefined;
    expect(bc?.cA).toBe(true);
  });

  it("validity is 10 years from `now`", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const ca = generateCa({ now });
    const cert = forge.pki.certificateFromPem(ca.certPem);
    expect(cert.validity.notBefore.toISOString()).toBe(
      "2026-01-01T00:00:00.000Z",
    );
    expect(cert.validity.notAfter.toISOString()).toBe(
      "2036-01-01T00:00:00.000Z",
    );
  });

  it("subject CN identifies the app", () => {
    const ca = generateCa({ now: new Date() });
    const cert = forge.pki.certificateFromPem(ca.certPem);
    const cn = cert.subject.getField("CN")?.value;
    expect(cn).toBe("drawio-mcp-server local CA");
  });
});

describe("generateLeaf", () => {
  const ca = generateCa({ now: new Date("2026-01-01T00:00:00Z") });
  const sanList = buildSanList("192.168.1.10");

  it("is signed by the CA (issuer = CA subject)", () => {
    const leaf = generateLeaf({
      ca,
      sanList,
      now: new Date("2026-01-01T00:00:00Z"),
    });
    const cert = forge.pki.certificateFromPem(leaf.certPem);
    const caCert = forge.pki.certificateFromPem(ca.certPem);
    expect(cert.issuer.hash).toBe(caCert.subject.hash);
  });

  it("validity is 1 year from `now`", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const leaf = generateLeaf({ ca, sanList, now });
    const cert = forge.pki.certificateFromPem(leaf.certPem);
    expect(cert.validity.notAfter.toISOString()).toBe(
      "2027-01-01T00:00:00.000Z",
    );
  });

  it("includes every SAN entry with correct type", () => {
    const leaf = generateLeaf({ ca, sanList, now: new Date() });
    const cert = forge.pki.certificateFromPem(leaf.certPem);
    const ext = cert.getExtension("subjectAltName") as
      | { altNames: { type: number; value?: string; ip?: string }[] }
      | undefined;
    const altNames = ext?.altNames ?? [];
    expect(
      altNames.find((a) => a.type === 2 && a.value === "localhost"),
    ).toBeTruthy();
    expect(
      altNames.find((a) => a.type === 7 && a.ip === "127.0.0.1"),
    ).toBeTruthy();
    expect(altNames.find((a) => a.type === 7 && a.ip === "::1")).toBeTruthy();
    expect(
      altNames.find((a) => a.type === 7 && a.ip === "192.168.1.10"),
    ).toBeTruthy();
  });

  it("EKU includes serverAuth", () => {
    const leaf = generateLeaf({ ca, sanList, now: new Date() });
    const cert = forge.pki.certificateFromPem(leaf.certPem);
    const eku = cert.getExtension("extKeyUsage") as
      | { serverAuth?: boolean }
      | undefined;
    expect(eku?.serverAuth).toBe(true);
  });
});

describe("writeMaterial / readMeta", () => {
  it("writes all PEM files and meta.json with private keys at mode 0600 (POSIX)", () => {
    const dir = mkdtempSync(join(tmpdir(), "tls-test-"));
    const paths = tlsFilePaths(dir);
    const ca = generateCa({ now: new Date("2026-01-01T00:00:00Z") });
    const leaf = generateLeaf({
      ca,
      sanList: buildSanList(undefined),
      now: new Date("2026-01-01T00:00:00Z"),
    });

    writeMaterial({
      paths,
      ca,
      leaf,
      sanHash: "abc",
      generatedAt: new Date("2026-01-01T00:00:00Z"),
    });

    expect(readFileSync(paths.caCert, "utf8")).toContain("BEGIN CERTIFICATE");
    expect(readFileSync(paths.serverCert, "utf8")).toContain(
      "BEGIN CERTIFICATE",
    );
    expect(readFileSync(paths.caKey, "utf8")).toContain("PRIVATE KEY");
    expect(readFileSync(paths.serverKey, "utf8")).toContain("PRIVATE KEY");

    if (process.platform !== "win32") {
      expect(statSync(paths.caKey).mode & 0o777).toBe(0o600);
      expect(statSync(paths.serverKey).mode & 0o777).toBe(0o600);
      expect(statSync(paths.caCert).mode & 0o777).toBe(0o644);
      expect(statSync(paths.serverCert).mode & 0o777).toBe(0o644);
      expect(statSync(paths.meta).mode & 0o777).toBe(0o644);
    }

    const meta = readMeta(paths);
    expect(meta?.sanHash).toBe("abc");
    expect(meta?.caNotAfter).toBe("2036-01-01T00:00:00.000Z");
    expect(meta?.serverNotAfter).toBe("2027-01-01T00:00:00.000Z");
  });

  it("readMeta returns null when meta.json missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "tls-test-"));
    expect(readMeta(tlsFilePaths(dir))).toBeNull();
  });

  it("readMeta returns null when meta.json has unknown version", () => {
    const dir = mkdtempSync(join(tmpdir(), "tls-test-"));
    const paths = tlsFilePaths(dir);
    writeFileSync(paths.meta, JSON.stringify({ version: 99, sanHash: "x" }));
    expect(readMeta(paths)).toBeNull();
  });

  it("readMeta returns null when meta.json is malformed", () => {
    const dir = mkdtempSync(join(tmpdir(), "tls-test-"));
    const paths = tlsFilePaths(dir);
    writeFileSync(paths.meta, "{not json");
    expect(readMeta(paths)).toBeNull();
  });
});
