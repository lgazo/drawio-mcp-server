import { existsSync } from "node:fs";
import { open } from "node:fs/promises";
import { join } from "node:path";

const HEAD_BYTES = 200_000;
const VERSION_RE = /EditorUi\.VERSION\s*=\s*"(\d+\.\d+\.\d+)"/;

export async function readCachedDrawioVersion(
  assetRoot: string,
): Promise<string | null> {
  const path = join(assetRoot, "js", "app.min.js");
  if (!existsSync(path)) return null;
  const handle = await open(path, "r");
  try {
    const buf = Buffer.alloc(HEAD_BYTES);
    const { bytesRead } = await handle.read(buf, 0, HEAD_BYTES, 0);
    const text = buf.subarray(0, bytesRead).toString("utf8");
    const match = VERSION_RE.exec(text);
    return match?.[1] ?? null;
  } finally {
    await handle.close();
  }
}
