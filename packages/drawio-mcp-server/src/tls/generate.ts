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
  const bytes = forge.random.getBytesSync(SERIAL_BYTES);
  const arr = Array.from(bytes, (c) => c.charCodeAt(0));
  arr[0] = arr[0] & 0x7f;
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function setValidity(
  cert: forge.pki.Certificate,
  from: Date,
  years: number,
): void {
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
  writeFileSync(args.paths.meta, JSON.stringify(meta, null, 2), {
    mode: 0o644,
  });
}

export function readMeta(paths: TlsFilePaths): PersistedMeta | null {
  if (!existsSync(paths.meta)) return null;
  let parsed: PersistedMeta;
  try {
    const raw = readFileSync(paths.meta, "utf8");
    parsed = JSON.parse(raw) as PersistedMeta;
  } catch {
    return null;
  }
  if (parsed?.version !== 1) return null;
  return parsed;
}

export function loadCaMaterial(paths: TlsFilePaths): CertMaterial {
  if (!existsSync(paths.caCert) || !existsSync(paths.caKey)) {
    throw new Error(
      `TLS material directory is in an inconsistent state: ${dirname(paths.caCert)}. Delete it and restart.`,
    );
  }
  const certPem = readFileSync(paths.caCert, "utf8");
  const keyPem = readFileSync(paths.caKey, "utf8");
  const cert = forge.pki.certificateFromPem(certPem);
  const privateKey = forge.pki.privateKeyFromPem(
    keyPem,
  ) as forge.pki.rsa.PrivateKey;
  return {
    certPem,
    keyPem,
    cert,
    keys: { privateKey, publicKey: cert.publicKey as forge.pki.rsa.PublicKey },
  };
}
