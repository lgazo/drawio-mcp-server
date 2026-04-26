import {
  createWriteStream,
  existsSync,
  mkdirSync,
  createReadStream,
  rmSync,
} from "node:fs";
import { pipeline } from "node:stream/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Extract } from "unzipper";

import type { Logger } from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DRAWIO_GITHUB_API =
  "https://api.github.com/repos/jgraph/drawio/releases/latest";

export async function getLatestWarUrl(): Promise<string> {
  const response = await fetch(DRAWIO_GITHUB_API);
  if (!response.ok) {
    throw new Error(`Failed to get draw.io release info: ${response.status}`);
  }

  const data = await response.json();
  const warAsset = data.assets?.find(
    (asset: { name: string }) => asset.name === "draw.war",
  );

  if (!warAsset) {
    throw new Error("Could not find draw.war in latest release");
  }

  return warAsset.browser_download_url;
}

export async function downloadFile(
  url: string,
  destPath: string,
): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to download: ${response.status} ${response.statusText}`,
    );
  }

  if (!response.body) {
    throw new Error("No response body");
  }

  const destDir = dirname(destPath);
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }

  await pipeline(response.body, createWriteStream(destPath));
}

export async function extractWar(
  warPath: string,
  extractDir: string,
): Promise<void> {
  if (!existsSync(extractDir)) {
    mkdirSync(extractDir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    const extract = Extract({ path: extractDir });
    const stream = createReadStream(warPath);

    stream.pipe(extract);

    extract.on("close", resolve);
    extract.on("error", reject);
  });
}

export function cleanupExtractedFiles(extractDir: string, log: Logger): void {
  const webappDir = join(extractDir, "webapp");
  const pathsToRemove = [
    join(webappDir, "WEB-INF"),
    join(webappDir, "META-INF"),
  ];

  for (const path of pathsToRemove) {
    if (existsSync(path)) {
      try {
        rmSync(path, { recursive: true, force: true });
        log.log("info", `Removed: ${path}`);
      } catch (err) {
        log.log("warning", `Failed to remove ${path}:`, err);
      }
    }
  }
}

export async function downloadAndExtractAssets(
  targetDir: string,
  log: Logger,
): Promise<void> {
  log.log("info", "Fetching draw.io release info...");

  const warUrl = await getLatestWarUrl();
  const warPath = join(targetDir, "draw.war");

  log.log("info", `Downloading draw.war from ${warUrl}...`);
  await downloadFile(warUrl, warPath);
  log.log("info", "Download complete.");

  const webappDir = join(targetDir, "webapp");

  log.log("info", "Extracting archive...");
  await extractWar(warPath, webappDir);
  log.log("info", "Extraction complete.");

  log.log("info", "Cleaning up unnecessary files...");
  cleanupExtractedFiles(targetDir, log);

  // Remove the WAR file
  try {
    rmSync(warPath, { force: true });
  } catch (err) {
    log.log("warning", "Failed to remove WAR file:", err);
  }

  log.log("info", "Assets ready!");
}

export async function ensureAssets(
  config: {
    readonly assetPath?: string;
  },
  log: Logger,
): Promise<{ readonly assetRoot: string; readonly isLocal: boolean }> {
  const { getCacheDir, getAssetRoot, assetsExist } =
    await import("./manager.js");

  const cacheDir = getCacheDir(config.assetPath);
  const assetRoot = getAssetRoot(config);

  if (!assetsExist(config)) {
    log.log("info", `Assets not found in ${assetRoot}. Downloading...`);
    await downloadAndExtractAssets(cacheDir, log);
  }

  return { assetRoot, isLocal: true };
}
