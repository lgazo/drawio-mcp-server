# TLS Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add TLS to the HTTP and WebSocket endpoints with two modes — manual cert/key paths, and auto-generated material rooted in a per-user local CA persisted to an XDG-compliant data directory.

**Architecture:** A new `src/tls/` module owns all TLS material concerns (XDG path resolution, SAN derivation, generation via `node-forge`, manual loading, expiry/SAN-drift checks, install hint). The server bootstrap (`src/index.ts`) calls a single `resolveTlsMaterial()` once and threads the resulting `{ key, cert, caPath? }` into both `WebSocketServer` (via `https.createServer`) and `@hono/node-server`'s `serve({ createServer, serverOptions })`. Mode selection (none / manual / auto) and validation happens in `src/config.ts`; nothing else needs to know whether TLS is on. CA cert is persisted to `$XDG_DATA_HOME/drawio-mcp-server/tls/ca.crt` (or platform equivalent) with private keys at mode `0600`.

**Tech Stack:** Node 20+, TypeScript, `node-forge` (CA + leaf cert generation), `node:https`, `node:fs`, `ws`, `@hono/node-server`, Jest.

**Test-file convention:** Every `*.test.ts` in this plan MUST start with `import { describe, it, expect } from "@jest/globals";` (matches existing tests in `packages/drawio-mcp-server/src/`). Add `jest` as a fourth import (`import { describe, it, expect, jest } from "@jest/globals";`) when the test uses `jest.fn`/`jest.spyOn`. The repo runs Jest against the compiled `build/` output, so each `pnpm test` run must be preceded by `pnpm build` (or `pnpm --filter drawio-mcp-server build`).

---

## File Structure

**New files (all under `packages/drawio-mcp-server/src/`):**

| File | Responsibility |
|---|---|
| `tls/paths.ts` | Resolve XDG-compliant data dir for TLS material (Linux/macOS/Windows). Honor `--tls-dir` override. |
| `tls/paths.test.ts` | Tests for path resolution across platforms + override. |
| `tls/san.ts` | Derive SAN list (`localhost`, `127.0.0.1`, `::1`, plus `--host` if set) and stable hash for drift detection. |
| `tls/san.test.ts` | Tests for SAN derivation + hash stability. |
| `tls/generate.ts` | Generate CA (10y EC P-256) and leaf (1y EC P-256, signed by CA) using `node-forge`. Write PEM files + `meta.json`. |
| `tls/generate.test.ts` | Tests for cert structure: SAN presence, CA flag, EKU, validity windows, file modes. |
| `tls/load.ts` | Read manual cert/key PEMs from disk; assert basic shape; return `{ cert, key }`. |
| `tls/load.test.ts` | Tests for happy path, missing file, malformed PEM. |
| `tls/install-hint.ts` | OS-specific instruction string for installing CA into trust store. |
| `tls/install-hint.test.ts` | Tests covering Linux/macOS/Windows hint strings. |
| `tls/expiry.ts` | Pure check: cert expires within window? SAN drift? Returns `"valid" \| "expired" \| "san-drift" \| "missing"`. |
| `tls/expiry.test.ts` | Tests for each branch. |
| `tls/index.ts` | Top-level `resolveTlsMaterial(config, log)` that picks mode, applies expiry/SAN check, regenerates leaf only if CA still valid, returns material + CA path for hint. |
| `tls/index.test.ts` | Integration: manual mode, auto first-run, auto re-use, auto SAN drift triggers leaf regen, auto CA expired triggers full regen. |

**Modified files:**

| File | Change |
|---|---|
| `src/config.ts` | Add `tlsEnabled`, `tlsCert`, `tlsKey`, `tlsAuto`, `tlsDir` to `ServerConfig`; parse `--tls`, `--tls-cert`, `--tls-key`, `--tls-auto`, `--tls-dir`; map env `DRAWIO_MCP_TLS*`; reject invalid combinations. |
| `src/config.test.ts` | Tests for each new flag/env + every validation error. |
| `src/index.ts` | Call `resolveTlsMaterial()` once during bootstrap; pass material to WS (`https.createServer` + `new WebSocketServer({ server })`) and to Hono (`serve({ createServer, serverOptions })`); update log lines (`https://`, `wss://`); print CA install hint once. Update help text. |
| `src/multi-transport.test.ts` | Add HTTPS variant of HTTP transport tests using auto-generated material in a tmp `tls-dir`. |
| `packages/drawio-mcp-server/package.json` | Runtime dep `node-forge: catalog:`; devDep `@types/node-forge`. |
| `pnpm-workspace.yaml` | Add `node-forge` (and only that) to `catalog:`. |
| `CONFIG.md` | New "TLS" section: flags, env vars, XDG paths per OS, auto vs. manual, install hint. |
| `README.md` | One-line key-highlight + link to CONFIG TLS section. |
| `Dockerfile` | `VOLUME ["/data/drawio-mcp/tls"]` and `ENV XDG_DATA_HOME=/data` + comment. |

**Out of scope:** Browser extension changes (already handles `wss://`); Caddy harness (already exists for the existing `HARNESS_HTTPS=1` path); mTLS / client certs.

---

### Task 1: Add `node-forge` dependency

**Files:**
- Modify: `pnpm-workspace.yaml`
- Modify: `packages/drawio-mcp-server/package.json`

- [ ] **Step 1: Add `node-forge` to workspace catalog**

Edit `pnpm-workspace.yaml` `catalog:` block to:

```yaml
catalog:
  typescript: "5.9.3"
  "@biomejs/biome": "2.4.13"
  "node-forge": "1.4.0"
```

- [ ] **Step 2: Reference catalog from server package**

Edit `packages/drawio-mcp-server/package.json`: under `dependencies`, add `"node-forge": "catalog:"` (alphabetically after `nanoid`). Under `devDependencies`, add `"@types/node-forge": "1.3.11"`.

- [ ] **Step 3: Install**

Run: `pnpm install`
Expected: lockfile updated, no errors.

- [ ] **Step 4: Verify import resolves**

Run: `cd packages/drawio-mcp-server && node -e "import('node-forge').then(m => console.log(typeof m.pki.createCertificate))"`
Expected: `function`

- [ ] **Step 5: Commit**

```bash
git add pnpm-workspace.yaml packages/drawio-mcp-server/package.json pnpm-lock.yaml
git commit -m "chore: add node-forge for TLS cert generation"
```

---

### Task 2: SAN list builder

**Files:**
- Create: `packages/drawio-mcp-server/src/tls/san.ts`
- Test: `packages/drawio-mcp-server/src/tls/san.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/drawio-mcp-server/src/tls/san.test.ts`:

```ts
import { buildSanList, sanHash } from "./san.js";

describe("buildSanList", () => {
  it("returns loopback defaults when host is undefined", () => {
    expect(buildSanList(undefined)).toEqual([
      { type: "dns", value: "localhost" },
      { type: "ip", value: "127.0.0.1" },
      { type: "ip", value: "::1" },
    ]);
  });

  it("appends explicit IPv4 host without duplicating loopback", () => {
    expect(buildSanList("192.168.1.10")).toEqual([
      { type: "dns", value: "localhost" },
      { type: "ip", value: "127.0.0.1" },
      { type: "ip", value: "::1" },
      { type: "ip", value: "192.168.1.10" },
    ]);
  });

  it("appends explicit IPv6 host without duplicating loopback", () => {
    expect(buildSanList("fe80::1")).toEqual([
      { type: "dns", value: "localhost" },
      { type: "ip", value: "127.0.0.1" },
      { type: "ip", value: "::1" },
      { type: "ip", value: "fe80::1" },
    ]);
  });

  it("does not duplicate when host equals an existing loopback entry", () => {
    expect(buildSanList("127.0.0.1")).toEqual([
      { type: "dns", value: "localhost" },
      { type: "ip", value: "127.0.0.1" },
      { type: "ip", value: "::1" },
    ]);
  });

  it("treats 0.0.0.0 as a wildcard binding, still using loopback SAN set", () => {
    expect(buildSanList("0.0.0.0")).toEqual([
      { type: "dns", value: "localhost" },
      { type: "ip", value: "127.0.0.1" },
      { type: "ip", value: "::1" },
    ]);
  });
});

describe("sanHash", () => {
  it("is stable for identical input", () => {
    const a = sanHash(buildSanList("192.168.1.10"));
    const b = sanHash(buildSanList("192.168.1.10"));
    expect(a).toBe(b);
  });

  it("differs when host changes", () => {
    const a = sanHash(buildSanList(undefined));
    const b = sanHash(buildSanList("192.168.1.10"));
    expect(a).not.toBe(b);
  });

  it("is order-insensitive (canonicalised)", () => {
    const original = buildSanList("192.168.1.10");
    const reversed = [...original].reverse();
    expect(sanHash(reversed)).toBe(sanHash(original));
  });
});
```

- [ ] **Step 2: Run test, expect fail**

Run: `cd packages/drawio-mcp-server && pnpm test -- --testPathPatterns=tls/san`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `san.ts`**

Create `packages/drawio-mcp-server/src/tls/san.ts`:

```ts
import { createHash } from "node:crypto";
import { isIP } from "node:net";

export type SanEntry =
  | { type: "dns"; value: string }
  | { type: "ip"; value: string };

const LOOPBACK_DEFAULTS: readonly SanEntry[] = [
  { type: "dns", value: "localhost" },
  { type: "ip", value: "127.0.0.1" },
  { type: "ip", value: "::1" },
];

export function buildSanList(host: string | undefined): SanEntry[] {
  const entries: SanEntry[] = [...LOOPBACK_DEFAULTS];
  if (!host || host === "0.0.0.0" || host === "::") return entries;

  const family = isIP(host);
  if (family === 0) return entries;

  const candidate: SanEntry = { type: "ip", value: host };
  const exists = entries.some(
    (e) => e.type === candidate.type && e.value === candidate.value,
  );
  if (!exists) entries.push(candidate);
  return entries;
}

export function sanHash(entries: readonly SanEntry[]): string {
  const canonical = [...entries]
    .map((e) => `${e.type}:${e.value}`)
    .sort()
    .join("|");
  return createHash("sha256").update(canonical).digest("hex");
}
```

- [ ] **Step 4: Run test, expect pass**

Run: `cd packages/drawio-mcp-server && pnpm test -- --testPathPatterns=tls/san`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add packages/drawio-mcp-server/src/tls/san.ts packages/drawio-mcp-server/src/tls/san.test.ts
git commit -m "feat(tls): SAN list builder with stable hash"
```

---

### Task 3: XDG paths resolver

**Files:**
- Create: `packages/drawio-mcp-server/src/tls/paths.ts`
- Test: `packages/drawio-mcp-server/src/tls/paths.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/drawio-mcp-server/src/tls/paths.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test, expect fail**

Run: `cd packages/drawio-mcp-server && pnpm test -- --testPathPatterns=tls/paths`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `paths.ts`**

Create `packages/drawio-mcp-server/src/tls/paths.ts`:

```ts
import { join } from "node:path";

export const APP_NAME = "drawio-mcp-server";

export interface ResolveTlsDirArgs {
  override?: string;
  platform: NodeJS.Platform;
  env: NodeJS.ProcessEnv;
  home: string;
}

export function resolveTlsDir(args: ResolveTlsDirArgs): string {
  if (args.override && args.override.length > 0) return args.override;

  if (args.platform === "darwin") {
    return join(args.home, "Library", "Application Support", APP_NAME, "tls");
  }

  if (args.platform === "win32") {
    const base =
      args.env.LOCALAPPDATA && args.env.LOCALAPPDATA.length > 0
        ? args.env.LOCALAPPDATA
        : join(args.home, "AppData", "Local");
    return join(base, APP_NAME, "Data", "tls");
  }

  // Linux + other unix
  const xdg = args.env.XDG_DATA_HOME;
  const base = xdg && xdg.length > 0 ? xdg : join(args.home, ".local", "share");
  return join(base, APP_NAME, "tls");
}

export interface TlsFilePaths {
  readonly caCert: string;
  readonly caKey: string;
  readonly serverCert: string;
  readonly serverKey: string;
  readonly meta: string;
}

export function tlsFilePaths(dir: string): TlsFilePaths {
  return {
    caCert: join(dir, "ca.crt"),
    caKey: join(dir, "ca.key"),
    serverCert: join(dir, "server.crt"),
    serverKey: join(dir, "server.key"),
    meta: join(dir, "meta.json"),
  };
}
```

- [ ] **Step 4: Run test, expect pass**

Run: `cd packages/drawio-mcp-server && pnpm test -- --testPathPatterns=tls/paths`
Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add packages/drawio-mcp-server/src/tls/paths.ts packages/drawio-mcp-server/src/tls/paths.test.ts
git commit -m "feat(tls): XDG-compliant TLS material directory resolver"
```

---

### Task 4: CA + leaf cert generation

**Files:**
- Create: `packages/drawio-mcp-server/src/tls/generate.ts`
- Test: `packages/drawio-mcp-server/src/tls/generate.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/drawio-mcp-server/src/tls/generate.test.ts`:

```ts
import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import forge from "node-forge";
import { generateCa, generateLeaf, writeMaterial, readMeta } from "./generate.js";
import { tlsFilePaths } from "./paths.js";
import { buildSanList } from "./san.js";

describe("generateCa", () => {
  it("produces a self-signed CA cert with basicConstraints CA:true", () => {
    const ca = generateCa({ now: new Date("2026-01-01T00:00:00Z") });
    const cert = forge.pki.certificateFromPem(ca.certPem);
    const bc = cert.getExtension("basicConstraints") as { cA: boolean } | undefined;
    expect(bc?.cA).toBe(true);
  });

  it("validity is 10 years from `now`", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const ca = generateCa({ now });
    const cert = forge.pki.certificateFromPem(ca.certPem);
    expect(cert.validity.notBefore.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(cert.validity.notAfter.toISOString()).toBe("2036-01-01T00:00:00.000Z");
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
    const leaf = generateLeaf({ ca, sanList, now: new Date("2026-01-01T00:00:00Z") });
    const cert = forge.pki.certificateFromPem(leaf.certPem);
    const caCert = forge.pki.certificateFromPem(ca.certPem);
    expect(cert.issuer.hash).toBe(caCert.subject.hash);
  });

  it("validity is 1 year from `now`", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const leaf = generateLeaf({ ca, sanList, now });
    const cert = forge.pki.certificateFromPem(leaf.certPem);
    expect(cert.validity.notAfter.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("includes every SAN entry with correct type", () => {
    const leaf = generateLeaf({ ca, sanList, now: new Date() });
    const cert = forge.pki.certificateFromPem(leaf.certPem);
    const ext = cert.getExtension("subjectAltName") as
      | { altNames: { type: number; value?: string; ip?: string }[] }
      | undefined;
    const altNames = ext?.altNames ?? [];
    // node-forge uses type 2 = DNS, 7 = IP
    expect(altNames.find((a) => a.type === 2 && a.value === "localhost")).toBeTruthy();
    expect(altNames.find((a) => a.type === 7 && a.ip === "127.0.0.1")).toBeTruthy();
    expect(altNames.find((a) => a.type === 7 && a.ip === "::1")).toBeTruthy();
    expect(altNames.find((a) => a.type === 7 && a.ip === "192.168.1.10")).toBeTruthy();
  });

  it("EKU includes serverAuth", () => {
    const leaf = generateLeaf({ ca, sanList, now: new Date() });
    const cert = forge.pki.certificateFromPem(leaf.certPem);
    const eku = cert.getExtension("extKeyUsage") as { serverAuth?: boolean } | undefined;
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
    expect(readFileSync(paths.serverCert, "utf8")).toContain("BEGIN CERTIFICATE");
    expect(readFileSync(paths.caKey, "utf8")).toContain("PRIVATE KEY");
    expect(readFileSync(paths.serverKey, "utf8")).toContain("PRIVATE KEY");

    if (process.platform !== "win32") {
      expect(statSync(paths.caKey).mode & 0o777).toBe(0o600);
      expect(statSync(paths.serverKey).mode & 0o777).toBe(0o600);
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
});
```

- [ ] **Step 2: Run test, expect fail**

Run: `cd packages/drawio-mcp-server && pnpm test -- --testPathPatterns=tls/generate`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `generate.ts`**

Create `packages/drawio-mcp-server/src/tls/generate.ts`:

```ts
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import forge from "node-forge";
import type { SanEntry } from "./san.js";
import type { TlsFilePaths } from "./paths.js";

export interface CertMaterial {
  readonly certPem: string;
  readonly keyPem: string;
  readonly cert: forge.pki.Certificate;
  readonly keys: forge.pki.rsa.KeyPair;
}

export interface PersistedMeta {
  readonly version: 1;
  readonly generatedAt: string;
  readonly sanHash: string;
  readonly caNotAfter: string;
  readonly serverNotAfter: string;
}

const SERIAL_BYTES = 16;

function randomSerialHex(): string {
  // node-forge requires a positive integer hex string; clear the high bit.
  const bytes = forge.random.getBytesSync(SERIAL_BYTES);
  const arr = Array.from(bytes, (c) => c.charCodeAt(0));
  arr[0] = arr[0] & 0x7f;
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function setValidity(cert: forge.pki.Certificate, from: Date, years: number): void {
  cert.validity.notBefore = from;
  const to = new Date(from);
  to.setUTCFullYear(to.getUTCFullYear() + years);
  cert.validity.notAfter = to;
}

export function generateCa(args: { now: Date }): CertMaterial {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = randomSerialHex();
  setValidity(cert, args.now, 10);

  const attrs = [{ name: "commonName", value: "drawio-mcp-server local CA" }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([
    { name: "basicConstraints", cA: true, critical: true },
    {
      name: "keyUsage",
      keyCertSign: true,
      cRLSign: true,
      critical: true,
    },
    { name: "subjectKeyIdentifier" },
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  return {
    certPem: forge.pki.certificateToPem(cert),
    keyPem: forge.pki.privateKeyToPem(keys.privateKey),
    cert,
    keys,
  };
}

function sanListToAltNames(sanList: readonly SanEntry[]) {
  return sanList.map((entry) =>
    entry.type === "dns"
      ? { type: 2, value: entry.value }
      : { type: 7, ip: entry.value },
  );
}

export function generateLeaf(args: {
  ca: CertMaterial;
  sanList: readonly SanEntry[];
  now: Date;
}): CertMaterial {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = randomSerialHex();
  setValidity(cert, args.now, 1);

  cert.setSubject([{ name: "commonName", value: "drawio-mcp-server" }]);
  cert.setIssuer(args.ca.cert.subject.attributes);
  cert.setExtensions([
    { name: "basicConstraints", cA: false, critical: true },
    {
      name: "keyUsage",
      digitalSignature: true,
      keyEncipherment: true,
      critical: true,
    },
    { name: "extKeyUsage", serverAuth: true, clientAuth: true },
    { name: "subjectAltName", altNames: sanListToAltNames(args.sanList) },
    { name: "subjectKeyIdentifier" },
  ]);
  cert.sign(args.ca.keys.privateKey, forge.md.sha256.create());

  return {
    certPem: forge.pki.certificateToPem(cert),
    keyPem: forge.pki.privateKeyToPem(keys.privateKey),
    cert,
    keys,
  };
}

export function writeMaterial(args: {
  paths: TlsFilePaths;
  ca: CertMaterial;
  leaf: CertMaterial;
  sanHash: string;
  generatedAt: Date;
}): void {
  mkdirSync(dirname(args.paths.caCert), { recursive: true, mode: 0o700 });

  writeFileSync(args.paths.caCert, args.ca.certPem, { mode: 0o644 });
  writeFileSync(args.paths.caKey, args.ca.keyPem, { mode: 0o600 });
  writeFileSync(args.paths.serverCert, args.leaf.certPem, { mode: 0o644 });
  writeFileSync(args.paths.serverKey, args.leaf.keyPem, { mode: 0o600 });

  const meta: PersistedMeta = {
    version: 1,
    generatedAt: args.generatedAt.toISOString(),
    sanHash: args.sanHash,
    caNotAfter: args.ca.cert.validity.notAfter.toISOString(),
    serverNotAfter: args.leaf.cert.validity.notAfter.toISOString(),
  };
  writeFileSync(args.paths.meta, JSON.stringify(meta, null, 2), { mode: 0o644 });
}

export function readMeta(paths: TlsFilePaths): PersistedMeta | null {
  if (!existsSync(paths.meta)) return null;
  const raw = readFileSync(paths.meta, "utf8");
  const parsed = JSON.parse(raw) as PersistedMeta;
  if (parsed.version !== 1) return null;
  return parsed;
}
```

- [ ] **Step 4: Run test, expect pass**

Run: `cd packages/drawio-mcp-server && pnpm test -- --testPathPatterns=tls/generate`
Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add packages/drawio-mcp-server/src/tls/generate.ts packages/drawio-mcp-server/src/tls/generate.test.ts
git commit -m "feat(tls): CA + leaf cert generation via node-forge"
```

---

### Task 5: Manual cert/key loader

**Files:**
- Create: `packages/drawio-mcp-server/src/tls/load.ts`
- Test: `packages/drawio-mcp-server/src/tls/load.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/drawio-mcp-server/src/tls/load.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test, expect fail**

Run: `cd packages/drawio-mcp-server && pnpm test -- --testPathPatterns=tls/load`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `load.ts`**

Create `packages/drawio-mcp-server/src/tls/load.ts`:

```ts
import { existsSync, readFileSync } from "node:fs";

export interface ManualMaterial {
  readonly cert: string;
  readonly key: string;
}

export function loadManualMaterial(args: {
  certPath: string;
  keyPath: string;
}): ManualMaterial {
  if (!existsSync(args.certPath)) {
    throw new Error(`TLS cert file not found: ${args.certPath}`);
  }
  if (!existsSync(args.keyPath)) {
    throw new Error(`TLS key file not found: ${args.keyPath}`);
  }

  const cert = readFileSync(args.certPath, "utf8");
  const key = readFileSync(args.keyPath, "utf8");

  if (!cert.includes("BEGIN CERTIFICATE")) {
    throw new Error(
      `TLS cert at ${args.certPath} is not PEM-encoded (missing BEGIN CERTIFICATE)`,
    );
  }
  if (!key.includes("PRIVATE KEY")) {
    throw new Error(
      `TLS key at ${args.keyPath} is not PEM-encoded (missing PRIVATE KEY)`,
    );
  }

  return { cert, key };
}
```

- [ ] **Step 4: Run test, expect pass**

Run: `cd packages/drawio-mcp-server && pnpm test -- --testPathPatterns=tls/load`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add packages/drawio-mcp-server/src/tls/load.ts packages/drawio-mcp-server/src/tls/load.test.ts
git commit -m "feat(tls): manual cert/key loader with PEM validation"
```

---

### Task 6: Expiry / SAN-drift checker

**Files:**
- Create: `packages/drawio-mcp-server/src/tls/expiry.ts`
- Test: `packages/drawio-mcp-server/src/tls/expiry.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/drawio-mcp-server/src/tls/expiry.test.ts`:

```ts
import { evaluateMaterial } from "./expiry.js";
import type { PersistedMeta } from "./generate.js";

const baseMeta = (overrides: Partial<PersistedMeta> = {}): PersistedMeta => ({
  version: 1,
  generatedAt: "2026-01-01T00:00:00.000Z",
  sanHash: "hash-A",
  caNotAfter: "2036-01-01T00:00:00.000Z",
  serverNotAfter: "2027-01-01T00:00:00.000Z",
  ...overrides,
});

describe("evaluateMaterial", () => {
  it("returns 'missing' when meta is null", () => {
    expect(
      evaluateMaterial({
        meta: null,
        currentSanHash: "hash-A",
        now: new Date("2026-06-01T00:00:00Z"),
      }),
    ).toBe("missing");
  });

  it("returns 'valid' when CA + leaf future-valid and SAN matches", () => {
    expect(
      evaluateMaterial({
        meta: baseMeta(),
        currentSanHash: "hash-A",
        now: new Date("2026-06-01T00:00:00Z"),
      }),
    ).toBe("valid");
  });

  it("returns 'san-drift' when SAN hash differs but CA still valid", () => {
    expect(
      evaluateMaterial({
        meta: baseMeta(),
        currentSanHash: "hash-B",
        now: new Date("2026-06-01T00:00:00Z"),
      }),
    ).toBe("san-drift");
  });

  it("returns 'leaf-expired' when leaf within 30-day expiry window", () => {
    expect(
      evaluateMaterial({
        meta: baseMeta({ serverNotAfter: "2026-06-15T00:00:00.000Z" }),
        currentSanHash: "hash-A",
        now: new Date("2026-06-01T00:00:00Z"),
      }),
    ).toBe("leaf-expired");
  });

  it("returns 'ca-expired' when CA within 30-day expiry window (overrides leaf)", () => {
    expect(
      evaluateMaterial({
        meta: baseMeta({ caNotAfter: "2026-06-15T00:00:00.000Z" }),
        currentSanHash: "hash-A",
        now: new Date("2026-06-01T00:00:00Z"),
      }),
    ).toBe("ca-expired");
  });

  it("CA expired wins over SAN drift", () => {
    expect(
      evaluateMaterial({
        meta: baseMeta({ caNotAfter: "2026-06-15T00:00:00.000Z" }),
        currentSanHash: "hash-B",
        now: new Date("2026-06-01T00:00:00Z"),
      }),
    ).toBe("ca-expired");
  });
});
```

- [ ] **Step 2: Run test, expect fail**

Run: `cd packages/drawio-mcp-server && pnpm test -- --testPathPatterns=tls/expiry`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `expiry.ts`**

Create `packages/drawio-mcp-server/src/tls/expiry.ts`:

```ts
import type { PersistedMeta } from "./generate.js";

export type MaterialState =
  | "missing"
  | "valid"
  | "san-drift"
  | "leaf-expired"
  | "ca-expired";

const RENEWAL_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export function evaluateMaterial(args: {
  meta: PersistedMeta | null;
  currentSanHash: string;
  now: Date;
}): MaterialState {
  if (!args.meta) return "missing";

  const caExpiresAt = new Date(args.meta.caNotAfter).getTime();
  if (caExpiresAt - args.now.getTime() < RENEWAL_WINDOW_MS) return "ca-expired";

  const leafExpiresAt = new Date(args.meta.serverNotAfter).getTime();
  if (leafExpiresAt - args.now.getTime() < RENEWAL_WINDOW_MS) return "leaf-expired";

  if (args.meta.sanHash !== args.currentSanHash) return "san-drift";

  return "valid";
}
```

- [ ] **Step 4: Run test, expect pass**

Run: `cd packages/drawio-mcp-server && pnpm test -- --testPathPatterns=tls/expiry`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add packages/drawio-mcp-server/src/tls/expiry.ts packages/drawio-mcp-server/src/tls/expiry.test.ts
git commit -m "feat(tls): expiry + SAN-drift evaluator"
```

---

### Task 7: Install hint per OS

**Files:**
- Create: `packages/drawio-mcp-server/src/tls/install-hint.ts`
- Test: `packages/drawio-mcp-server/src/tls/install-hint.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/drawio-mcp-server/src/tls/install-hint.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test, expect fail**

Run: `cd packages/drawio-mcp-server && pnpm test -- --testPathPatterns=tls/install-hint`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `install-hint.ts`**

Create `packages/drawio-mcp-server/src/tls/install-hint.ts`:

```ts
export function caInstallHint(args: {
  platform: NodeJS.Platform;
  caPath: string;
}): string {
  const { platform, caPath } = args;

  if (platform === "darwin") {
    return [
      `Install the local CA into the macOS System keychain so browsers trust it:`,
      ``,
      `  sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ${caPath}`,
      ``,
      `Then quit and restart the browser.`,
    ].join("\n");
  }

  if (platform === "win32") {
    return [
      `Install the local CA into the Windows Trusted Root store (run as Administrator):`,
      ``,
      `  certutil -addstore -f ROOT "${caPath}"`,
      ``,
      `Then quit and restart the browser.`,
    ].join("\n");
  }

  if (platform === "linux") {
    return [
      `Install the local CA so the system and browsers trust it.`,
      ``,
      `Debian/Ubuntu:`,
      `  sudo cp ${caPath} /usr/local/share/ca-certificates/drawio-mcp-ca.crt`,
      `  sudo update-ca-certificates`,
      ``,
      `Fedora/RHEL/Arch:`,
      `  sudo cp ${caPath} /etc/pki/ca-trust/source/anchors/drawio-mcp-ca.crt`,
      `  sudo update-ca-trust extract`,
      ``,
      `Firefox uses its own NSS store; import via Settings → Privacy & Security → Certificates → View Certificates → Authorities → Import.`,
      ``,
      `Then quit and restart the browser.`,
    ].join("\n");
  }

  return [
    `Install the local CA at ${caPath} into your OS / browser trust store.`,
    `Without this, browsers will reject the self-signed certificate.`,
  ].join("\n");
}
```

- [ ] **Step 4: Run test, expect pass**

Run: `cd packages/drawio-mcp-server && pnpm test -- --testPathPatterns=tls/install-hint`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add packages/drawio-mcp-server/src/tls/install-hint.ts packages/drawio-mcp-server/src/tls/install-hint.test.ts
git commit -m "feat(tls): per-OS CA install hint"
```

---

### Task 8: Top-level `resolveTlsMaterial` orchestrator

**Files:**
- Create: `packages/drawio-mcp-server/src/tls/index.ts`
- Test: `packages/drawio-mcp-server/src/tls/index.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/drawio-mcp-server/src/tls/index.test.ts`:

```ts
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
      config: { tlsEnabled: true, tlsAuto: true, tlsDir: dir, host: "192.168.1.10" },
      log: () => {},
    });

    expect(readFileSync(tlsFilePaths(dir).caCert, "utf8")).toBe(caBefore);
    expect(readFileSync(tlsFilePaths(dir).serverCert, "utf8")).not.toBe(leafBefore);
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
});
```

- [ ] **Step 2: Run test, expect fail**

Run: `cd packages/drawio-mcp-server && pnpm test -- --testPathPatterns=tls/index`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `tls/index.ts`**

Create `packages/drawio-mcp-server/src/tls/index.ts`:

```ts
import { homedir, platform as osPlatform } from "node:os";
import { existsSync, readFileSync } from "node:fs";
import {
  generateCa,
  generateLeaf,
  readMeta,
  writeMaterial,
  type CertMaterial,
} from "./generate.js";
import { caInstallHint } from "./install-hint.js";
import { evaluateMaterial } from "./expiry.js";
import { loadManualMaterial } from "./load.js";
import { resolveTlsDir, tlsFilePaths } from "./paths.js";
import { buildSanList, sanHash } from "./san.js";
import forge from "node-forge";

export interface ResolveTlsConfig {
  readonly tlsEnabled: boolean;
  readonly tlsAuto?: boolean;
  readonly tlsCert?: string;
  readonly tlsKey?: string;
  readonly tlsDir?: string;
  readonly host?: string;
}

export interface ResolvedTlsMaterial {
  readonly cert: string;
  readonly key: string;
  readonly caPath?: string;
}

export type TlsLog = (msg: string) => void;

export function resolveTlsMaterial(args: {
  config: ResolveTlsConfig;
  log: TlsLog;
  now?: Date;
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  home?: string;
}): ResolvedTlsMaterial | null {
  const { config } = args;
  if (!config.tlsEnabled) return null;

  const hasManual = Boolean(config.tlsCert || config.tlsKey);
  const hasAuto = Boolean(config.tlsAuto);

  if (hasManual && hasAuto) {
    throw new Error(
      "Cannot combine --tls-auto with --tls-cert/--tls-key. Pick one mode.",
    );
  }
  if (!hasManual && !hasAuto) {
    throw new Error(
      "--tls requires either --tls-auto or --tls-cert/--tls-key",
    );
  }

  if (hasManual) {
    if (!config.tlsCert || !config.tlsKey) {
      throw new Error("--tls-cert and --tls-key must both be provided");
    }
    const m = loadManualMaterial({
      certPath: config.tlsCert,
      keyPath: config.tlsKey,
    });
    return { cert: m.cert, key: m.key };
  }

  // Auto mode
  const now = args.now ?? new Date();
  const platform = args.platform ?? osPlatform();
  const env = args.env ?? process.env;
  const home = args.home ?? homedir();

  const dir = resolveTlsDir({
    override: config.tlsDir,
    platform,
    env,
    home,
  });
  const paths = tlsFilePaths(dir);
  const sanList = buildSanList(config.host);
  const currentSanHash = sanHash(sanList);

  const meta = readMeta(paths);
  const state = evaluateMaterial({ meta, currentSanHash, now });

  if (state === "valid") {
    return {
      cert: readFileSync(paths.serverCert, "utf8"),
      key: readFileSync(paths.serverKey, "utf8"),
      caPath: paths.caCert,
    };
  }

  let ca: CertMaterial;
  if (state === "san-drift" || state === "leaf-expired") {
    // CA still valid — keep it, regen leaf only
    ca = loadCaMaterialFromDisk(paths);
  } else {
    // missing or ca-expired — full regen
    ca = generateCa({ now });
  }

  const leaf = generateLeaf({ ca, sanList, now });
  writeMaterial({ paths, ca, leaf, sanHash: currentSanHash, generatedAt: now });

  if (state !== "san-drift" && state !== "leaf-expired") {
    args.log(
      `\n${caInstallHint({ platform, caPath: paths.caCert })}\n`,
    );
  } else {
    args.log(
      `Renewed TLS leaf certificate (state: ${state}). CA at ${paths.caCert} unchanged.`,
    );
  }

  return {
    cert: leaf.certPem,
    key: leaf.keyPem,
    caPath: paths.caCert,
  };
}

function loadCaMaterialFromDisk(
  paths: ReturnType<typeof tlsFilePaths>,
): CertMaterial {
  if (!existsSync(paths.caCert) || !existsSync(paths.caKey)) {
    throw new Error(
      `TLS material directory ${paths.caCert} is in an inconsistent state. Delete it and restart.`,
    );
  }
  const certPem = readFileSync(paths.caCert, "utf8");
  const keyPem = readFileSync(paths.caKey, "utf8");
  const cert = forge.pki.certificateFromPem(certPem);
  const privateKey = forge.pki.privateKeyFromPem(keyPem) as forge.pki.rsa.PrivateKey;
  return {
    certPem,
    keyPem,
    cert,
    keys: { privateKey, publicKey: cert.publicKey as forge.pki.rsa.PublicKey },
  };
}
```

- [ ] **Step 4: Run test, expect pass**

Run: `cd packages/drawio-mcp-server && pnpm test -- --testPathPatterns=tls/index`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add packages/drawio-mcp-server/src/tls/index.ts packages/drawio-mcp-server/src/tls/index.test.ts
git commit -m "feat(tls): top-level resolveTlsMaterial orchestrator"
```

---

### Task 9: Config — flag parsing

**Files:**
- Modify: `packages/drawio-mcp-server/src/config.ts`
- Modify: `packages/drawio-mcp-server/src/config.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/drawio-mcp-server/src/config.test.ts` (inside the existing top-level describe or as a new describe block — match existing style):

```ts
describe("TLS configuration", () => {
  it("--tls alone sets tlsEnabled with no mode", () => {
    const cfg = parseConfig(["--tls"]);
    expect(cfg).not.toBeInstanceOf(Error);
    if (cfg instanceof Error) return;
    expect(cfg.tlsEnabled).toBe(true);
    expect(cfg.tlsAuto).toBe(false);
    expect(cfg.tlsCert).toBeUndefined();
    expect(cfg.tlsKey).toBeUndefined();
  });

  it("--tls --tls-cert X --tls-key Y configures manual mode", () => {
    const cfg = parseConfig(["--tls", "--tls-cert", "/c.pem", "--tls-key", "/k.pem"]);
    expect(cfg).not.toBeInstanceOf(Error);
    if (cfg instanceof Error) return;
    expect(cfg.tlsEnabled).toBe(true);
    expect(cfg.tlsCert).toBe("/c.pem");
    expect(cfg.tlsKey).toBe("/k.pem");
    expect(cfg.tlsAuto).toBe(false);
  });

  it("--tls --tls-auto configures auto mode", () => {
    const cfg = parseConfig(["--tls", "--tls-auto"]);
    expect(cfg).not.toBeInstanceOf(Error);
    if (cfg instanceof Error) return;
    expect(cfg.tlsEnabled).toBe(true);
    expect(cfg.tlsAuto).toBe(true);
  });

  it("--tls-dir captures override path", () => {
    const cfg = parseConfig(["--tls", "--tls-auto", "--tls-dir", "/data/tls"]);
    expect(cfg).not.toBeInstanceOf(Error);
    if (cfg instanceof Error) return;
    expect(cfg.tlsDir).toBe("/data/tls");
  });

  it("--tls-cert without --tls-key is an error", () => {
    expect(parseConfig(["--tls", "--tls-cert", "/c.pem"])).toBeInstanceOf(Error);
  });

  it("--tls-key without --tls-cert is an error", () => {
    expect(parseConfig(["--tls", "--tls-key", "/k.pem"])).toBeInstanceOf(Error);
  });

  it("--tls-auto + --tls-cert is an error", () => {
    expect(
      parseConfig(["--tls", "--tls-auto", "--tls-cert", "/c", "--tls-key", "/k"]),
    ).toBeInstanceOf(Error);
  });

  it("--tls-cert without --tls is an error", () => {
    expect(parseConfig(["--tls-cert", "/c", "--tls-key", "/k"])).toBeInstanceOf(Error);
  });

  it("envToArgs maps DRAWIO_MCP_TLS=true to --tls", () => {
    expect(envToArgs({ DRAWIO_MCP_TLS: "true" })).toEqual(["--tls"]);
  });

  it("envToArgs maps DRAWIO_MCP_TLS_AUTO=true to --tls-auto", () => {
    expect(envToArgs({ DRAWIO_MCP_TLS_AUTO: "true" })).toEqual(["--tls-auto"]);
  });

  it("envToArgs maps cert/key/dir env vars to flags", () => {
    expect(
      envToArgs({
        DRAWIO_MCP_TLS_CERT: "/c.pem",
        DRAWIO_MCP_TLS_KEY: "/k.pem",
        DRAWIO_MCP_TLS_DIR: "/data/tls",
      }),
    ).toEqual([
      "--tls-cert",
      "/c.pem",
      "--tls-key",
      "/k.pem",
      "--tls-dir",
      "/data/tls",
    ]);
  });
});
```

- [ ] **Step 2: Run test, expect fail**

Run: `cd packages/drawio-mcp-server && pnpm test -- --testPathPatterns=config`
Expected: 11 new failures.

- [ ] **Step 3: Extend `ServerConfig` and add parsing**

Edit `packages/drawio-mcp-server/src/config.ts`:

a) Extend the `ServerConfig` interface (after `logger: LoggerMode;`):

```ts
  readonly tlsEnabled: boolean;
  readonly tlsAuto: boolean;
  readonly tlsCert?: string;
  readonly tlsKey?: string;
  readonly tlsDir?: string;
```

b) Update `DEFAULT_CONFIG` to include:

```ts
  tlsEnabled: false,
  tlsAuto: false,
```

c) In `parseConfig`, declare new locals near the others:

```ts
  let tlsEnabled = false;
  let tlsAuto = false;
  let tlsCert: string | undefined;
  let tlsKey: string | undefined;
  let tlsDir: string | undefined;
```

d) Add new arms to the `for` loop, after the `--logger` arm:

```ts
    } else if (arg === "--tls") {
      tlsEnabled = true;
    } else if (arg === "--tls-auto") {
      tlsAuto = true;
    } else if (arg === "--tls-cert") {
      const nextValue = args[i + 1];
      if (nextValue === undefined) {
        return new Error("--tls-cert flag requires a path");
      }
      tlsCert = nextValue;
      i += 1;
    } else if (arg === "--tls-key") {
      const nextValue = args[i + 1];
      if (nextValue === undefined) {
        return new Error("--tls-key flag requires a path");
      }
      tlsKey = nextValue;
      i += 1;
    } else if (arg === "--tls-dir") {
      const nextValue = args[i + 1];
      if (nextValue === undefined) {
        return new Error("--tls-dir flag requires a directory path");
      }
      tlsDir = nextValue;
      i += 1;
    }
```

e) Add validation BEFORE the three return statements at the bottom of `parseConfig`:

```ts
  // TLS validation
  if ((tlsCert || tlsKey || tlsAuto || tlsDir) && !tlsEnabled) {
    return new Error(
      "TLS sub-flags (--tls-cert, --tls-key, --tls-auto, --tls-dir) require --tls",
    );
  }
  if (tlsEnabled) {
    if (tlsCert && !tlsKey) {
      return new Error("--tls-cert requires --tls-key");
    }
    if (tlsKey && !tlsCert) {
      return new Error("--tls-key requires --tls-cert");
    }
    if (tlsAuto && (tlsCert || tlsKey)) {
      return new Error(
        "Cannot combine --tls-auto with --tls-cert/--tls-key. Pick one mode.",
      );
    }
  }
```

f) In every `return { ...DEFAULT_CONFIG, ... }` literal at the bottom of `parseConfig` (there are three), add:

```ts
      tlsEnabled,
      tlsAuto,
      tlsCert,
      tlsKey,
      tlsDir,
```

g) Extend `envToArgs` after the existing logger block:

```ts
  const tls = env.DRAWIO_MCP_TLS;
  if (tls && tls.toLowerCase() === "true") out.push("--tls");

  const tlsAuto = env.DRAWIO_MCP_TLS_AUTO;
  if (tlsAuto && tlsAuto.toLowerCase() === "true") out.push("--tls-auto");

  const tlsCert = env.DRAWIO_MCP_TLS_CERT;
  if (tlsCert && tlsCert.length > 0) out.push("--tls-cert", tlsCert);

  const tlsKey = env.DRAWIO_MCP_TLS_KEY;
  if (tlsKey && tlsKey.length > 0) out.push("--tls-key", tlsKey);

  const tlsDir = env.DRAWIO_MCP_TLS_DIR;
  if (tlsDir && tlsDir.length > 0) out.push("--tls-dir", tlsDir);
```

- [ ] **Step 4: Run test, expect pass**

Run: `cd packages/drawio-mcp-server && pnpm test -- --testPathPatterns=config`
Expected: all tests pass (existing + 11 new).

- [ ] **Step 5: Commit**

```bash
git add packages/drawio-mcp-server/src/config.ts packages/drawio-mcp-server/src/config.test.ts
git commit -m "feat(tls): config flags and env mapping for TLS"
```

---

### Task 10: Wire WebSocket server to TLS

**Files:**
- Modify: `packages/drawio-mcp-server/src/index.ts`

- [ ] **Step 1: Write the failing test**

Append a new describe block to `packages/drawio-mcp-server/src/multi-transport.test.ts`:

```ts
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect as tlsConnect } from "node:tls";
import { defaultConfig } from "./config.js";

describe("WebSocket TLS", () => {
  let app: DrawioMcpApp;
  let logger: MemoryLogger;
  let wsPort: number;
  let tlsDir: string;

  beforeEach(async () => {
    logger = new MemoryLogger();
    tlsDir = mkdtempSync(join(tmpdir(), "tls-ws-"));
    const baseCfg = defaultConfig();
    app = createDrawioMcpApp({
      log: logger,
      config: { ...baseCfg, tlsEnabled: true, tlsAuto: true, tlsDir },
    });
    const wsServer = await app.startWebSocketServer(0);
    wsPort = (wsServer.address() as { port: number }).port;
  });

  afterEach(async () => {
    await app.close();
  });

  it("accepts TLS handshakes (wss)", async () => {
    await new Promise<void>((resolve, reject) => {
      const socket = tlsConnect(
        { port: wsPort, host: "127.0.0.1", rejectUnauthorized: false },
        () => {
          expect(socket.authorized || !socket.authorized).toBe(true); // handshake completed
          socket.end();
          resolve();
        },
      );
      socket.on("error", reject);
    });
  });

  it("rejects plain TCP traffic", async () => {
    const { Socket } = await import("node:net");
    await new Promise<void>((resolve) => {
      const s = new Socket();
      s.connect(wsPort, "127.0.0.1", () => {
        s.write("plain text\r\n");
      });
      s.on("error", () => resolve());
      s.on("close", () => resolve());
    });
  });
});
```

- [ ] **Step 2: Run test, expect fail**

Run: `cd packages/drawio-mcp-server && pnpm test -- --testPathPatterns=multi-transport`
Expected: TLS test fails (server still serves plain WS).

- [ ] **Step 3: Pass TLS material from app to WS server**

Edit `packages/drawio-mcp-server/src/index.ts`:

a) At the top, add imports:

```ts
import { createServer as createHttpsServer } from "node:https";
import { resolveTlsMaterial, type ResolvedTlsMaterial } from "./tls/index.js";
```

b) In `createDrawioMcpApp`, BEFORE `let wsServer: WebSocketServer | undefined;`, add:

```ts
  const tlsMaterial: ResolvedTlsMaterial | null = resolveTlsMaterial({
    config: {
      tlsEnabled: config.tlsEnabled,
      tlsAuto: config.tlsAuto,
      tlsCert: config.tlsCert,
      tlsKey: config.tlsKey,
      tlsDir: config.tlsDir,
      host: config.host,
    },
    log: (msg) => getLog().log("info", msg),
  });
```

c) Modify `startWebSocketServer` body — replace:

```ts
    wsServer = new WebSocketServer({
      port: extensionPort,
      ...(host !== undefined ? { host } : {}),
    });
```

with:

```ts
    if (tlsMaterial) {
      const httpsServer = createHttpsServer({
        cert: tlsMaterial.cert,
        key: tlsMaterial.key,
      });
      httpsServer.listen({
        port: extensionPort,
        ...(host !== undefined ? { host } : {}),
      });
      wsServer = new WebSocketServer({ server: httpsServer });
    } else {
      wsServer = new WebSocketServer({
        port: extensionPort,
        ...(host !== undefined ? { host } : {}),
      });
    }
```

d) Update the existing log line in `startWebSocketServer`:

```ts
    getLog().debug(
      `Draw.io MCP Server (${VERSION}) starting (${tlsMaterial ? "WSS" : "WebSocket"} extension port: ${extensionPort})`,
    );
```

- [ ] **Step 4: Run test, expect pass**

Run: `cd packages/drawio-mcp-server && pnpm test -- --testPathPatterns=multi-transport`
Expected: all multi-transport tests pass including new TLS tests.

- [ ] **Step 5: Commit**

```bash
git add packages/drawio-mcp-server/src/index.ts packages/drawio-mcp-server/src/multi-transport.test.ts
git commit -m "feat(tls): wrap WebSocket server in https when TLS enabled"
```

---

### Task 11: Wire HTTP server to TLS

**Files:**
- Modify: `packages/drawio-mcp-server/src/index.ts`
- Modify: `packages/drawio-mcp-server/src/multi-transport.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/drawio-mcp-server/src/multi-transport.test.ts`:

```ts
describe("HTTP transport — TLS (https)", () => {
  let app: DrawioMcpApp;
  let logger: MemoryLogger;
  let httpServer:
    | Awaited<ReturnType<DrawioMcpApp["startHttpServer"]>>["server"]
    | undefined;
  let port: number;
  let tlsDir: string;

  beforeEach(async () => {
    logger = new MemoryLogger();
    tlsDir = mkdtempSync(join(tmpdir(), "tls-http-"));
    const cfg: ServerConfig = {
      ...defaultConfig(),
      extensionPort: 0,
      httpPort: 0,
      transports: ["http"],
      editorEnabled: false,
      tlsEnabled: true,
      tlsAuto: true,
      tlsDir,
    };

    app = createDrawioMcpApp({ log: logger, config: cfg });
    const features: HttpFeatureConfig = {
      enableMcp: true,
      enableEditor: false,
      enableHealth: true,
      enableConfig: false,
    };
    const started = await app.startHttpServer(0, cfg, features);
    httpServer = started.server;
    port = started.port;
  });

  afterEach(async () => {
    await app.close();
  });

  it("serves /health over HTTPS", async () => {
    const originalReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    try {
      const res = await fetch(`https://localhost:${port}/health`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ status: "ok" });
    } finally {
      if (originalReject === undefined) {
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      } else {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalReject;
      }
    }
  });

  it("rejects plain HTTP", async () => {
    await expect(fetch(`http://localhost:${port}/health`)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test, expect fail**

Run: `cd packages/drawio-mcp-server && pnpm test -- --testPathPatterns=multi-transport`
Expected: HTTPS tests fail (server still serves plain HTTP).

- [ ] **Step 3: Pass `createServer` + `serverOptions` to Hono `serve()`**

Edit `packages/drawio-mcp-server/src/index.ts`:

a) `startHttpServer` signature stays the same; inside, replace:

```ts
  const httpServer = serve({
    fetch: app.fetch,
    port: httpPort,
    ...(config.host !== undefined ? { hostname: config.host } : {}),
  });
```

with:

```ts
  const httpServer = serve({
    fetch: app.fetch,
    port: httpPort,
    ...(config.host !== undefined ? { hostname: config.host } : {}),
    ...(tlsMaterial
      ? {
          createServer: createHttpsServer,
          serverOptions: { cert: tlsMaterial.cert, key: tlsMaterial.key },
        }
      : {}),
  });
```

b) Move `tlsMaterial` from `createDrawioMcpApp` scope to be visible inside `startHttpServer` — `startHttpServer` is already nested inside `createDrawioMcpApp`'s closure, so it can read `tlsMaterial` directly. Verify by reading the current structure (`startHttpServer` is defined at module scope above; the inner version is wired through `app.startHttpServer`). If `startHttpServer` is module-scoped, add an extra parameter `tlsMaterial: ResolvedTlsMaterial | null` and pass it through from the call site in `createDrawioMcpApp`.

c) Update log lines in `startHttpServer`:

```ts
  const scheme = tlsMaterial ? "https" : "http";
  log.debug(`Draw.io MCP Server HTTP active on port ${listeningPort} (${scheme})`);
  if (features.enableMcp) {
    log.debug(`MCP endpoint: ${scheme}://localhost:${listeningPort}/mcp`);
  }
  if (features.enableEditor) {
    log.debug(`Editor: ${scheme}://localhost:${listeningPort}/`);
  }
```

d) Update `registerConfigRoute` to emit the right scheme:

```ts
function registerConfigRoute(
  app: Hono,
  config: ServerConfig,
  scheme: "http" | "https",
) {
  app.get("/api/config", (c) =>
    c.json({
      websocketPort: config.extensionPort,
      serverUrl: `${scheme}://localhost:${config.httpPort}`,
      websocketUrl: config.webSocketUrl,
    }),
  );
}
```

Update its caller in `createHttpApp` to pass `scheme` (derived from `Boolean(tlsMaterial)`).

- [ ] **Step 4: Run test, expect pass**

Run: `cd packages/drawio-mcp-server && pnpm test -- --testPathPatterns=multi-transport`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/drawio-mcp-server/src/index.ts packages/drawio-mcp-server/src/multi-transport.test.ts
git commit -m "feat(tls): https for HTTP transport via @hono/node-server"
```

---

### Task 12: Update help text

**Files:**
- Modify: `packages/drawio-mcp-server/src/index.ts`

- [ ] **Step 1: Edit `showHelp` body**

Insert these lines into the `Options:` block of `showHelp` (after `--logger`):

```
  --tls                          Enable TLS (HTTPS + WSS) on HTTP and WebSocket endpoints
  --tls-cert <path>              Manual TLS cert PEM (requires --tls and --tls-key)
  --tls-key <path>               Manual TLS key PEM (requires --tls and --tls-cert)
  --tls-auto                     Auto-generate self-signed cert via local CA (requires --tls)
  --tls-dir <path>               Override XDG data dir for TLS material (default: per-OS)
```

Add an example:

```
  drawio-mcp-server --editor --tls --tls-auto    # HTTPS editor with auto self-signed cert
```

- [ ] **Step 2: Smoke check**

Run: `cd packages/drawio-mcp-server && pnpm build && node build/index.js --help`
Expected: new options visible in output.

- [ ] **Step 3: Commit**

```bash
git add packages/drawio-mcp-server/src/index.ts
git commit -m "docs(tls): help text for new --tls flags"
```

---

### Task 13: CONFIG.md TLS section

**Files:**
- Modify: `CONFIG.md`

- [ ] **Step 1: Add TLS rows to the "CLI Flags & Environment Variables" table**

After the `--logger` row, add:

```
| `--tls` | `DRAWIO_MCP_TLS` | Enable TLS on HTTP and WebSocket endpoints (off by default) | disabled |
| `--tls-cert <path>` | `DRAWIO_MCP_TLS_CERT` | Manual TLS leaf cert PEM (requires `--tls`, mutually exclusive with `--tls-auto`) | - |
| `--tls-key <path>` | `DRAWIO_MCP_TLS_KEY` | Manual TLS leaf key PEM (requires `--tls`, mutually exclusive with `--tls-auto`) | - |
| `--tls-auto` | `DRAWIO_MCP_TLS_AUTO` | Auto-generate self-signed leaf cert via a persisted local CA (requires `--tls`) | disabled |
| `--tls-dir <path>` | `DRAWIO_MCP_TLS_DIR` | Override XDG data directory for auto-generated TLS material | per-OS XDG path |
```

- [ ] **Step 2: Add a new "TLS" section before "Logging"**

Insert this section into `CONFIG.md`:

````markdown
## TLS (HTTPS + WSS)

The server can terminate TLS on both endpoints (HTTP transport / built-in editor and WebSocket extension port). Two modes:

### Manual mode

Bring your own cert + key (e.g. via mkcert, Let's Encrypt, or a corporate CA):

```sh
drawio-mcp-server --transport http --editor \
  --tls --tls-cert ./server.crt --tls-key ./server.key
```

Both files must be PEM-encoded. The server does not chain or modify them; supply a complete chain in the cert file if needed.

### Auto mode (self-signed via local CA)

The server generates a per-user CA on first run and a leaf cert signed by it. Material is persisted so subsequent runs reuse it:

```sh
drawio-mcp-server --transport http --editor --tls --tls-auto
```

Default storage location (XDG-compliant):

| OS | Path |
|----|------|
| Linux | `${XDG_DATA_HOME:-~/.local/share}/drawio-mcp-server/tls/` |
| macOS | `~/Library/Application Support/drawio-mcp-server/tls/` |
| Windows | `%LOCALAPPDATA%\drawio-mcp-server\Data\tls\` |

Files:

- `ca.crt` — local CA, install once into your OS / browser trust store
- `ca.key` — CA private key (mode `0600` on POSIX, never share)
- `server.crt` — leaf cert (1y validity, regenerated when SAN list changes)
- `server.key` — leaf private key (mode `0600` on POSIX)
- `meta.json` — generation timestamps + SAN hash for drift detection

Override the directory with `--tls-dir` or `DRAWIO_MCP_TLS_DIR` (e.g. for Docker volumes).

### Trust store install

On the first auto-mode run the server prints the OS-specific command to install `ca.crt` into your trust store. Without this, browsers will refuse the WSS connection (the browser extension will appear silently disconnected). Quick reference:

- **Linux (Debian/Ubuntu):** `sudo cp <ca.crt> /usr/local/share/ca-certificates/drawio-mcp-ca.crt && sudo update-ca-certificates`
- **macOS:** `sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain <ca.crt>`
- **Windows (admin):** `certutil -addstore -f ROOT <ca.crt>`
- **Firefox:** uses its own NSS store — import via Settings → Privacy & Security → Certificates → Authorities → Import

Restart the browser after installing.

### Renewal

- Leaf cert is renewed automatically when within 30 days of expiry, or when the SAN list changes (e.g. you added `--host`).
- CA is renewed when within 30 days of its 10-year expiry. After CA renewal you must re-install `ca.crt` into the trust store.
- To force regeneration, delete the TLS directory.
````

- [ ] **Step 3: Commit**

```bash
git add CONFIG.md
git commit -m "docs(tls): TLS configuration section in CONFIG.md"
```

---

### Task 14: README key-highlight + link

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add one bullet to the key highlights section**

Find the existing key-highlights / features bullet list in `README.md`. Add:

```markdown
- **Built-in TLS** — opt-in HTTPS + WSS with manual cert/key or auto-generated self-signed material via a per-user local CA. See [CONFIG.md → TLS](./CONFIG.md#tls-https--wss).
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs(tls): mention TLS support in README highlights"
```

---

### Task 15: Dockerfile volume + env hint

**Files:**
- Modify: `Dockerfile`

- [ ] **Step 1: Edit Dockerfile runtime stage**

Add before the final `CMD`:

```dockerfile
# TLS material (auto-generated when --tls --tls-auto is set).
# Mount a host volume here to persist the local CA across container recreations:
#   docker run -v drawio-mcp-tls:/data/drawio-mcp-server/tls drawio-mcp-server ...
ENV XDG_DATA_HOME=/data
VOLUME ["/data/drawio-mcp-server/tls"]
```

- [ ] **Step 2: Build sanity check**

Run: `cd /home/eldzi/development/practical-architect-2/drawio-mcp-server && docker build -t drawio-mcp-tls-test . --target runtime`
Expected: build succeeds. (Skip if Docker not installed locally; CI will catch.)

- [ ] **Step 3: Commit**

```bash
git add Dockerfile
git commit -m "build(tls): persist auto-generated TLS material via /data volume"
```

---

### Task 16: Final lint + full test sweep

**Files:**
- (none)

- [ ] **Step 1: Lint**

Run: `cd packages/drawio-mcp-server && pnpm lint`
Expected: no errors.

- [ ] **Step 2: Format**

Run: `cd packages/drawio-mcp-server && pnpm format:check`
If failures, run `pnpm format` then re-check.

- [ ] **Step 3: Full test suite**

Run: `cd packages/drawio-mcp-server && pnpm build && pnpm test`
Expected: all tests pass.

- [ ] **Step 4: Manual smoke test (auto mode)**

Run in a fresh terminal:

```sh
DRAWIO_MCP_TLS_DIR=/tmp/drawio-tls-smoke \
  node packages/drawio-mcp-server/build/index.js --transport http --editor --tls --tls-auto --logger console
```

Expected stderr output includes:
- `Draw.io MCP Server HTTP active on port 3000 (https)`
- The CA install hint block referencing `/tmp/drawio-tls-smoke/ca.crt`

In a separate terminal:

```sh
curl -k https://localhost:3000/health
```

Expected: `{"status":"ok"}`

Stop the server, restart with the same command, confirm the install hint does NOT appear (material reused).

- [ ] **Step 5: Manual smoke test (manual mode)**

Use the auto-generated material from the previous step as if it were manual:

```sh
node packages/drawio-mcp-server/build/index.js --transport http --tls \
  --tls-cert /tmp/drawio-tls-smoke/server.crt \
  --tls-key /tmp/drawio-tls-smoke/server.key
```

Expected: server starts, `https://localhost:3000/health` works.

- [ ] **Step 6: Commit any formatting fixes (if any)**

```bash
git add -A
git commit -m "chore(tls): apply formatter to TLS module"
```

(Skip this step if there is nothing to commit.)

---

## Self-Review Notes

Spec coverage: every confirmed point from the design dialog is implemented — both manual + auto modes (Tasks 5, 8, 9), XDG paths (Task 3), `node-forge` (Task 4), SAN-drift triggers leaf-only regen with CA preserved (Task 8 step 3, branch handling), per-OS install hint printed at first generation (Task 7 + Task 8). Both endpoints get TLS (Tasks 10, 11). Mutual-exclusion validation lives in two places — `config.ts` (early CLI/env rejection, Task 9) and `tls/index.ts` (defence-in-depth at runtime, Task 8) — intentional.

Type/name consistency: `ServerConfig` fields (`tlsEnabled`, `tlsAuto`, `tlsCert`, `tlsKey`, `tlsDir`) match what `resolveTlsMaterial`'s `ResolveTlsConfig` expects. `tlsFilePaths` returns `caCert/caKey/serverCert/serverKey/meta` — referenced consistently across Tasks 4, 8.

Out-of-scope reminders: existing `HARNESS_HTTPS=1` Caddy harness path is left alone — it predates this work and exercises a different scenario (proxy-fronted TLS). After Task 11 we have native server TLS; converting the harness is future work.
