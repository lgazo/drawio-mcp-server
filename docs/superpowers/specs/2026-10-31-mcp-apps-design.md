# MCP Apps Support — Design

**Date:** 2026-10-31
**Issue:** DRAW-10 — "support for MCP Apps"
**Status:** Approved (approach C1) — awaiting implementation plan

## Overview

Add MCP Apps extension support to `drawio-mcp-server` so that MCP Apps-aware hosts
(Claude Desktop, QuixiDesk, MCPJam, VS Code Copilot, …) render an interactive
draw.io editor inside the conversation. The user chose live editing and
collaboration as the goal (option C), realized via approach **C1: a thin MCP App
that frames the locally served draw.io editor**. The framed editor is already a
live document through the existing WebSocket bridge and `mcp-plugin.js`, so user
edits and agent tool calls meet in the same live document with no new sync
protocol.

Hosted-editor fallback (C2, `embed.diagrams.net`) is explicitly **out of scope
for this stage**; the design keeps a door open for it later.

## Goals

1. A host that supports MCP Apps renders an interactive draw.io editor in-chat
   when the agent calls the new `show-diagram` tool.
2. Bidirectional live collaboration: user edits in the app; agent edits via
   existing MCP tools; both act on the same live document and see each other's
   changes.
3. No changes to existing tools, transports, or the WebSocket bridge.

## Non-Goals (this stage)

- C2 hosted `embed.diagrams.net` fallback (`--app-editor remote|local` flag).
- Server→UI push notifications (spec has none; app refreshes on interaction).
- Editing documents the server cannot reach (a live document must exist).
- Any new sync protocol — the WS bridge and per-document FIFO queue already
  provide serialization and liveness.

## Background: MCP Apps mechanics used

Per the MCP Apps specification (2026-01-26 draft, `ext-apps` repo):

- MVP content type is embedded HTML only: `text/html;profile=mcp-app`
  (raw HTML). External-URL apps are deferred — the app cannot *be* a URL, but
  it may **frame** and load from other origins if declared in the resource
  `_meta.ui.csp` (`frameDomains`, `resourceDomains`, `connectDomains`,
  `baseUriDomains`).
- A tool advertises its UI via `_meta.ui.resourceUri: "ui://…"` in the tool
  definition (`_meta["ui/resourceUri"]` flat key is deprecated). Optional
  `_meta.ui.visibility` defaults to `["model", "app"]`.
- The host fetches the resource via `resources/read` over the same connection
  (works over stdio), renders it in a sandboxed iframe, and pushes the tool
  result to the app (`ontoolresult`).
- The app uses the `App` class from `@modelcontextprotocol/ext-apps` to talk
  to the host over postMessage; it may call server tools via
  `app.callServerTool`.

## Architecture (C1)

```
MCP host (Claude Desktop / QuixiDesk / MCPJam)
└── sandboxed iframe: ui://drawio/editor.html   (thin shell app)
    ├── App (ext-apps): connect(), ontoolresult, callServerTool
    └── inner iframe: http(s)://localhost:<httpPort>/?embed=1&proto=json&local=1&offline=1
        └── draw.io webapp served by --editor endpoint
            └── mcp-plugin.js injected → WS bridge → server document model
```

The framed draw.io editor is a first-class live document, identical to an
editor tab opened in a browser:

- User edits flow to the server through the plugin/WS bridge (existing path).
- Agent tool calls (`add-rectangle`, `edit-cell`, …) target the framed document
  via `target_document` and are serialized by the existing per-document FIFO
  queue; the framed editor updates live (existing path).
- The thin shell is presentation + seeding only. It does not proxy edits.

## Components

### 1. `show-diagram` tool (`src/tools/show-diagram.ts`)

- Registered alongside existing tools via a new `ToolRegistrar`.
- Args: `target_page` (optional page selector, existing `target_page_field`),
  `target_document` (existing selector semantics — the tool requires a live
  document; auto-target when exactly one is connected).
- Behavior: returns the current page XML as a text content block (same export
  path as `export-diagram` with `format: "xml"`, but read-only, no file
  output).
- Tool definition carries `_meta: { ui: { resourceUri: "ui://drawio/editor.html" } }`.
- Registration must go through a path that preserves `_meta` in
  `tools/list`. The existing `createServerWithSchemaStripping` wrapper
  (`register-tool.ts`) shallow-copies tool objects and strips only
  `inputSchema`/`outputSchema`, so `_meta` passes through; a unit test pins
  this.

### 2. `ui://drawio/editor.html` resource

- Registered with `registerAppResource` from `@modelcontextprotocol/ext-apps`
  (or equivalent `server.resource()` call with the MCP Apps mime type
  `text/html;profile=mcp-app`).
- Serves the shell HTML (static string in the server package, no bundler).
- Resource `_meta.ui.csp` declares:
  - `frameDomains`: `[editorOrigin]` — `http://localhost:<httpPort>` (or
    `https://…` when `--tls`). The shell frames the editor; the editor's own
    HTTP/WS connections originate from the inner iframe and are governed by
    the host's handling of the editor origin, so only the framing origin
    needs declaring.
- Origins are computed from `ServerConfig` at registration time (httpPort,
  TLS, host), so the CSP is never a stale constant.

### 3. Shell app HTML (inline in the resource handler)

Vanilla HTML/JS, ~100 lines:

- `<iframe>` filling the viewport, `src` = editor URL with embed params
  (`embed=1&proto=json&local=1&offline=1` — same embed mode draw.io documents
  for third-party integration; JSON postMessage protocol between shell and
  editor).
- `app.connect()` from the `App` class; `app.ontoolresult` takes the XML
  from the `show-diagram` result and seeds the editor via the embed protocol
  `load`/`LocalFile` message once the editor signals readiness.
- Status strip (document connected / doc id) refreshed via
  `app.callServerTool("list-documents")` on interaction (spec has no push).
- Graceful degradation: if the inner editor fails to load (localhost
  unreachable — e.g. remote browser host), the shell shows a clear message
  instead of a blank frame.

### 4. Configuration

- No new CLI flags required for C1. The resource reuses `--editor` endpoint
  config (httpPort, TLS, host) and the default extension port.
- New dependency: `@modelcontextprotocol/ext-apps` (runtime). The server
  imports the `server` helpers; the shell HTML embeds the browser `App`
  client.
  - The resource must stay a single self-contained HTML file. The `App`
    browser client is therefore inlined at build time: a small esbuild step
    (esbuild is already a devDep) bundles `@modelcontextprotocol/ext-apps`
    browser entry into an IIFE script that the resource handler reads from
    disk and splices into the shell HTML. No runtime CDN dependency.

## Data flow

1. Agent calls `show-diagram` (with `target_document` if several docs live).
2. Server returns page XML; tool's `_meta.ui.resourceUri` makes the host fetch
   `ui://drawio/editor.html` and render the shell, then pushes the tool result
   to it.
3. Shell seeds the framed editor with the XML (embed `load`).
4. Plugin connects the framed editor to the WS bridge → new live document.
5. Collaboration: user edits in the editor; agent calls tools against the
   document; existing bridge/queue/serialization handle everything. Both sides
   see live updates.

## Error handling

- `show-diagram` with no connected document: existing auto-target error path
  (same as other live tools — instructs the agent to open/list documents).
- Host cannot fetch the resource: standard MCP resource error; tool result
  text still reaches the model, so the agent degrades gracefully to XML text.
- Shell cannot reach localhost editor: visible error message in the shell
  (see above), no silent blank iframe.
- All server-side diagnostics go through `AppLogger` per repo logging
  discipline (AGENTS.md); no `console.*` outside the allowlist; stdout stays
  pure JSON-RPC on stdio transport.

## Testing

- **Unit (jest):**
  - `show-diagram` tool: `_meta.ui.resourceUri` present in `tools/list`
    response, survives the schema-stripping wrapper.
  - Resource registration: `resources/read` on `ui://drawio/editor.html`
    returns the shell HTML with the MCP Apps mime type and correct
    `_meta.ui.csp` origins (http and TLS variants).
  - CSP origin computation from config (port/host/TLS).
- **Manual matrix:** ext-apps `basic-host` (official local harness) →
  QuixiDesk → MCPJam; final check Claude Desktop.
- **Collaboration scenario:** with app open, agent performs `add-rectangle`;
  expect live update in the framed editor without refresh.

## Documentation

- `TOOLS.md` gains `show-diagram` (+ zh-CN snapshot, translated by the agent
  per AGENTS.md localization rules; run `node scripts/translate.mjs --check`).
- `README.md` section on MCP Apps support (+ zh-CN snapshot).
- CI gates: stdout purity test and locale parity must stay green.

## Future (not this stage)

- C2 `--app-editor remote|local` flag hosting `embed.diagrams.net` for hosts
  that cannot reach localhost.
- `_meta.ui.visibility` app-only helper tools if the shell needs privileged
  calls.
- Read-only lightweight viewer (`viewer.min.js`) for contexts where the full
  editor is overkill.