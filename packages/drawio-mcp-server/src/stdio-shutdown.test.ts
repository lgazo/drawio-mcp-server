import { afterEach, describe, expect, it } from "@jest/globals";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      if (addr && typeof addr === "object") {
        const port = addr.port;
        srv.close(() => resolve(port));
      } else {
        srv.close(() => reject(new Error("could not resolve free port")));
      }
    });
  });
}

async function isPortFree(port: number, host = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.once("error", () => resolve(false));
    srv.listen({ port, host }, () => {
      srv.close(() => resolve(true));
    });
  });
}

async function waitForPortHeld(
  port: number,
  host: string,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const free = await isPortFree(port, host);
    if (!free) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
}

async function waitForExit(
  proc: ChildProcessWithoutNullStreams,
  timeoutMs: number,
): Promise<number | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    proc.once("exit", (code) => {
      clearTimeout(timer);
      resolve(code ?? 0);
    });
  });
}

const here = dirname(fileURLToPath(import.meta.url));
const SERVER_BIN = join(here, "index.js");
const HOST = "127.0.0.1";

function spawnServer(
  extensionPort: number,
  httpPort: number,
  transport: "stdio" | "http" = "stdio",
) {
  return spawn(
    process.execPath,
    [
      SERVER_BIN,
      "--transport",
      transport,
      "--extension-port",
      String(extensionPort),
      "--http-port",
      String(httpPort),
      "--host",
      HOST,
    ],
    { stdio: ["pipe", "pipe", "pipe"] },
  );
}

describe("graceful shutdown releases WebSocket port", () => {
  let proc: ChildProcessWithoutNullStreams | undefined;

  afterEach(async () => {
    if (proc && !proc.killed) {
      proc.kill("SIGKILL");
      await new Promise((r) => setTimeout(r, 100));
    }
    proc = undefined;
  });

  it("releases extension port after SIGTERM", async () => {
    const extensionPort = await getFreePort();
    const httpPort = await getFreePort();

    proc = spawnServer(extensionPort, httpPort);
    const portTaken = await waitForPortHeld(extensionPort, HOST, 5000);
    expect(portTaken).toBe(true);

    proc.kill("SIGTERM");
    const exitCode = await waitForExit(proc, 5000);
    expect(exitCode).not.toBeNull();

    const free = await isPortFree(extensionPort, HOST);
    expect(free).toBe(true);
  }, 20000);

  it("releases extension port after SIGINT", async () => {
    const extensionPort = await getFreePort();
    const httpPort = await getFreePort();

    proc = spawnServer(extensionPort, httpPort);
    const portTaken = await waitForPortHeld(extensionPort, HOST, 5000);
    expect(portTaken).toBe(true);

    proc.kill("SIGINT");
    const exitCode = await waitForExit(proc, 5000);
    expect(exitCode).not.toBeNull();

    const free = await isPortFree(extensionPort, HOST);
    expect(free).toBe(true);
  }, 20000);

  it("releases HTTP and extension ports after SIGTERM in http transport", async () => {
    const extensionPort = await getFreePort();
    const httpPort = await getFreePort();

    proc = spawnServer(extensionPort, httpPort, "http");
    const extTaken = await waitForPortHeld(extensionPort, HOST, 5000);
    const httpTaken = await waitForPortHeld(httpPort, HOST, 5000);
    expect(extTaken).toBe(true);
    expect(httpTaken).toBe(true);

    proc.kill("SIGTERM");
    const exitCode = await waitForExit(proc, 5000);
    expect(exitCode).not.toBeNull();

    expect(await isPortFree(extensionPort, HOST)).toBe(true);
    expect(await isPortFree(httpPort, HOST)).toBe(true);
  }, 20000);

  it("releases extension port when stdio host closes stdin pipe", async () => {
    const extensionPort = await getFreePort();
    const httpPort = await getFreePort();

    proc = spawnServer(extensionPort, httpPort);
    const portTaken = await waitForPortHeld(extensionPort, HOST, 5000);
    expect(portTaken).toBe(true);

    proc.stdin.end();
    const exitCode = await waitForExit(proc, 5000);
    expect(exitCode).not.toBeNull();

    const free = await isPortFree(extensionPort, HOST);
    expect(free).toBe(true);
  }, 20000);
});
