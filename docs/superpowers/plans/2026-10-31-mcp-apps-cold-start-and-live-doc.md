# MCP Apps Follow-up: Cold Start + Live Document — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `show-diagram` work in a cold start (no connected document → blank diagram in the app), and make the framed editor register as a live document so agent↔user collaboration actually works.

**Architecture:** Builds on the shipped MCP Apps support (branch `agent/kreacher/9174d11c7b15`, head `d3c4a16`). Task 1 is a small tool-handler delta. Task 2 is root-cause investigation of document registration in the framed editor, with a strong hypothesis (embed mode never materializes a "file", so the plugin's `ui.getCurrentFile()`-based registration never fires) and two candidate fixes.

**Tech Stack:** unchanged — TypeScript ESM, `@modelcontextprotocol/sdk`, `@modelcontextprotocol/ext-apps` 2.0.4, zod 4, jest 30, biome + prettier, Playwright for E2E.

**Spec:** `docs/superpowers/specs/2026-10-31-mcp-apps-design.md` (approved) — this plan adds the cold-start requirement agreed on the issue (DRAW-10, "dispatch Kreacher on both").

## Global Constraints

Same as the previous plan (`docs/superpowers/plans/2026-10-31-mcp-apps-support.md`) — rtk for all bash, lint+format before every commit via `lapai-cc-sdlc`, stdout purity, tests run on `build/`, zh-CN localization for docs changes, English for agent-facing strings. Start from this branch (it already contains the spec, the first plan, the implementation, and this plan).

---

### Task 1: `show-diagram` document-optional (cold start)

**Files:**
- Modify: `packages/drawio-mcp-server/src/tools/show-diagram.ts`
- Modify: `packages/drawio-mcp-server/src/mcp-apps.test.ts`
- Modify: `TOOLS.md` + `TOOLS.zh-CN.md` (document cold-start behavior)

**Interfaces:**
- Consumes: `export_tool_handler` from `../tool.js` (as today); the routing error `"No connected Draw.io documents"` thrown by `document_routing.resolve_target_document` (`src/index.ts:628`).
- Produces: `show-diagram` callable with zero connected documents; returns a blank `<mxfile>` text block in that case. Explicit `target_document` with an unknown id still errors (do not mask that).

Background: `export_tool_handler(...)` returns a `ToolFn` whose routing (`routing: "document"`) resolves the target BEFORE the plugin round-trip; with zero documents it throws synchronously — catchable in the tool callback.

- [ ] **Step 1: Write the failing test**

Append to `packages/drawio-mcp-server/src/mcp-apps.test.ts` (inside a new `describe`):

```ts
describe("MCP Apps: show-diagram cold start", () => {
  it("returns a blank diagram when no documents are connected", async () => {
    const app = createDrawioMcpApp({
      config: defaultConfig(),
      log: new MemoryLogger(),
    });
    const client = await connectClientForApp(app);

    const result = await client.callTool({
      name: "show-diagram",
      arguments: { target_page: { index: 0 } },
    });
    const text = (result.content as Array<{ type: string; text?: string }>)
      .find((c) => c.type === "text")?.text ?? "";
    expect(text).toContain("<mxfile");
    expect(text).toContain("<mxGraphModel");
    expect(text).not.toContain("No connected");

    await client.close();
    await app.close();
  });

  it("still errors for an explicit unknown target_document", async () => {
    const app = createDrawioMcpApp({
      config: defaultConfig(),
      log: new MemoryLogger(),
    });
    const client = await connectClientForApp(app);

    await expect(
      client.callTool({
        name: "show-diagram",
        arguments: {
          target_document: { id: "does-not-exist" },
          target_page: { index: 0 },
        },
      }),
    ).rejects.toThrow();

    await client.close();
    await app.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
rtk pnpm --filter drawio-mcp-server build && rtk pnpm --filter drawio-mcp-server test -- build/mcp-apps.test.js
```

Expected: first test FAILS (tool call rejects with `No connected Draw.io documents`); second PASSES already.

- [ ] **Step 3: Implement**

In `packages/drawio-mcp-server/src/tools/show-diagram.ts`:

Add a constant:

```ts
export const BLANK_DIAGRAM_XML = `<mxfile><diagram id="blank" name="Page-1"><mxGraphModel dx="800" dy="600" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="1100" math="0" shadow="0"><root><mxCell id="0" /><mxCell id="1" parent="0" /></root></mxGraphModel></diagram></mxfile>`;
```

Wrap the handler body in try/catch — only the cold-start error is masked:

```ts
    async (args, extra) => {
      const handler = export_tool_handler("export-diagram", context, {
        queue: true,
      });
      let result;
      try {
        result = await handler(
          {
            ...args,
            format: "xml",
            size: "diagram",
            crop: true,
            transparent: false,
          },
          extra,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (
          !args.target_document &&
          message.includes("No connected Draw.io documents")
        ) {
          return {
            content: [{ type: "text" as const, text: BLANK_DIAGRAM_XML }],
          };
        }
        throw error;
      }
      result.content = result.content.filter(
        (item) =>
          !(item.type === "text" && item.text.startsWith("Exported ")),
      );
      return result;
    },
```

(Adapt names/structure to the file as Kreacher implemented it — the contract is: catch the no-documents error only when the caller did not pass `target_document`, return `BLANK_DIAGRAM_XML` text, rethrow everything else.)

Note the shell already handles this: its `ontoolresult` picks the first text block containing `<mxfile` (`packages/drawio-mcp-server/src/app-shell/shell.html`), so a blank seed flows through unchanged.

- [ ] **Step 4: Build, run tests**

```bash
rtk pnpm --filter drawio-mcp-server build && rtk pnpm --filter drawio-mcp-server test
```

Expected: all green.

- [ ] **Step 5: Docs**

`TOOLS.md`: extend the `show-diagram` section — with no connected document (and no `target_document`), the tool returns a blank diagram and the app opens an empty canvas to start drawing from. Translate the change into `TOOLS.zh-CN.md` yourself per `AGENTS.md`; run `node scripts/translate.mjs crosslink TOOLS.zh-CN.md` and `node scripts/translate.mjs --check`.

- [ ] **Step 6: Lint, format, commit**

```bash
rtk pnpm --filter drawio-mcp-server lint && rtk pnpm --filter drawio-mcp-server format:check
```

Commit via `lapai-cc-sdlc:commit-changes`:

```bash
rtk git add packages/drawio-mcp-server/src/ TOOLS.md TOOLS.zh-CN.md
rtk git commit -m "feat(tools): show-diagram cold start returns blank diagram when no documents connected"
```

---

### Task 2: framed editor registers as a live document

**Files:**
- Modify: `packages/drawio-mcp-server/src/app-resource.ts` and/or `packages/drawio-mcp-server/src/app-shell/shell.html` (depending on the chosen fix)
- Modify: possibly `packages/drawio-mcp-plugin/src/bootstrap.ts` (if the root cause is plugin-side)
- Test: `packages/drawio-mcp-server/src/mcp-apps.test.ts` + E2E re-run

**Interfaces:**
- Consumes: the E2E harness from the verification run — script `verify.mjs` is attached to Shredder's proof comment on DRAW-10 (assertions E5: framed editor appears in `list-documents`; E6: `add-rectangle` on the framed doc is visible in `list-paged-model`). Reuse or re-download it.
- Produces: `list-documents` includes the framed editor's document while the app is open; agent edits reach it.

**Evidence already gathered (don't re-litigate, build on it):**

- Plugin registration requires a current file: `refreshActiveDocument` in `packages/drawio-mcp-plugin/src/bootstrap.ts:104-127` bails (no document) whenever `ui.getCurrentFile()` returns null; it registers on `fileLoaded` events.
- Embed mode (`embed=1&proto=json`) editor: even when a parent page sends a proper `{action:"load", xml:<mxfile>}` after `init`, the editor accepted the message (no error events) but `getCurrentFile()` stayed null and the plugin registered no document. Reproduced with a controlled parent page (served plain HTTP), not just basic-host — so it is not a host artifact. WS bridge saw the plugin connect and receive `sync-document-state` controls.
- A standalone (non-embed) editor tab opened at `index.html?local=1` in headless ALSO showed no document — but that tab had no real file open either; the owner's real-browser usage (extension tabs with actual `.drawio` files) registers documents fine today.

**Candidate fixes to evaluate, in order of preference:**

- [ ] **Step 1: Investigate the embed `load` path**

In the served drawio webapp (assets in the cachedir, `~/.cache/drawio-mcp-server/webapp/`), trace how `embed=1&proto=json` handles the parent's `load` action: `diagramly/App.js` / `EditorUi` embed message handler (`handleMessageEvent`). Determine which file class it instantiates (`EmbedFile` vs `LocalFile`) and whether `ui.getCurrentFile()` is expected to be set at all in this flow. Record the finding (file + lines) in the progress trail. If the webapp never sets a current file in embed mode, plugin-side registration can never fire — fix is (a) or (b) below; if it should, find why the load didn't materialize (message origin check? JSON shape?) and fix that instead.

- [ ] **Step 2a (preferred if embed is a dead end): frame the full non-embed editor for cold start**

Cold start needs no XML seeding, so the shell can frame `http://localhost:<httpPort>/index.html?local=1` (full editor) when there is nothing to seed. A full editor creates a real untitled file on its own → `fileLoaded` → document registers. Keep the embed URL for the warm path (XML present). Implementation: the shell already distinguishes "XML received" in `ontoolresult`; make the iframe `src` decision accordingly — either swap `src` before load (two-step) or render the correct URL server-side based on... the shell can't know before the tool result arrives; so: default the iframe to the full editor URL, and only re-target/seed when a non-blank XML arrives (embed still needed for warm seeding — evaluate: if embed is a dead end for registration even with warm XML, then the warm path needs a different seeding mechanism, e.g. the full editor's own "open from XML" URL params — check what the served webapp supports, `?url=`, `#R`, or plugin-side `import-diagram` after connect).

- [ ] **Step 2b (fallback): plugin-side registration for embed mode**

If the webapp has a usable current-file object in embed mode under a different accessor (e.g. `ui.file`, `ui.getFilenameForSave`, or an `open`-shaped event), extend `refreshActiveDocument` in `packages/drawio-mcp-plugin/src/bootstrap.ts` to fall back to that accessor and/or listen to the embed-specific events. Keep the existing path untouched; add the fallback behind the same `getCurrentFile()`-null branch.

- [ ] **Step 3: Prove it headless**

Re-run the E2E (server + basic-host + `verify.mjs`): E5 must show the framed editor's document in `list-documents`, E6 must show the agent-added rectangle in the framed document's model. Save artifacts (screenshots, results.json) and post them on the issue as attachments.

- [ ] **Step 4: Full gates + commit**

```bash
rtk pnpm --filter drawio-mcp-server build && rtk pnpm --filter drawio-mcp-server test
rtk pnpm --filter drawio-mcp-server lint && rtk pnpm --filter drawio-mcp-server format:check
```

Commit via `lapai-cc-sdlc:commit-changes` with a message describing the chosen fix and its evidence.

- [ ] **Step 5: Report on the issue**

State which candidate fix landed and why, with the E5/E6 evidence. If NONE of the candidates makes the framed editor register in headless, STOP and report the root-cause findings on the issue — the real-browser pass (owner-side) is then the gating verification, not more headless attempts. Do not mark the collaboration claim done in docs without E5/E6 (or real-browser) proof.

---

## Self-Review Notes (for the executor)

- Task 1 must NOT mask the explicit-`target_document` error path, and must not mask "Multiple Draw.io documents" (that error should keep telling the agent to call `list-documents`).
- Task 2's outcome decides the shell's URL strategy for both cold and warm paths — document the decision in the commit and on the issue.
- The real-browser pass (QuixiDesk / MCPJam / headed basic-host) remains owner-side; headless proof is the bar for this run.