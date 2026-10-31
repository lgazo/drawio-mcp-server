import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";

import type { ServerConfig } from "./config.js";
import { SHOW_DIAGRAM_RESOURCE_URI } from "./tools/show-diagram.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function editor_origin(config: ServerConfig): string {
  const scheme = config.tlsEnabled ? "https" : "http";
  return `${scheme}://localhost:${config.httpPort}`;
}

export function build_editor_url(config: ServerConfig): string {
  // No `offline=1`: drawio's App.start skips its entire plugin-loading block
  // (App.initPluginCallback — what assigns window.Draw) when offline=1 is
  // set, so mcp-plugin.js would never boot and the framed editor would
  // never connect to the WebSocket bridge.
  return `${editor_origin(config)}/index.html?embed=1&proto=json&local=1`;
}

export function build_editor_standalone_url(config: ServerConfig): string {
  // No embed params: this link opens the normal editor tab (the pre-MCP-Apps
  // workflow), where the draw.io plugin bootstraps and connects as before,
  // and the MCP tools keep working on the live document.
  return `${editor_origin(config)}/index.html?local=1`;
}

/**
 * Inlined JS must not contain a literal `</script` sequence or the HTML
 * parser terminates the inline script element early. Escaping the open
 * angle bracket (`<\/script`) keeps the string value identical in JS while
 * staying inert for the HTML parser.
 */
function escape_inline_script(js: string): string {
  return js.replaceAll("</script", "<\\/script");
}

/**
 * Builds the self-contained HTML application shell served at
 * `ui://drawio/editor.html`:
 *
 * - `__EDITOR_URL__` is replaced with the framed draw.io editor URL
 *   derived from the server configuration (http/https + port).
 * - `__EDITOR_STANDALONE_URL__` is replaced with the embed-params-free
 *   editor URL the fallback panel links to (see shell.html's `#blocked`
 *   panel for when it is shown).
 * - `/*__APP_CLIENT__*` (the sole content of the first `<script>` element)
 *   is replaced with the escaped bundled ext-apps browser client, and
 *   `/*__EMBED_PROTOCOL__*` (the sole content of the second `<script>`
 *   element) with the bundled draw.io embed postMessage protocol helpers —
 *   each is spliced into exactly one script element so the document stays
 *   a single self-contained HTML file with no nested/duplicated script
 *   markers.
 */
function read_shell_html(config: ServerConfig): string {
  const here = __dirname;
  const shell = readFileSync(join(here, "app-shell", "shell.html"), "utf-8");
  const appClient = readFileSync(
    join(here, "app-shell", "app-client.js"),
    "utf-8",
  );
  if (!shell.includes("/*__APP_CLIENT__*/")) {
    throw new Error(
      `app shell is missing the app client marker: ${join(here, "app-shell", "shell.html")}`,
    );
  }
  const embedProtocol = readFileSync(
    join(here, "app-shell", "embed-protocol.iife.js"),
    "utf-8",
  );
  if (!shell.includes("/*__EMBED_PROTOCOL__*/")) {
    throw new Error(
      `app shell is missing the embed protocol marker: ${join(here, "app-shell", "shell.html")}`,
    );
  }
  // The replacement MUST go through a function: the bundled client is
  // minified JS that contains `$&`-style sequences, and string-replacement
  // patterns would re-inject the matched marker for every one of them.
  return shell
    .replace("/*__APP_CLIENT__*/", () => escape_inline_script(appClient))
    .replace("/*__EMBED_PROTOCOL__*/", () =>
      escape_inline_script(embedProtocol),
    )
    .replaceAll("__EDITOR_URL__", () => build_editor_url(config))
    .replaceAll("__EDITOR_STANDALONE_URL__", () =>
      build_editor_standalone_url(config),
    );
}

export function registerAppShellResource(
  server: McpServer,
  config: ServerConfig,
): void {
  const csp = { frameDomains: [editor_origin(config)] };
  // registerAppResource defaults the resource mimeType to
  // RESOURCE_MIME_TYPE ("text/html;profile=mcp-app") and spreads `config`
  // after it, so the `_meta.ui` CSP here lands on the resources/list entry.
  registerAppResource(
    server,
    "drawio-editor",
    SHOW_DIAGRAM_RESOURCE_URI,
    {
      _meta: { ui: { csp } },
    },
    async () => ({
      contents: [
        {
          uri: SHOW_DIAGRAM_RESOURCE_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: read_shell_html(config),
        },
      ],
      _meta: { ui: { csp } },
    }),
  );
}
