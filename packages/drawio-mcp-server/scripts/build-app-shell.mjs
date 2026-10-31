// Bundles the ext-apps browser client into a single IIFE and copies the
// shell HTML into build/app-shell/. The MCP Apps resource handler reads
// both at runtime and splices them into one self-contained HTML document.
import { build } from "esbuild";
import { cp, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("../", import.meta.url));

await mkdir(`${packageRoot}build/app-shell`, { recursive: true });

await build({
  entryPoints: [`${packageRoot}src/app-shell/app-client-entry.ts`],
  bundle: true,
  format: "iife",
  minify: true,
  outfile: `${packageRoot}build/app-shell/app-client.js`,
  platform: "browser",
});

await cp(
  `${packageRoot}src/app-shell/shell.html`,
  `${packageRoot}build/app-shell/shell.html`,
);