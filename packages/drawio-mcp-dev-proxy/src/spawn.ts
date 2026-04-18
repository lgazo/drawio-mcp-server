import { spawn, type ChildProcessByStdio } from "node:child_process";
import { existsSync } from "node:fs";
import { createConnection } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Readable } from "node:stream";

export const DEFAULT_PROXY_PORT = 8443;

export interface SpawnCaddyOptions {
  /** HTTPS port that Caddy will listen on */
  proxyPort: number;
  /** Upstream HTTP port (drawio-mcp-server Hono) */
  httpUpstream: number;
  /** Upstream WebSocket port (drawio-mcp-server ws) */
  wsUpstream: number;
  /** Override the Caddy binary location; defaults to ../bin/caddy or $CADDY_BINARY */
  binaryPath?: string;
  /** Override the Caddyfile location; defaults to ../Caddyfile */
  caddyfilePath?: string;
  /** Print Caddy stdout/stderr to the parent console (default: false) */
  verbose?: boolean;
  /** Time in ms to wait for the TLS port to accept connections (default: 8000) */
  readyTimeoutMs?: number;
}

export interface CaddyHandle {
  readonly proxyPort: number;
  stop(): Promise<void>;
}

const HERE = dirname(fileURLToPath(import.meta.url));
// HERE resolves to either `build/` (post-tsc) or `src/` (ts-node / jest). Package
// root is one level up in both cases.
const PKG_ROOT = join(HERE, "..");

function resolveBinary(override?: string): string {
  if (override) return override;
  if (process.env.CADDY_BINARY) return process.env.CADDY_BINARY;
  const name = process.platform === "win32" ? "caddy.exe" : "caddy";
  return join(PKG_ROOT, "bin", name);
}

function resolveCaddyfile(override?: string): string {
  if (override) return override;
  return join(PKG_ROOT, "Caddyfile");
}

async function waitForPort(port: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastErr: unknown;
  while (Date.now() < deadline) {
    try {
      await new Promise<void>((resolve, reject) => {
        const sock = createConnection({ host: "127.0.0.1", port }, () => {
          sock.end();
          resolve();
        });
        sock.once("error", reject);
      });
      return;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error(
    `caddy did not start listening on port ${port} within ${timeoutMs} ms` +
      (lastErr ? `: ${(lastErr as Error).message}` : ""),
  );
}

export async function spawnCaddy(opts: SpawnCaddyOptions): Promise<CaddyHandle> {
  const bin = resolveBinary(opts.binaryPath);
  const caddyfile = resolveCaddyfile(opts.caddyfilePath);

  if (!existsSync(bin)) {
    throw new Error(
      `caddy binary not found at ${bin}. Run \`pnpm --filter drawio-mcp-dev-proxy setup\` or set CADDY_BINARY.`,
    );
  }
  if (!existsSync(caddyfile)) {
    throw new Error(`Caddyfile not found at ${caddyfile}`);
  }

  const readyTimeoutMs = opts.readyTimeoutMs ?? 8000;

  const child = spawn(
    bin,
    ["run", "--config", caddyfile, "--adapter", "caddyfile"],
    {
      env: {
        ...process.env,
        DRAWIO_MCP_PROXY_PORT: String(opts.proxyPort),
        DRAWIO_MCP_HTTP_UPSTREAM: String(opts.httpUpstream),
        DRAWIO_MCP_WS_UPSTREAM: String(opts.wsUpstream),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  ) as ChildProcessByStdio<null, Readable, Readable>;

  const stderrChunks: string[] = [];
  child.stderr.on("data", (chunk: Buffer) => {
    const text = chunk.toString("utf8");
    stderrChunks.push(text);
    if (opts.verbose) process.stderr.write(text);
  });
  if (opts.verbose) {
    child.stdout.on("data", (chunk: Buffer) => process.stdout.write(chunk));
  } else {
    child.stdout.resume();
  }

  const earlyExit = new Promise<never>((_, reject) => {
    child.once("exit", (code, signal) => {
      reject(
        new Error(
          `caddy exited before becoming ready (code=${code}, signal=${signal}). ` +
            `stderr: ${stderrChunks.join("").slice(-2000)}`,
        ),
      );
    });
  });

  try {
    await Promise.race([waitForPort(opts.proxyPort, readyTimeoutMs), earlyExit]);
  } catch (err) {
    try {
      child.kill("SIGTERM");
    } catch {}
    throw err;
  }

  let stopped = false;
  return {
    proxyPort: opts.proxyPort,
    stop: () =>
      new Promise<void>((resolve) => {
        if (stopped) return resolve();
        stopped = true;
        if (child.exitCode !== null || child.signalCode) {
          return resolve();
        }
        child.once("exit", () => resolve());
        try {
          child.kill("SIGTERM");
        } catch {
          resolve();
        }
        setTimeout(() => {
          if (child.exitCode === null) {
            try {
              child.kill("SIGKILL");
            } catch {}
          }
        }, 2000);
      }),
  };
}
