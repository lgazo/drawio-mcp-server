import { copyFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface InstallResult {
  pluginsDir: string;
  installedPath: string;
  overwrote: boolean;
}

/**
 * Resolve drawio-desktop's plugins directory for the current platform.
 *
 * Mirrors Electron's `app.getPath("userData")` for the productName "draw.io":
 *   linux:  $XDG_CONFIG_HOME/draw.io/plugins  (defaults to ~/.config/draw.io/plugins)
 *   darwin: ~/Library/Application Support/draw.io/plugins
 *   win32:  %APPDATA%/draw.io/plugins
 */
export function resolveDrawioPluginsDir(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (platform === "win32") {
    const appData = env.APPDATA;
    if (!appData || appData.length === 0) {
      throw new Error(
        "APPDATA environment variable is not set; cannot locate drawio-desktop plugins directory.",
      );
    }
    return join(appData, "draw.io", "plugins");
  }

  if (platform === "darwin") {
    return join(
      homedir(),
      "Library",
      "Application Support",
      "draw.io",
      "plugins",
    );
  }

  // linux + everything else: XDG
  const xdg = env.XDG_CONFIG_HOME;
  const base =
    xdg && xdg.length > 0 ? xdg : join(homedir(), ".config");
  return join(base, "draw.io", "plugins");
}

/**
 * Source path of the bundled mcp-plugin.js produced by the server build.
 * Same resolution style as `assets/manager.ts:getLocalPluginPath`.
 */
function getBundledPluginPath(): string {
  return join(__dirname, "..", "build", "plugin", "mcp-plugin.js");
}

/**
 * Copy the bundled mcp-plugin.js into drawio-desktop's plugins directory.
 *
 * Always overwrites an existing file (plugin version tracks server version).
 *
 * @param opts.targetDir override the resolved plugins directory (used by tests)
 */
export async function installDesktopPlugin(
  opts: { targetDir?: string } = {},
): Promise<InstallResult> {
  const pluginsDir = opts.targetDir ?? resolveDrawioPluginsDir();
  const source = getBundledPluginPath();

  if (!existsSync(source)) {
    throw new Error(
      `Bundled mcp-plugin.js not found at ${source}. Run "pnpm --filter drawio-mcp-server build" first.`,
    );
  }

  await mkdir(pluginsDir, { recursive: true });

  const installedPath = join(pluginsDir, "mcp-plugin.js");
  const overwrote = existsSync(installedPath);

  await copyFile(source, installedPath);

  return { pluginsDir, installedPath, overwrote };
}
