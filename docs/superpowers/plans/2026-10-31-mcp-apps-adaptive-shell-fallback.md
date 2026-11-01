# MCP Apps Follow-up 2: Adaptive Shell — Claude Fallback — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the MCP host blocks the framed editor (Claude and other `frameDomains`-ignoring hosts), the draw.io app degrades to a useful **read-only preview + open-in-tab** mode instead of a dead frame. Hosts that honor `frameDomains` keep today's full live-editing experience unchanged.

**Why (settled on the issue, DRAW-10):** Claude's app sandbox enforces `frame-src 'self' blob: data:` and ignores `_meta.ui.csp.frameDomains` — independently measured on Claude Desktop, and Anthropic closed the nested-iframe feature request as "not planned". A resource's CSP declaration can only narrow the host ceiling, so the C1 framed-editor architecture cannot render on Claude, period. Claude *does* honor `serverTools` (the app→host→server tool-call bridge), which is the fallback's data path.

**Architecture:** single task, two edits. (a) `app-resource.ts` gains a standalone editor URL placeholder next to the existing `__EDITOR_URL__`. (b) `shell.html` detects the blocked frame (CSP violation event, with the existing 8s timeout as backstop) and renders a preview panel: explanation, a link that opens the editor in a normal browser tab (where the plugin + MCP tools keep working), and — when a document is connected — a rendered PNG of the current diagram fetched via `app.callServerTool("export-diagram")`. No `connectDomains` needed: `callServerTool` rides the postMessage bridge, not the network.

**Tech Stack:** unchanged — TypeScript ESM, esbuild-bundled shell scripts, jest 30 on `build/`, biome + prettier, Playwright for E2E.

**Spec:** `docs/superpowers/specs/2026-10-31-mcp-apps-design.md` (approved) — this plan adds the host-degradation behavior agreed on DRAW-10 ("yes, dispatch").

## Global Constraints

Same as the previous plans — rtk for all bash, lint+format before every commit via `lapai-cc-sdlc`, stdout purity, tests on `build/`, zh-CN localization for docs changes. Start from this branch; it contains everything shipped so far (MCP Apps C1, cold start, live-doc registration).

**Do not touch the live path:** the editor-iframe flow, embed protocol helpers, and cold-start behavior must remain byte-equivalent in behavior. All E1–E6 assertions from `verify.mjs` must still pass at the end.

---

### Task 1: Adaptive fallback — blocked-frame detection + preview mode

**Files:**
- Modify: `packages/drawio-mcp-server/src/app-resource.ts` (new `__EDITOR_STANDALONE_URL__` placeholder + helper)
- Modify: `packages/drawio-mcp-server/src/app-shell/shell.html` (detection + preview panel)
- Modify: `packages/drawio-mcp-server/src/mcp-apps.test.ts` (or the nearest existing shell/app-resource test file — add coverage there)
- Modify: `TOOLS.md` + `TOOLS.zh-CN.md` (host-support matrix paragraph)
- New E2E script: reuse the pattern of `verify.mjs` (attached to Shredder's proof comment on DRAW-10) — call it `verify-fallback.mjs` alongside the repo's existing verification scripts if there is a conventional home, otherwise hand it back as an attachment on the issue.

**Interfaces:**
- Consumes: `app.callServerTool` from the bundled ext-apps app client (already in the shell via `McpAppsApp`); the server's `export-diagram` tool (PNG via the existing plugin round-trip; requires a connected document — errors when none, which the panel must handle).
- Produces: shell that works in three modes — live (frame loads; unchanged), blocked (preview panel), unreachable (server down; existing fallback text, merged into the new panel wording).

**Design decisions already made (don't re-litigate):**
- Detection: listen for `securitypolicyviolation` on the shell document with `effectiveDirective === "frame-src"` (fires on the document that attempted the load — the shell — so this is decisive, unlike a timeout). Keep the existing 8s `initTimer` as a backstop that now also routes to the preview panel instead of the old fallback div. CSP-blocked and server-down both land in the same panel; the wording covers both ("the editor could not be embedded").
- Preview data path: `app.callServerTool({ name: "export-diagram", arguments: { format: "png", target_page: { index: 0 } } })`. No network fetch, no `connectDomains` declaration needed. If the call errors (e.g. no connected document on a cold start), show the panel with the link and a short hint instead of a preview image.
- The standalone link must NOT carry the embed params — it opens the normal editor tab (`index.html?local=1`), where the plugin connects and the pre-MCP-Apps workflow (extension/plugin + tools) keeps working.
- Tool-result XML seeding (`ontoolresult` → `sendLoad`) stays live-path-only; in blocked mode the tool result is irrelevant to the panel.

- [ ] **Step 1: Failing tests (TDD)**

  In `mcp-apps.test.ts` (or the closest existing suite covering `app-resource.ts`):

  - `app-resource` exposes a `build_editor_urls(config)` (or equivalent) returning both the embed URL and the standalone URL; standalone contains `index.html?local=1` and does NOT contain `embed=1` or `proto=json`; embed URL unchanged from today.
  - The rendered shell HTML (via the resource read handler) contains the `__EDITOR_STANDALONE_URL__` placeholder replaced with the standalone URL (assert on the produced HTML text: no raw placeholder remains, standalone URL present).
  - Shell source invariants (string assertions on `shell.html`, cheap but they pin the contract): contains a `securitypolicyviolation` listener referencing `frame-src`; the old fallback copy is gone/replaced by the panel; `app.callServerTool` referenced with `"export-diagram"`.

- [ ] **Step 2: Run, confirm red**

  ```bash
  rtk pnpm --filter drawio-mcp-server build && rtk pnpm --filter drawio-mcp-server test -- build/mcp-apps.test.js
  ```

- [ ] **Step 3: Implement**

  `app-resource.ts`:
  ```ts
  export function build_editor_url(config: ServerConfig): string {
    return `${editor_origin(config)}/index.html?embed=1&proto=json&local=1`;
  }
  export function build_editor_standalone_url(config: ServerConfig): string {
    // No embed params: opens the normal editor tab, plugin connects as before.
    return `${editor_origin(config)}/index.html?local=1`;
  }
  ```
  `read_shell_html` gains a second `replaceAll("__EDITOR_STANDALONE_URL__", ...)`. (Adapt to the existing structure — the contract is: standalone URL injected, embed URL unchanged.)

  `shell.html`:
  - Replace the `#fallback` div with a `#blocked` panel (keep a class-visible pattern). Copy, in the spirit of:
    ```html
    <div id="blocked">
      <p><strong>The draw.io editor cannot be embedded in this host.</strong></p>
      <p>Some hosts (e.g. Claude) do not allow apps to embed local content.</p>
      <p><a href="__EDITOR_STANDALONE_URL__">Open the editor in a browser tab</a>
      — diagram editing and the MCP tools keep working there.</p>
      <p id="preview-hint">Trying to load a preview of the current diagram…</p>
      <img id="preview" alt="Diagram preview" style="display:none;max-width:100%" />
    </div>
    ```
  - Script: `securitypolicyviolation` listener (`event.effectiveDirective === "frame-src"` → `showBlocked()`); `initTimer` timeout → `showBlocked()` (same panel — covers the server-down case; adjust the first paragraph wording so it reads correctly for both).
  - `showBlocked()`: guard on `!editorReady`; hide the editor iframe; show the panel; then `app.callServerTool({ name: "export-diagram", arguments: { format: "png", target_page: { index: 0 } } })` — on success find the first `image` content block in the result and set `<img>` src to `data:image/png;base64,<data>`; on failure set the hint to "No connected diagram to preview — open the editor and start drawing; the agent can still create and edit diagrams through the tools."
  - `openLink` from a sandboxed app may be blocked by the host; that is fine — also print the URL as selectable text inside `<code>` so it is copyable even if the anchor is inert.

- [ ] **Step 4: Build, full test run**

  ```bash
  rtk pnpm --filter drawio-mcp-server build && rtk pnpm --filter drawio-mcp-server test
  ```

  All green — including the pre-existing suites (nothing regressed).

- [ ] **Step 5: Headless E2E for BOTH modes**

  Adapt `verify.mjs`:
  - **Live mode regression:** run it as-is (E1–E6 still pass — proves the fallback did not disturb the honored-`frameDomains` path).
  - **Blocked mode (`verify-fallback.mjs`):** read the shell HTML via the MCP client (`resources/read ui://drawio/editor.html`), serve it from a throwaway local static server that sets a `Content-Security-Policy: frame-src 'none'` response header, open it in Playwright, and assert: the `#blocked` panel becomes visible, the editor iframe is hidden, the standalone link text is present, and (with a connected editor tab open in the test, as in E2) the preview `<img>` gets a non-empty `data:image/png` src. Second pass with zero connected documents: assert the hint text, no crash.
  - Post both artifacts (results JSON + screenshots) as attachments on the issue.

- [ ] **Step 6: Docs**

  `TOOLS.md`: in the `show-diagram` section, add a short **Host support** paragraph: live embedded editing requires a host that honors `_meta.ui.csp.frameDomains` (MCPJam default, ChatGPT, Cursor, Copilot, VS Code, Gemini, and the official ext-apps basic-host). Hosts that don't (Claude Desktop / claude.ai, Slack, Notion, …) get a read-only preview of the current diagram plus a link to open the editor in a normal tab; the tools are unaffected. Translate into `TOOLS.zh-CN.md` by hand per AGENTS.md; run `node scripts/translate.mjs crosslink TOOLS.zh-CN.md` and `node scripts/translate.mjs --check`.

- [ ] **Step 7: Lint, format, commit**

  ```bash
  rtk pnpm --filter drawio-mcp-server lint && rtk pnpm --filter drawio-mcp-server format:check
  ```

  Commit via `lapai-cc-sdlc:commit-changes`:
  ```bash
  rtk git add packages/drawio-mcp-server/src/ TOOLS.md TOOLS.zh-CN.md
  rtk git commit -m "feat(apps): adaptive shell — read-only preview fallback on frameDomains-blocking hosts"
  ```

- [ ] **Step 8: Report on the issue**

  State what landed, attach the E2E artifacts, and note explicitly: real-Claude behavior is owner-side to confirm (MCPJam's simulation matches the independently measured Claude Desktop policy, but the final word is a real claude.ai / Claude Desktop session).

---

## Self-Review Notes (for the executor)

- `editorReady` must gate `showBlocked()` — a late CSP violation after the editor is live must not tear down a working frame.
- The `securitypolicyviolation` listener must not throw when the host runs the shell without the CSP header (basic-host) — plain feature-detect.
- Do not add `connectDomains` to the resource CSP — the preview uses the tool bridge, not fetch. Adding it would widen the app's attack surface for nothing.
- Keep the zh-CN translation hand-made; machine-looking output fails `translate.mjs --check` review.