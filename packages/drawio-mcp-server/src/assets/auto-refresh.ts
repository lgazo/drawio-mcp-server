import { rmSync } from "node:fs";
import type { Logger } from "../types.js";
import {
  SERVER_COMPAT_MATRIX,
  versionInWindow,
  type ServerCompatMatrix,
} from "../drawio-compat/matrix.js";

export { SERVER_COMPAT_MATRIX };
import { getAssetRoot, getCacheDir, type AssetConfig } from "./manager.js";
import { readCachedDrawioVersion } from "./version.js";

export type DownloaderPort = {
  downloadAndExtract: (targetDir: string, log?: Logger) => Promise<void>;
};

export async function ensureSupportedAssets(
  config: AssetConfig,
  matrix: ServerCompatMatrix,
  log: Logger,
  ports: DownloaderPort,
): Promise<{ version: string | null; refetched: boolean }> {
  const cacheDir = getCacheDir(config.assetPath);
  const assetRoot = getAssetRoot(config);
  const cached = await readCachedDrawioVersion(assetRoot);

  if (cached && versionInWindow(cached, matrix)) {
    return { version: cached, refetched: false };
  }

  log.log(
    "warning",
    `cached drawio v${cached ?? "?"} is outside supported window (>= v${matrix.supportedFloor}); refetching latest`,
  );
  rmSync(assetRoot, { recursive: true, force: true });
  await ports.downloadAndExtract(cacheDir, log);

  const after = await readCachedDrawioVersion(assetRoot);
  if (!after || !versionInWindow(after, matrix)) {
    log.log(
      "error",
      `drawio latest v${after ?? "?"} is still outside supported window; tools may misbehave`,
    );
  }
  return { version: after, refetched: true };
}
