import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(__dirname, "../fixtures/iframe-host.html");

const PORT = Number(process.env.PORT ?? 5174);
const HOST = process.env.HOST ?? "127.0.0.1";

const server = createServer(async (req, res) => {
  if (req.method !== "GET") {
    res.writeHead(405).end("Method Not Allowed");
    return;
  }
  try {
    const html = await readFile(FIXTURE);
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    });
    res.end(html);
  } catch (err) {
    res.writeHead(500, { "content-type": "text/plain" });
    res.end(`Failed to read fixture: ${(err as Error).message}`);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`iframe-host fixture serving at http://${HOST}:${PORT}/`);
  console.log(`(serving ${FIXTURE})`);
});
