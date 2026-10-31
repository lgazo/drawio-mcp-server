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

await build({
  entryPoints: [`${packageRoot}src/app-shell/embed-protocol-entry.ts`],
  bundle: true,
  format: "iife",
  minify: true,
  // Named `*.iife.js` so it does not collide with the tsc output of
  // src/app-shell/embed-protocol.ts at build/app-shell/embed-protocol.js
  // (tsc runs first, esbuild runs last and would otherwise overwrite the
  // compiled module with the browser IIFE).
  outfile: `${packageRoot}build/app-shell/embed-protocol.iife.js`,
  platform: "browser",
});

await cp(
  `${packageRoot}src/app-shell/shell.html`,
  `${packageRoot}build/app-shell/shell.html`,
);