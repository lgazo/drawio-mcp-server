import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";

import type { ServerConfig } from "./config.js";
import { SHOW_DIAGRAM_RESOURCE_URI } from "./tools/show-diagram.js";

export function editor_origin(config: ServerConfig): string {
  const scheme = config.tlsEnabled ? "https" : "http";
  return `${scheme}://localhost:${config.httpPort}`;
}

function build_editor_url(config: ServerConfig): string {
  return `${editor_origin(config)}/index.html?embed=1&proto=json&local=1&offline=1`;
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
 * - `/*__APP_CLIENT__*` (the sole content of the first `<script>` element)
 *   is replaced with the escaped bundled ext-apps browser client, so the
 *   client is spliced into exactly one script element — the document stays
 *   a single self-contained HTML file with no nested/duplicated script
 *   markers.
 */
function read_shell_html(config: ServerConfig): string {
  const here = import.meta.dirname;
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
  // The replacement MUST go through a function: the bundled client is
  // minified JS that contains `$&`-style sequences, and string-replacement
  // patterns would re-inject the matched marker for every one of them.
  return shell
    .replace("/*__APP_CLIENT__*/", () => escape_inline_script(appClient))
    .replaceAll("__EDITOR_URL__", () => build_editor_url(config));
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
