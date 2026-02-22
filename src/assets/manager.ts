import cachedir from "cachedir";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const DEFAULT_CACHE_NAME = "drawio-mcp-server";

export interface AssetConfig {
  readonly assetPath?: string;
}

export function getCacheDir(customPath?: string): string {
  if (customPath) {
    return customPath;
  }
  const dir = cachedir(DEFAULT_CACHE_NAME);
  if (!dir) {
    throw new Error(
      "Could not determine cache directory. Use --asset-path to specify one.",
    );
  }
  return dir;
}

export function getAssetRoot(config: AssetConfig): string {
  const cacheDir = getCacheDir(config.assetPath);
  return join(cacheDir, "webapp");
}

export function assetsExist(config: AssetConfig): boolean {
  const assetRoot = getAssetRoot(config);
  const indexPath = join(assetRoot, "index.html");
  return existsSync(indexPath);
}

export function getLocalPluginPath(): string {
  return join(__dirname, "..", "..", "build", "plugin", "mcp-plugin.js");
}

export function getLocalAssetPath(): string {
  return join(__dirname, "..", "assets", "drawio", "webapp");
}

export function isUsingLocalAssets(config: AssetConfig): boolean {
  const localPath = getLocalAssetPath();
  const indexPath = join(localPath, "index.html");
  return existsSync(indexPath);
}
