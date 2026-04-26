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

const here = dirname(fileURLToPath(import.meta.url));
// Tests run from build/, so build/index.js is sibling to this compiled file.
const SERVER_BIN = join(here, "index.js");

describe("stdio transport stdout purity", () => {
  let proc: ChildProcessWithoutNullStreams | undefined;

  afterEach(() => {
    if (proc && !proc.killed) {
      proc.kill("SIGTERM");
    }
    proc = undefined;
  });

  it("emits only valid JSON-RPC frames on stdout during initialize", async () => {
    const extensionPort = await getFreePort();
    const httpPort = await getFreePort();

    proc = spawn(
      process.execPath,
      [
        SERVER_BIN,
        "--transport",
        "stdio",
        "--extension-port",
        String(extensionPort),
        "--http-port",
        String(httpPort),
        "--host",
        "127.0.0.1",
      ],
      {
        stdio: ["pipe", "pipe", "pipe"],
      },
    );

    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    proc.stdout.on("data", (b) => stdoutChunks.push(b.toString("utf8")));
    proc.stderr.on("data", (b) => stderrChunks.push(b.toString("utf8")));

    const initRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "purity-test", version: "1.0.0" },
      },
    };
    proc.stdin.write(`${JSON.stringify(initRequest)}\n`);

    // Wait for the initialize response to arrive on stdout.
    const response = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("timed out waiting for initialize response")),
        10000,
      );
      const onChunk = () => {
        const text = stdoutChunks.join("");
        if (text.includes("\n")) {
          clearTimeout(timer);
          proc?.stdout.off("data", onChunk);
          resolve(text);
        }
      };
      proc?.stdout.on("data", onChunk);
      // Re-check synchronously in case data arrived before we attached.
      onChunk();
    });

    const lines = response.split("\n").filter((line) => line.length > 0);
    expect(lines.length).toBeGreaterThan(0);

    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }

    const parsed = JSON.parse(lines[0]);
    expect(parsed.jsonrpc).toBe("2.0");
    expect(parsed.id).toBe(1);
    expect(parsed.result?.serverInfo?.name).toBe("drawio-mcp-server");
  }, 20000);
});
