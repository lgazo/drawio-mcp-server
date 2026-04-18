#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { get as httpsGet } from "node:https";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CADDY_VERSION = "2.8.4";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, "..");
const binDir = join(pkgRoot, "bin");
const binPath = join(binDir, process.platform === "win32" ? "caddy.exe" : "caddy");

function log(msg) {
  console.log(`[install-caddy] ${msg}`);
}

function warn(msg) {
  console.warn(`[install-caddy] ${msg}`);
}

function fail(msg) {
  console.error(`[install-caddy] ${msg}`);
  process.exit(1);
}

function assetName(version) {
  const p = process.platform;
  const a = process.arch;
  if (p === "linux" && a === "x64") return `caddy_${version}_linux_amd64.tar.gz`;
  if (p === "linux" && a === "arm64") return `caddy_${version}_linux_arm64.tar.gz`;
  if (p === "linux" && a === "arm") return `caddy_${version}_linux_armv7.tar.gz`;
  if (p === "darwin" && a === "x64") return `caddy_${version}_mac_amd64.tar.gz`;
  if (p === "darwin" && a === "arm64") return `caddy_${version}_mac_arm64.tar.gz`;
  if (p === "win32" && a === "x64") return `caddy_${version}_windows_amd64.zip`;
  if (p === "win32" && a === "arm64") return `caddy_${version}_windows_arm64.zip`;
  return null;
}

function currentBinaryVersion() {
  if (!existsSync(binPath)) return null;
  try {
    const out = execFileSync(binPath, ["version"], { encoding: "utf8", timeout: 5000 });
    const match = out.match(/v?(\d+\.\d+\.\d+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function download(url, destPath) {
  return new Promise((resolve, reject) => {
    function follow(u, redirects) {
      if (redirects > 5) return reject(new Error(`too many redirects for ${u}`));
      httpsGet(u, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return follow(res.headers.location, redirects + 1);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} for ${u}`));
        }
        const out = createWriteStream(destPath);
        res.pipe(out);
        out.on("finish", () => out.close(() => resolve()));
        out.on("error", reject);
      }).on("error", reject);
    }
    follow(url, 0);
  });
}

async function fetchText(url) {
  return new Promise((resolve, reject) => {
    function follow(u, redirects) {
      if (redirects > 5) return reject(new Error(`too many redirects for ${u}`));
      httpsGet(u, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return follow(res.headers.location, redirects + 1);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} for ${u}`));
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        res.on("error", reject);
      }).on("error", reject);
    }
    follow(url, 0);
  });
}

function sha512File(path) {
  const h = createHash("sha512");
  h.update(readFileSync(path));
  return h.digest("hex");
}

function extract(archivePath, assetName, targetDir) {
  const lower = assetName.toLowerCase();
  if (lower.endsWith(".tar.gz") || lower.endsWith(".tgz")) {
    const r = spawnSync("tar", ["-xzf", archivePath, "-C", targetDir, "caddy"], { stdio: "inherit" });
    if (r.status !== 0) throw new Error(`tar extraction failed (exit ${r.status})`);
    return join(targetDir, "caddy");
  }
  if (lower.endsWith(".zip")) {
    // Windows: tar on Win10+ understands .zip
    const r = spawnSync("tar", ["-xf", archivePath, "-C", targetDir, "caddy.exe"], { stdio: "inherit" });
    if (r.status !== 0) throw new Error(`tar extraction (zip) failed (exit ${r.status})`);
    return join(targetDir, "caddy.exe");
  }
  throw new Error(`unknown archive format: ${assetName}`);
}

async function main() {
  if (process.env.CADDY_SKIP_DOWNLOAD === "1") {
    log("CADDY_SKIP_DOWNLOAD=1 set, skipping download");
    return;
  }

  if (process.env.CADDY_BINARY) {
    log(`CADDY_BINARY=${process.env.CADDY_BINARY} set; expecting you to use that path instead`);
    return;
  }

  const existing = currentBinaryVersion();
  if (existing === CADDY_VERSION) {
    log(`bin/caddy already at v${CADDY_VERSION}, skipping`);
    return;
  }
  if (existing) {
    log(`bin/caddy is v${existing}, updating to v${CADDY_VERSION}`);
  }

  const asset = assetName(CADDY_VERSION);
  if (!asset) {
    warn(
      `unsupported platform ${process.platform}/${process.arch}. ` +
        `Install Caddy manually: https://caddyserver.com/docs/install ` +
        `and either put the binary at ${binPath} or set CADDY_BINARY.`,
    );
    return;
  }

  mkdirSync(binDir, { recursive: true });
  const base = `https://github.com/caddyserver/caddy/releases/download/v${CADDY_VERSION}`;
  const archiveUrl = `${base}/${asset}`;
  const checksumsUrl = `${base}/caddy_${CADDY_VERSION}_checksums.txt`;
  const tmpArchive = join(binDir, `.${asset}.partial`);

  log(`downloading ${archiveUrl}`);
  try {
    await download(archiveUrl, tmpArchive);
  } catch (err) {
    try { rmSync(tmpArchive, { force: true }); } catch {}
    fail(`download failed: ${err.message}`);
  }

  log(`fetching checksums`);
  let expected;
  try {
    const checksums = await fetchText(checksumsUrl);
    for (const line of checksums.split(/\r?\n/)) {
      const m = line.match(/^([0-9a-f]{128})\s+(\S+)$/i);
      if (m && m[2] === asset) {
        expected = m[1].toLowerCase();
        break;
      }
    }
  } catch (err) {
    rmSync(tmpArchive, { force: true });
    fail(`checksum fetch failed: ${err.message}`);
  }
  if (!expected) {
    rmSync(tmpArchive, { force: true });
    fail(`could not locate sha512 for ${asset} in checksums.txt`);
  }

  const actual = sha512File(tmpArchive).toLowerCase();
  if (actual !== expected) {
    rmSync(tmpArchive, { force: true });
    fail(`sha512 mismatch: expected ${expected}, got ${actual}`);
  }
  log(`sha512 verified`);

  log(`extracting`);
  try {
    const extracted = extract(tmpArchive, asset, binDir);
    if (extracted !== binPath) {
      // normalize location if tar dropped it as plain "caddy"
      if (existsSync(extracted) && extracted !== binPath) {
        // rename cross-platform
        const fs = await import("node:fs/promises");
        await fs.rename(extracted, binPath);
      }
    }
  } catch (err) {
    fail(`extraction failed: ${err.message}`);
  } finally {
    rmSync(tmpArchive, { force: true });
  }

  if (process.platform !== "win32") {
    chmodSync(binPath, 0o755);
  }

  const finalVersion = currentBinaryVersion();
  if (finalVersion !== CADDY_VERSION) {
    fail(`post-install version check failed (got ${finalVersion}, expected ${CADDY_VERSION})`);
  }
  const size = statSync(binPath).size;
  log(`installed caddy v${CADDY_VERSION} at ${binPath} (${Math.round(size / 1_048_576)} MB)`);
}

main().catch((err) => fail(err?.stack || String(err)));
