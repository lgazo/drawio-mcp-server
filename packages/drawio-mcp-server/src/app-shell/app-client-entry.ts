// Bundled by scripts/build-app-shell.mjs into build/app-shell/app-client.js.
// Exposes the ext-apps browser client to the shell HTML (loaded inline there)
// so the served resource stays a single self-contained HTML file.
import { App } from "@modelcontextprotocol/ext-apps";

(globalThis as unknown as Record<string, unknown>).McpAppsApp = App;
