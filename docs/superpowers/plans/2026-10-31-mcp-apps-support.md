# MCP Apps Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add MCP Apps extension support — a `show-diagram` tool whose `ui://drawio/editor.html` app renders an interactive draw.io editor in-chat, with live collaboration via the existing WebSocket bridge.

**Architecture:** The tool returns page XML and advertises `_meta.ui.resourceUri`; the resource serves a thin self-contained HTML shell that frames the locally served draw.io editor (`--editor` endpoint, embed mode). The injected `mcp-plugin.js` makes the framed editor a live document, so user edits and agent tool calls meet in the existing bus/FIFO queue — no new sync protocol.

**Tech Stack:** TypeScript ESM, `@modelcontextprotocol/sdk` 1.32.1, new dep `@modelcontextprotocol/ext-apps`, zod 4, esbuild (already a devDep), jest 30, biome + prettier.

**Spec:** `docs/superpowers/specs/2026-10-31-mcp-apps-design.md` — read it first; this plan argues from it.

## Global Constraints

- All bash work goes through `rtk` (verify `rtk --version` once per run).
- Commits: use the `lapai-cc-sdlc` commit skills (`commit-changes`) — author `<ai tool>-<model provider>-<model name>`, Co-Authored-By the human from `git config user.name`/`user.email`. Never mention "multica" in commit messages.
- Lint + format BEFORE every commit, and make them pass: `pnpm --filter drawio-mcp-server lint` (biome + tsc) and `pnpm --filter drawio-mcp-server format:check` (prettier, TS only). A commit without a passing lint+format run is invalid.
- Stdout purity: `console.log`/`process.stdout.write` are banned in `packages/drawio-mcp-server/src/**` outside the allowlist in `AGENTS.md` (Logging discipline). `src/stdio-transport-purity.test.ts` enforces it.
- Tests run on compiled output: `pnpm --filter drawio-mcp-server build && pnpm --filter drawio-mcp-server test` (jest on `build/`).
- Localization: any change to `TOOLS.md`/`README.md` requires hand-translated zh-CN snapshot updates; gate: `node scripts/translate.mjs --check` (from repo root, keyless).
- Work in the repo checkout created by `multica repo checkout git@github.com:lgazo/drawio-mcp-server.git` (branch `agent/shredder/898749e88a0d` already carries the spec commit `6d6bdc9`).
- Tool descriptions/schema descriptions/error strings stay English (agent-facing).

---

### Task 1: Add `@modelcontextprotocol/ext-apps` and the app-shell build step

**Files:**
- Modify: `packages/drawio-mcp-server/package.json` (deps + scripts)
- Create: `packages/drawio-mcp-server/scripts/build-app-shell.mjs`
- Create: `packages/drawio-mcp-server/src/app-shell/app-client-entry.ts`

**Interfaces:**
- Consumes: `App` class exported from `@modelcontextprotocol/ext-apps` (root export, browser-side postMessage client).
- Produces: `build/app-shell/app-client.js` (IIFE setting `globalThis.McpAppsApp`) and `build/app-shell/shell.html` (copied verbatim from `src/app-shell/shell.html`, created in Task 3). Produced by `pnpm --filter drawio-mcp-server build:app-shell`, also chained into `build`.

- [ ] **Step 1: Add the dependency**

```bash
pnpm --filter drawio-mcp-server add @modelcontextprotocol/ext-apps
```

- [ ] **Step 2: Verify the package's server API surface (signature check, not guessing)**

```bash
rtk grep -n "registerAppTool\|registerAppResource\|RESOURCE_MIME_TYPE" \
  node_modules/@modelcontextprotocol/ext-apps/dist/server/index.d.ts \
  packages/drawio-mcp-server/node_modules/@modelcontextprotocol/ext-apps/dist/server/index.d.ts 2>/dev/null | head -20
```

Expected: `registerAppTool(server, name, config, cb)` forwarding to `server.registerTool`; `registerAppResource(server, name, uri, config, readCallback)` forwarding to `server.registerResource`; `RESOURCE_MIME_TYPE = "text/html;profile=mcp-app"`. If the type layout differs (e.g. no `dist/`), find the entry with `rtk grep -n "main\|exports\|types" packages/drawio-mcp-server/node_modules/@modelcontextprotocol/ext-apps/package.json` and adapt the import paths in Tasks 2–3 to what actually exists. If the API differs materially from the above, STOP and report on the issue instead of improvising.

- [ ] **Step 3: Create the browser-client entry**

`packages/drawio-mcp-server/src/app-shell/app-client-entry.ts`:

```ts
// Bundled by scripts/build-app-shell.mjs into build/app-shell/app-client.js.
// Exposes the ext-apps browser client to the shell HTML (loaded inline there)
// so the served resource stays a single self-contained HTML file.
import { App } from "@modelcontextprotocol/ext-apps";

(globalThis as unknown as Record<string, unknown>).McpAppsApp = App;
```

- [ ] **Step 4: Create the build script**

`packages/drawio-mcp-server/scripts/build-app-shell.mjs`:

```js
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
```

- [ ] **Step 5: Wire package.json**

In `packages/drawio-mcp-server/package.json`:

- Add script: `"build:app-shell": "node scripts/build-app-shell.mjs"`
- Change `"build"` to chain it (app-shell step after `tsc`, before the plugin copy is fine; keep existing pieces):

```json
"build": "pnpm run vendor:compat && rimraf build && tsc && pnpm run build:app-shell && mkdir -p build/plugin && cp node_modules/drawio-mcp-plugin/dist/mcp-plugin.js build/plugin/mcp-plugin.js",
```

- [ ] **Step 6: Run and verify the build**

```bash
rtk pnpm --filter drawio-mcp-server build:app-shell
```

Note: `build:app-shell` copies `shell.html`, which does not exist yet (Task 3 creates it). For this task, create a placeholder `src/app-shell/shell.html` containing exactly:

```html
<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>Draw.io</title></head>
<body>placeholder — replaced in Task 3</body></html>
```

Then verify:

```bash
rtk pnpm --filter drawio-mcp-server build:app-shell
ls packages/drawio-mcp-server/build/app-shell/
rtk grep -c "McpAppsApp\|postMessage" packages/drawio-mcp-server/build/app-shell/app-client.js
```

Expected: `app-client.js` and `shell.html` listed; grep finds `McpAppsApp` (bundled ext-apps client) and `postMessage` inside `app-client.js`.

- [ ] **Step 7: Lint, format, commit**

```bash
rtk pnpm --filter drawio-mcp-server lint && rtk pnpm --filter drawio-mcp-server format:check
```

Fix any findings. Then commit via `lapai-cc-sdlc:commit-changes`:

```bash
rtk git add packages/drawio-mcp-server/package.json packages/drawio-mcp-server/pnpm-lock.yaml packages/drawio-mcp-server/scripts/build-app-shell.mjs packages/drawio-mcp-server/src/app-shell/
rtk git commit -m "build(app-shell): bundle ext-apps browser client for MCP Apps resource"
```

(Commit body: author/Co-Authored-By per convention. `pnpm-lock.yaml` at repo root may also change — include it if `rtk git status` shows it.)

---

### Task 2: `show-diagram` tool with `_meta.ui`, and `registerTool` support in the server wrappers

**Files:**
- Create: `packages/drawio-mcp-server/src/tools/show-diagram.ts`
- Modify: `packages/drawio-mcp-server/src/tools/index.ts` (register the new tool)
- Modify: `packages/drawio-mcp-server/src/index.ts:696-724` (`createDocumentScopedServer` proxy — handle `registerTool`)
- Modify: `packages/drawio-mcp-server/src/register-tool.ts` (`createServerWithSchemaStripping` — also hook `registerTool`)
- Create: `packages/drawio-mcp-server/src/mcp-apps.test.ts`

**Interfaces:**
- Consumes: `export_tool_handler(name, context, options)` from `src/tool.ts` (returns `ToolFn`); `target_page_field()` from `tools/shared.ts`; `registerAppTool` from `@modelcontextprotocol/ext-apps/server`; zod `z.object`.
- Produces:
  - `TOOL_show_diagram = "show-diagram"` and `SHOW_DIAGRAM_RESOURCE_URI = "ui://drawio/editor.html"` exported from `tools/show-diagram.ts` (Task 3 imports the URI constant).
  - `registerShowDiagramTool: ToolRegistrar` added to the registrar list.
  - Tool behavior: forces `format: "xml"`, `size: "diagram"` on the existing `export-diagram` plugin event — NO plugin-side changes, no new plugin event.

Background: `createDocumentScopedServer` (index.ts:696) is a Proxy that injects `target_document` into every `.tool(...)` registration except `list-documents`. `ext-apps`' `registerAppTool` calls `server.registerTool(...)` instead, so the proxy and the schema-stripping wrapper must learn `registerTool`. The response-level `$schema` stripping in `patchToolsListHandler` already covers tools registered either way, but the patch is only *installed* on the first `.tool()` call — so also hook `registerTool` in `createServerWithSchemaStripping` in case `show-diagram` is ever the first registration.

- [ ] **Step 1: Write the failing test**

`packages/drawio-mcp-server/src/mcp-apps.test.ts`:

```ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { createDrawioMcpApp, type DrawioMcpApp } from "./index.js";
import { defaultConfig } from "./config.js";
import { MemoryLogger } from "./real-environment/logger.js";

describe("MCP Apps: show-diagram tool", () => {
  let app: DrawioMcpApp;

  afterEach(async () => {
    if (app) await app.close();
  });

  async function connectClient(
    config = defaultConfig(),
  ): Promise<Client> {
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const server = app.createMcpServer();
    const client = new Client({ name: "apps-test", version: "1.0.0" });
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
    return client;
  }

  it("advertises show-diagram with ui _meta and target_document", async () => {
    app = createDrawioMcpApp({
      config: defaultConfig(),
      log: new MemoryLogger(),
    });
    const client = await connectClient();
    const { tools } = await client.listTools();

    const tool = tools.find((t) => t.name === "show-diagram");
    expect(tool).toBeDefined();
    expect(tool?.description).toContain("interactive");
    expect(
      (tool as unknown as { _meta?: Record<string, unknown> })._meta,
    ).toEqual({
      ui: { resourceUri: "ui://drawio/editor.html" },
    });
    const schema = tool?.inputSchema as {
      properties?: Record<string, unknown>;
      [key: string]: unknown;
    };
    expect(schema?.properties?.target_document).toBeDefined();
    expect(schema?.properties?.target_page).toBeDefined();
    expect(schema?.$schema).toBeUndefined();

    await client.close();
  });

  it("injects target_document into every tool except list-documents", async () => {
    app = createDrawioMcpApp({
      config: defaultConfig(),
      log: new MemoryLogger(),
    });
    const client = await connectClient();
    const { tools } = await client.listTools();

    for (const tool of tools) {
      const schema = tool.inputSchema as {
        properties?: Record<string, unknown>;
      };
      if (tool.name === "list-documents") {
        expect(schema?.properties?.target_document).toBeUndefined();
        continue;
      }
      expect(schema?.properties?.target_document).toBeDefined();
    }

    await client.close();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
rtk pnpm --filter drawio-mcp-server build && rtk pnpm --filter drawio-mcp-server test -- build/mcp-apps.test.js
```

Expected: FAIL — `show-diagram` not found in tools list (`tool` is `undefined`).

- [ ] **Step 3: Create the tool**

`packages/drawio-mcp-server/src/tools/show-diagram.ts`:

```ts
import { z } from "zod";

import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";

import { export_tool_handler } from "../tool.js";
import { target_page_field } from "./shared.js";
import { ToolRegistrar } from "./types.js";

export const TOOL_show_diagram = "show-diagram";
export const SHOW_DIAGRAM_RESOURCE_URI = "ui://drawio/editor.html";

export const registerShowDiagramTool: ToolRegistrar = (server, context) => {
  registerAppTool(
    server,
    TOOL_show_diagram,
    {
      title: "Show Diagram",
      description:
        "Returns the current diagram XML. On MCP Apps-capable hosts the diagram is shown as an interactive draw.io editor inside the conversation, enabling live editing and collaboration; on other clients the raw XML text is returned. Requires a connected document; with several connected documents pass target_document.",
      inputSchema: z.object({
        target_page: target_page_field(),
      }),
      _meta: { ui: { resourceUri: SHOW_DIAGRAM_RESOURCE_URI } },
    },
    async (args, extra) => {
      const handler = export_tool_handler("export-diagram", context, {
        queue: true,
      });
      const result = await handler(
        {
          ...args,
          format: "xml",
          size: "diagram",
          crop: true,
          transparent: false,
        },
        extra,
      );
      // The export handler appends a trailing "Exported xml ..." status
      // line; drop it so hosts/apps receive the XML as the final content.
      result.content = result.content.filter(
        (item) =>
          !(item.type === "text" && item.text.startsWith("Exported ")),
      );
      return result;
    },
  );
};
```

If the installed `ext-apps` types reject this `config` shape (e.g. `inputSchema` needs `ZodRawShape` instead of `z.object(...)`), switch to the shape form: `inputSchema: { target_page: target_page_field() }` — confirm in the `.d.ts` (Task 1, Step 2) which overload is non-deprecated and use that.

- [ ] **Step 4: Register it**

`packages/drawio-mcp-server/src/tools/index.ts` — add the import and append `registerShowDiagramTool` to the `registrars` array (after `registerSaveDocumentTool`).

- [ ] **Step 5: Extend `createDocumentScopedServer` to intercept `registerTool`**

`packages/drawio-mcp-server/src/index.ts` — replace the `createDocumentScopedServer` proxy body (current lines ~696-724) with:

```ts
  function createDocumentScopedServer(server: McpServer): McpServer {
    return new Proxy(server, {
      get(target, prop, receiver) {
        if (prop !== "tool" && prop !== "registerTool") {
          return Reflect.get(target, prop, receiver);
        }

        // High-level server.tool(name, description, params, handler)
        if (prop === "tool") {
          return (
            name: string,
            description: string,
            params: Record<string, unknown>,
            handler: unknown,
          ) => {
            const scopedParams =
              name === "list-documents"
                ? params
                : {
                    ...params,
                    target_document: target_document_field().optional(),
                  };

            return (
              target.tool as (
                ...args: [string, string, Record<string, unknown>, unknown]
              ) => unknown
            ).call(target, name, description, scopedParams, handler);
          };
        }

        // server.registerTool(name, config) — used by ext-apps'
        // registerAppTool for MCP Apps tools like show-diagram.
        return (name: string, config: Record<string, unknown>) => {
          const scopedConfig =
            name === "list-documents"
              ? config
              : {
                  ...config,
                  inputSchema: z.object({
                    ...z.object(
                      (
                        config.inputSchema as {
                          shape?: Record<string, unknown>;
                        } | undefined
                      )?.shape ?? {},
                    ).shape,
                    target_document: target_document_field().optional(),
                  }),
                };
          return (
            target.registerTool as (
              ...args: [string, Record<string, unknown>]
            ) => unknown
          ).call(target, name, scopedConfig);
        };
      },
    }) as McpServer;
  }
```

`z` is already imported in `index.ts`? Check the import block at the top of `index.ts`; if `zod` is not imported there, add `import { z } from "zod";` at the top with the other imports. The nested `z.object(...).shape` dance above is defensive but convoluted — simplify to:

```ts
        return (name: string, config: Record<string, unknown>) => {
          const rawShape =
            (
              config.inputSchema as
                | { shape?: Record<string, unknown> }
                | undefined
            )?.shape ?? {};
          const scopedConfig =
            name === "list-documents"
              ? config
              : {
                  ...config,
                  inputSchema: z.object({
                    ...rawShape,
                    target_document: target_document_field().optional(),
                  }),
                };
          return (
            target.registerTool as (
              ...args: [string, Record<string, unknown>]
            ) => unknown
          ).call(target, name, scopedConfig);
        };
```

- [ ] **Step 6: Hook `registerTool` in `createServerWithSchemaStripping`**

`packages/drawio-mcp-server/src/register-tool.ts` — inside `createServerWithSchemaStripping`, next to the existing `server.tool` override, add the same pattern for `registerTool` so the `tools/list` patch also installs when the first registration uses it:

```ts
  const originalRegisterTool = server.registerTool.bind(server);

  server.registerTool = function registerTool(
    ...args: Parameters<typeof originalRegisterTool>
  ) {
    const result = originalRegisterTool(...args);
    if (!patched) {
      patched = true;
      patchToolsListHandler(server);
    }
    return result;
  } as typeof originalRegisterTool;
```

Keep the existing `server.tool` override untouched.

- [ ] **Step 7: Build, run tests**

```bash
rtk pnpm --filter drawio-mcp-server build && rtk pnpm --filter drawio-mcp-server test -- build/mcp-apps.test.js
```

Expected: PASS (both tests).

- [ ] **Step 8: Full test + purity regression**

```bash
rtk pnpm --filter drawio-mcp-server build && rtk pnpm --filter drawio-mcp-server test
```

Expected: all green, including `build/tool-registry.test.js`, `build/multi-transport.test.js`, and `build/stdio-transport-purity.test.js`.

- [ ] **Step 9: Lint, format, commit**

```bash
rtk pnpm --filter drawio-mcp-server lint && rtk pnpm --filter drawio-mcp-server format:check
```

Commit via `lapai-cc-sdlc:commit-changes`:

```bash
rtk git add packages/drawio-mcp-server/src/
rtk git commit -m "feat(tools): add show-diagram tool with MCP Apps ui metadata"
```

Body should mention: `registerTool` interception in the document-scoped proxy and schema-stripping wrapper; `_meta.ui.resourceUri` on `show-diagram`; reuse of the `export-diagram` plugin event (no plugin changes).

---

### Task 3: `ui://drawio/editor.html` resource — shell app + CSP + registration

**Files:**
- Create: `packages/drawio-mcp-server/src/app-resource.ts`
- Create: `packages/drawio-mcp-server/src/app-shell/shell.html` (replaces the Task 1 placeholder)
- Modify: `packages/drawio-mcp-server/src/index.ts` (call `registerAppShellResource` in `createMcpServer`)
- Modify: `packages/drawio-mcp-server/src/mcp-apps.test.ts` (add resource tests)

**Interfaces:**
- Consumes: `SHOW_DIAGRAM_RESOURCE_URI` from `tools/show-diagram.ts`; `registerAppResource`, `RESOURCE_MIME_TYPE` from `@modelcontextprotocol/ext-apps/server`; `ServerConfig` from `config.ts` (fields `httpPort: number`, `tlsEnabled: boolean`); build artifacts `build/app-shell/shell.html` and `build/app-shell/app-client.js` (Task 1).
- Produces: `editor_origin(config: ServerConfig): string` and `registerAppShellResource(server: McpServer, config: ServerConfig): void` exported from `src/app-resource.ts`. Resource read returns a single self-contained HTML document (shell with the bundled app client spliced in, editor URL substituted).

- [ ] **Step 1: Write the failing tests**

Extend `packages/drawio-mcp-server/src/mcp-apps.test.ts`. No new imports are needed — `defaultConfig`, `createDrawioMcpApp`, `MemoryLogger`, `DrawioMcpApp`, `Client`, and `InMemoryTransport` are already in the top import block from Task 2. Append:

```ts
describe("MCP Apps: editor resource", () => {
  it("serves the shell with the MCP Apps mime type and CSP", async () => {
    const app = createDrawioMcpApp({
      config: defaultConfig(),
      log: new MemoryLogger(),
    });
    const client = await connectClientForApp(app);

    const result = await client.readResource({
      uri: "ui://drawio/editor.html",
    });
    const contents = result.contents as Array<{
      mimeType?: string;
      text?: string;
      uri: string;
    }>;
    expect(contents[0]?.mimeType).toBe("text/html;profile=mcp-app");
    expect(contents[0]?.text).toContain("<iframe");
    expect(contents[0]?.text).toContain("McpAppsApp");
    expect(contents[0]?.text).toContain("http://localhost:3000/index.html");
    const meta = (result as unknown as {
      _meta?: { ui?: { csp?: { frameDomains?: string[] } } };
    })._meta;
    expect(meta?.ui?.csp?.frameDomains).toContain("http://localhost:3000");

    await client.close();
    await app.close();
  });

  it("uses https origin when TLS is enabled", async () => {
    const config = { ...defaultConfig(), tlsEnabled: true, httpPort: 3443 };
    const app = createDrawioMcpApp({ config, log: new MemoryLogger() });
    const client = await connectClientForApp(app);

    const result = await client.readResource({
      uri: "ui://drawio/editor.html",
    });
    const meta = (result as unknown as {
      _meta?: { ui?: { csp?: { frameDomains?: string[] } } };
    })._meta;
    expect(meta?.ui?.csp?.frameDomains).toContain("https://localhost:3443");
    const contents = result.contents as Array<{ text?: string }>;
    expect(contents[0]?.text).toContain("https://localhost:3443/index.html");

    await client.close();
    await app.close();
  });
});
```

Refactor the Task 2 `connectClient` helper into this shared form (both suites use it; keep each suite's `app` lifecycle as-is):

```ts
async function connectClientForApp(
  app: DrawioMcpApp,
  config = defaultConfigFn(),
): Promise<Client> {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const server = app.createMcpServer();
  const client = new Client({ name: "apps-test", version: "1.0.0" });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return client;
}
```

(Adjust the Task 2 tests to use this helper; keep their `app` lifecycle as-is.)

- [ ] **Step 2: Run tests to verify they fail**

```bash
rtk pnpm --filter drawio-mcp-server build && rtk pnpm --filter drawio-mcp-server test -- build/mcp-apps.test.js
```

Expected: FAIL — `./app-resource.js` does not exist (import error).

- [ ] **Step 3: Create the shell HTML**

`packages/drawio-mcp-server/src/app-shell/shell.html` (replaces the Task 1 placeholder; the build copies it verbatim; `__EDITOR_URL__` and `/*__APP_CLIENT__*/` are substituted by the resource handler):

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Draw.io</title>
<style>
  html, body { margin: 0; height: 100%; background: #fff; }
  #editor { width: 100%; height: 100%; border: 0; display: block; }
  #fallback {
    display: none;
    position: absolute; inset: 0;
    padding: 2em; font: 14px/1.5 system-ui, sans-serif; color: #333;
  }
  #fallback.visible { display: block; }
  code { background: #f4f4f4; padding: 2px 4px; border-radius: 3px; }
</style>
</head>
<body>
<iframe id="editor" src="__EDITOR_URL__"></iframe>
<div id="fallback">
  <p><strong>Draw.io editor unreachable.</strong></p>
  <p>Could not load <code>__EDITOR_URL__</code>.</p>
  <p>Start the server with <code>--editor</code> and make sure this MCP host
  can reach the machine running drawio-mcp-server (localhost). If you are on
  a remote/browser-only host, the local editor cannot be displayed.</p>
</div>
<script>/*__APP_CLIENT__*/</script>
<script>
(function () {
  "use strict";
  var editor = document.getElementById("editor");
  var fallback = document.getElementById("fallback");
  var AppCtor = globalThis.McpAppsApp;
  var lastXml = null;
  var editorReady = false;
  var initTimer = setTimeout(showFallback, 8000);

  function showFallback() {
    if (!editorReady) {
      fallback.classList.add("visible");
      editor.style.display = "none";
    }
  }

  if (AppCtor) {
    var app = new AppCtor({ name: "drawio-mcp-server", version: "1" });
    app.connect();
    app.ontoolresult = function (result) {
      var texts = (result && result.content) || [];
      for (var i = 0; i < texts.length; i++) {
        var item = texts[i];
        if (item.type === "text" && item.text &&
            (item.text.indexOf("<mxfile") !== -1 ||
             item.text.indexOf("<mxGraphModel") !== -1)) {
          lastXml = item.text;
          sendLoad();
          return;
        }
      }
    };
  }

  // draw.io embed mode (proto=json): the editor posts lifecycle events to
  // its parent window (this shell); we reply with load/configure actions.
  window.addEventListener("message", function (event) {
    var msg = event.data;
    if (!msg || typeof msg.event !== "string") return;
    if (msg.event === "init") {
      editorReady = true;
      clearTimeout(initTimer);
      sendLoad();
    } else if (msg.event === "configure") {
      editor.contentWindow.postMessage(
        { action: "configure", config: {} },
        "*"
      );
    } else if (msg.event === "save" || msg.event === "export") {
      // Live sync runs through mcp-plugin.js inside the framed editor
      // (WebSocket bridge); saves need no handling in the shell.
    }
  });

  function sendLoad() {
    if (!editorReady || lastXml === null || !editor.contentWindow) return;
    editor.contentWindow.postMessage(
      { action: "load", xml: lastXml, autosave: 1 },
      "*"
    );
  }
})();
</script>
</body>
</html>
```

- [ ] **Step 4: Create the resource module**

`packages/drawio-mcp-server/src/app-resource.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";

import type { ServerConfig } from "./config.js";
import { SHOW_DIAGRAM_RESOURCE_URI } from "./tools/show-diagram.js";

export function editor_origin(config: ServerConfig): string {
  const scheme = config.tlsEnabled ? "https" : "http";
  return `${scheme}://localhost:${config.httpPort}`;
}

function build_editor_url(config: ServerConfig): string {
  return `${editor_origin(config)}/index.html?embed=1&proto=json&local=1&offline=1`;
}

function read_shell_html(config: ServerConfig): string {
  const here = import.meta.dirname;
  const shell = readFileSync(
    join(here, "app-shell", "shell.html"),
    "utf-8",
  );
  const appClient = readFileSync(
    join(here, "app-shell", "app-client.js"),
    "utf-8",
  );
  return shell
    .replaceAll("__EDITOR_URL__", build_editor_url(config))
    .replace("/*__APP_CLIENT__*/", `<script>${appClient}</script>`);
}

export function registerAppShellResource(
  server: McpServer,
  config: ServerConfig,
): void {
  const csp = { frameDomains: [editor_origin(config)] };
  registerAppResource(
    server,
    "drawio-editor",
    SHOW_DIAGRAM_RESOURCE_URI,
    {
      mimeType: RESOURCE_MIME_TYPE,
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
```

Notes:
- `read_shell_html` reads from `build/app-shell/` because jest executes compiled output in `build/` (`import.meta.dirname` is `build/` at test and runtime). Verify after building: `ls packages/drawio-mcp-server/build/app-shell/`.
- If the installed `ext-apps` `registerAppResource` rejects `_meta` in config or in the read result, check `McpUiAppResourceConfig` / `McpUiReadResourceResult` in the `.d.ts` (Task 1, Step 2) and put the `_meta` wherever the type declares it — the content-item value takes precedence per the ext-apps docs.

- [ ] **Step 5: Register the resource in `createMcpServer`**

`packages/drawio-mcp-server/src/index.ts` — in `createMcpServer()` (line ~732), after the `registerTools(...)` call, add:

```ts
    registerAppShellResource(server, config);
```

and add to the import block at the top of `index.ts`:

```ts
import { registerAppShellResource } from "./app-resource.js";
```

The doc-scoped proxy passes `registerResource` through untouched (only `tool`/`registerTool` are intercepted), so passing the raw `server` here is correct.

- [ ] **Step 6: Build, run tests**

```bash
rtk pnpm --filter drawio-mcp-server build && rtk pnpm --filter drawio-mcp-server test -- build/mcp-apps.test.js
```

Expected: PASS (all four tests in `mcp-apps.test.js`).

- [ ] **Step 7: Full test suite + purity**

```bash
rtk pnpm --filter drawio-mcp-server test
```

Expected: all green. `index.capabilities.test.js` must still pass (resources capability was already declared).

- [ ] **Step 8: Lint, format, commit**

```bash
rtk pnpm --filter drawio-mcp-server lint && rtk pnpm --filter drawio-mcp-server format:check
```

Commit via `lapai-cc-sdlc:commit-changes`:

```bash
rtk git add packages/drawio-mcp-server/src/ packages/drawio-mcp-server/build/app-shell 2>/dev/null || rtk git add packages/drawio-mcp-server/src/
rtk git commit -m "feat(apps): serve ui://drawio/editor.html shell resource with local editor framing"
```

(`build/` is gitignored — the `||` fallback covers that; stage only `src/`.)

---

### Task 4: Documentation (English + zh-CN)

**Files:**
- Modify: `TOOLS.md` (+ `TOOLS.zh-CN.md`)
- Modify: `README.md` (+ `README.zh-CN.md`)

**Interfaces:**
- Consumes: final behavior of Tasks 2–3.
- Produces: documented tool + feature; `node scripts/translate.mjs --check` green.

- [ ] **Step 1: Add `show-diagram` to `TOOLS.md`**

Read `TOOLS.md` first and follow its existing per-tool section format exactly (headings, tables, examples). Content to convey:

- Name: `show-diagram`
- Purpose: returns the current diagram XML; on MCP Apps-capable hosts (Claude Desktop, QuixiDesk, MCPJam, VS Code Copilot) renders an interactive draw.io editor in-chat for live editing and collaboration — user edits and agent tool calls act on the same live document via the server's WebSocket bridge.
- Args: `target_page` (optional, `{ index }` or `{ id }`), `target_document` (optional; required when multiple documents are connected, `{ id }` from `list-documents`).
- Requirement: the server must run with `--editor` so the framed editor can be served (the app frames `http://localhost:<http-port>`).
- Behavior without an MCP Apps host: plain XML text.

- [ ] **Step 2: Translate into `TOOLS.zh-CN.md`**

Hand-translate the added section per `AGENTS.md` Localization rules: natural, technically correct zh-CN; product/technology names (Draw.io, MCP, MCP Apps, WebSocket, Claude Desktop, QuixiDesk, MCPJam) untranslated; code blocks, config snippets, URLs, filenames byte-identical. Then:

```bash
node scripts/translate.mjs crosslink TOOLS.zh-CN.md
```

- [ ] **Step 3: Add an MCP Apps section to `README.md`**

Read `README.md` first; place a short "MCP Apps support" section following existing section style. Content: what it does (interactive in-chat draw.io editor with live collaboration), how to enable (`--editor` flag; no other config), which hosts support it, limitation note (the MCP host must be able to reach `http://localhost:<http-port>` — native hosts like Claude Desktop work; remote browser sessions may not), and the tool name `show-diagram`.

- [ ] **Step 4: Translate into `README.zh-CN.md`**

Same discipline as Step 2, then:

```bash
node scripts/translate.mjs crosslink README.zh-CN.md
```

- [ ] **Step 5: Run the translation gate**

```bash
node scripts/translate.mjs --check
```

Expected: green (no parity drift, banners present).

- [ ] **Step 6: Lint, format, commit**

```bash
rtk pnpm --filter drawio-mcp-server lint && rtk pnpm --filter drawio-mcp-server format:check
```

Commit via `lapai-cc-sdlc:commit-changes`:

```bash
rtk git add TOOLS.md TOOLS.zh-CN.md README.md README.zh-CN.md
rtk git commit -m "docs: document show-diagram MCP Apps support"
```

---

### Task 5: Manual verification matrix (basic-host)

No new code. Verifies the feature end-to-end before reporting done.

- [ ] **Step 1: Start the server with editor + HTTP**

```bash
cd packages/drawio-mcp-server
rtk pnpm run build
DRAWIO_MCP_ARGS="--editor --transport http --http-port 3001 --extension-port 3334" \
  node build/index.js &
```

Watch output: HTTP server on 3001, editor at `http://localhost:3001/`, WS bridge on 3334. (If env-var config isn't supported for these flags in this version, start the binary directly: `node build/index.js --editor --transport http --http-port 3001 --extension-port 3334`.)

- [ ] **Step 2: Run the ext-apps basic-host**

```bash
git clone https://github.com/modelcontextprotocol/ext-apps.git /tmp/ext-apps
cd /tmp/ext-apps/examples/basic-host
npm install
SERVERS='["http://localhost:3001/mcp"]' npm start
```

Open `http://localhost:8080`, call `show-diagram` (optionally after opening a draw.io tab with the browser extension connected, or the framed editor itself creates a document). Expected: the app renders, the framed draw.io editor loads, XML seeds.

- [ ] **Step 3: Live collaboration check**

With the app open: call `add-rectangle` (via basic-host tool UI or a second MCP client pointing at the same server) against the framed document's id (from `list-documents`). Expected: rectangle appears in the framed editor without refresh. Edit in the framed editor; call `list-paged-model` — the edit is visible to the agent.

- [ ] **Step 4: Report**

Post results on the issue: what passed, exact failures with reproduction, screenshots as attachments if the runtime supports them. QuixiDesk/MCPJam verification stays with the workspace owner (needs their accounts) — say so in the report.

---

## Self-Review Notes (for the executor)

- Spec coverage: tool `_meta` + resource + CSP from config + shell degradation + tests + docs + manual matrix — Tasks 1–5 cover every spec section. Deferred items (C2 flag, viewer-only mode, app-only tools) are non-goals; do not implement them.
- `export_tool_handler` is invoked with event name `"export-diagram"` on purpose: it reuses the plugin-side export tool (no plugin changes). The trailing "Exported xml ..." line is filtered in the shell's tool handler.
- If `ext-apps` API differs from what Tasks 2–3 assume, verify against the installed `.d.ts` (Task 1, Step 2) and adapt imports/parameters; if it differs materially, stop and report on the issue.
- The framed editor is a NEW live document (fresh tab equivalent), seeded with the XML from `show-diagram`. It does not attach to an already-connected document — that matches the approved spec.