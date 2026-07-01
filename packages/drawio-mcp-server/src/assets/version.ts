import { createReadStream, existsSync } from "node:fs";
import { join } from "node:path";

const CHUNK_BYTES = 1024 * 1024;
const OVERLAP_BYTES = 64;
const VERSION_RE = /EditorUi\.VERSION\s*=\s*"(\d+\.\d+\.\d+)"/;

export async function readCachedDrawioVersion(
  assetRoot: string,
): Promise<string | null> {
  const path = join(assetRoot, "js", "app.min.js");
  if (!existsSync(path)) return null;

  return new Promise((resolve, reject) => {
    const stream = createReadStream(path, { highWaterMark: CHUNK_BYTES });
    let tail = "";
    let resolved = false;
    const finish = (value: string | null) => {
      if (resolved) return;
      resolved = true;
      stream.destroy();
      resolve(value);
    };
    stream.on("data", (chunk) => {
      const text =
        tail +
        (typeof chunk === "string" ? chunk : chunk.toString("utf8"));
      const match = VERSION_RE.exec(text);
      if (match) {
        finish(match[1] ?? null);
        return;
      }
      tail = text.slice(-OVERLAP_BYTES);
    });
    stream.on("end", () => finish(null));
    stream.on("error", (err) => {
      if (resolved) return;
      resolved = true;
      reject(err);
    });
  });
}
