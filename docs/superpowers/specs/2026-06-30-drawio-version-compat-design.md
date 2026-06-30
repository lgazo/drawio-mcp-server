# Draw.io version compatibility matrix

Date: 2026-06-30
Status: design

## Problem

Draw.io ships breaking changes that flow into our plugin without warning. The
v30.0.0 release dropped the `enableParser` parameter from
`EditorUi.prototype.parseMermaidDiagram` and introduced a separate
`parseMermaidImage` helper for embed-mode rendering. The plugin still passed the
old six-argument signature, so `embed` mode silently fell back to native
conversion and the `import-mermaid` real-environment test broke as soon as CI
cached `latest` after a `pnpm-lock.yaml` change (commit `1a49827`).

The CI fix patched the plugin against v30, but the same class of regression will
recur with every breaking drawio release. We need:

1. A first-class place to keep per-drawio-version tool implementations.
2. Runtime version detection so the plugin can dispatch to the right impl.
3. Loud, structured notification when drawio falls outside the supported window
   — in the extension popup, the server logs, and the tool response itself.
4. Server-side asset auto-refresh in Editor mode when the cached WAR predates
   the supported window.

## Goals

- Keep two consecutive drawio version eras supported at any time.
- Surface mismatches at three layers: tool response (structured error),
  server log (warning/error), extension popup (banner).
- Auto-refresh cached draw.io assets in Editor mode when they fall outside the
  matrix window.
- Make adding the next versioned variant cost roughly two files plus one matrix
  entry.

## Non-goals

- Pinning draw.io to a specific upstream release. The downloader keeps fetching
  `latest`; auto-refresh handles the rest.
- Hot-swapping the plugin without page reload.
- Auto-upgrading the user's draw.io install in extension mode (we can only
  notify; the user controls their environment).

## Architecture

```
packages/drawio-mcp-plugin/src/
  tools/
    import-mermaid/
      v29.ts          impl for drawio <30.0.0 (legacy parseMermaidDiagram + enableParser)
      v30.ts          impl for drawio >=30.0.0 (parseMermaidImage + new parseMermaidDiagram)
      index.ts        dispatch shell + shared types
    add-edge.ts       single impl, untouched
    export-diagram.ts single impl, untouched
    ...
  drawio-compat/
    matrix.ts         declarative per-tool version map
    detect.ts         reads EditorUi.VERSION, returns parsed semver
    dispatch.ts       picks impl by version, classifies outcome
    report.ts         WS handshake message + plugin-side log emission

packages/drawio-mcp-server/src/
  assets/
    version.ts        parses EditorUi.VERSION out of cached app.min.js
    auto-refresh.ts   on startup: wipe + redownload when cached out of window
  drawio-compat/
    matrix.ts         server-side matrix (only supportedFloor + ranges; no impls)
    log-report.ts     consumes plugin handshake; emits logger lines

packages/drawio-mcp-compat/      (new shared package)
  index.ts            VersionRange, compareVersion, versionInWindow, etc.

packages/drawio-mcp-extension/entrypoints/popup/
  CompatBanner.tsx    banner UI
  background.ts       (extended) stores CompatState, re-emits to popup
```

### Runtime flow

1. Plugin loads inside drawio page. `detect.ts` reads `EditorUi.VERSION`.
2. Plugin opens WS to server. Handshake message includes
   `{ drawioVersion: "30.2.6" | null }`.
3. Server logs the version. Compares against its mirror of the matrix. Out of
   range → `logger.warning(...)` (above-window) or `logger.error(...)`
   (below-floor).
4. Editor-mode only: on next server startup, `ensureSupportedAssets` reads the
   cached WAR's `EditorUi.VERSION`. If outside the window, wipe the cache,
   redownload latest, re-check.
5. Tool invocation: the dispatch shell picks an impl whose range contains the
   detected version. No match → tool returns
   `{ success: false, message: "drawio v29.6.7 predates supported floor v30.0.0 …" }`.
6. Extension popup subscribes to background's `CompatState`. Renders
   `CompatBanner` whenever the state is anything other than `ok`.

## Matrix file shape

```ts
// packages/drawio-mcp-plugin/src/drawio-compat/matrix.ts
import * as importMermaidV29 from "../tools/import-mermaid/v29.js";
import * as importMermaidV30 from "../tools/import-mermaid/v30.js";

export type VersionRange = {
  /** inclusive lower bound, e.g. "29.0.0" */
  min: string;
  /** exclusive upper bound, e.g. "30.0.0"; null = open-ended */
  maxExclusive: string | null;
};

export type ToolImpl =
  (ui: any, options: Record<string, unknown>) => unknown;

export type ToolVersionEntry = {
  range: VersionRange;
  impl: ToolImpl;
};

export type CompatMatrix = {
  /** oldest version we still ship a tool impl for */
  supportedFloor: string;
  /** tools with divergent impls; everything else is version-agnostic */
  versionedTools: Record<string, ToolVersionEntry[]>;
};

export const COMPAT_MATRIX: CompatMatrix = {
  supportedFloor: "29.0.0",
  versionedTools: {
    "import-mermaid": [
      { range: { min: "29.0.0", maxExclusive: "30.0.0" },
        impl: importMermaidV29.import_mermaid },
      { range: { min: "30.0.0", maxExclusive: null },
        impl: importMermaidV30.import_mermaid },
    ],
  },
};
```

### Invariants

- At most two entries per tool. When a third drawio era arrives, drop the oldest
  entry and bump `supportedFloor` in one PR.
- Ranges per tool are contiguous and non-overlapping. A unit test enforces this.
- `supportedFloor` equals the smallest `min` across all versioned tools.
- The newest entry uses `maxExclusive: null` (open-ended). No sentinel strings.

### Sharing between plugin, server, and extension

`packages/drawio-mcp-compat/` exposes the small set of pure helpers all three
consumers need: `VersionRange`, `compareVersion`, `versionInWindow`,
`supportedFloor` constant. Tool-impl tables stay inside the plugin — the server
does not import the impls.

## Detection + dispatch

```ts
// packages/drawio-mcp-plugin/src/drawio-compat/detect.ts
export type DetectedVersion =
  | { ok: true; raw: string; semver: [number, number, number] }
  | { ok: false; reason: "missing" | "unparseable"; raw: string | null };

export function detectDrawioVersion(ui: any): DetectedVersion {
  const raw = (globalThis as any).EditorUi?.VERSION
           ?? ui?.constructor?.VERSION;
  if (typeof raw !== "string") {
    return { ok: false, reason: "missing", raw: null };
  }
  const m = raw.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return { ok: false, reason: "unparseable", raw };
  return {
    ok: true,
    raw,
    semver: [Number(m[1]), Number(m[2]), Number(m[3])],
  };
}
```

```ts
// packages/drawio-mcp-plugin/src/drawio-compat/dispatch.ts
export type DispatchOutcome =
  | { kind: "matched"; impl: ToolImpl }
  | { kind: "below-floor"; floor: string; detected: string }
  | { kind: "above-window"; lastRangeMin: string; detected: string }
  | { kind: "no-version"; reason: "missing" | "unparseable" };

export function dispatchTool(
  toolName: string,
  detected: DetectedVersion,
  matrix: CompatMatrix,
): DispatchOutcome { /* range walk; first match wins */ }
```

### Tool wrapper

```ts
// packages/drawio-mcp-plugin/src/tools/import-mermaid/index.ts
export function import_mermaid(
  ui: any,
  options: Record<string, unknown>,
) {
  const detected = detectDrawioVersion(ui);
  const outcome  = dispatchTool("import-mermaid", detected, COMPAT_MATRIX);

  switch (outcome.kind) {
    case "matched":
      return outcome.impl(ui, options);

    case "above-window":
      // run on newest impl, but emit a warn-level mismatch via report.ts
      reportMismatch("import-mermaid", outcome);
      return COMPAT_MATRIX.versionedTools["import-mermaid"]
        .at(-1)!.impl(ui, options);

    case "below-floor":
      return Promise.resolve({
        success: false,
        message:
          `drawio v${outcome.detected} predates supported floor ` +
          `v${outcome.floor}. Upgrade drawio.`,
      });

    case "no-version":
      return Promise.resolve({
        success: false,
        message:
          `cannot detect drawio version (${outcome.reason}); ` +
          `pin a supported drawio build.`,
      });
  }
}
```

### Newer-than-window policy

If drawio releases v31 with API parity, every tool keeps working. Dispatch
returns `above-window`, the tool runs on the newest range's impl, `report.ts`
flags it (`"running drawio v31.0.0 on v30 impl — untested combination"`). Banner
is amber, not red.

## Server side

### Asset version probe + auto-refresh

```ts
// packages/drawio-mcp-server/src/assets/version.ts
export async function readCachedDrawioVersion(
  assetRoot: string,
): Promise<string | null> {
  const appMin = join(assetRoot, "js", "app.min.js");
  if (!existsSync(appMin)) return null;
  const head = await readChunk(appMin, 200_000);
  const m = head.match(/EditorUi\.VERSION\s*=\s*"(\d+\.\d+\.\d+)"/);
  return m?.[1] ?? null;
}
```

```ts
// packages/drawio-mcp-server/src/assets/auto-refresh.ts
export async function ensureSupportedAssets(
  config: AssetConfig,
  matrix: CompatMatrix,
  log: Logger,
): Promise<{ version: string | null; refetched: boolean }> {
  const assetRoot = getAssetRoot(config);
  const cached    = await readCachedDrawioVersion(assetRoot);

  if (cached && versionInWindow(cached, matrix)) {
    return { version: cached, refetched: false };
  }

  log.log("warning",
    `cached drawio v${cached ?? "?"} is outside supported window ` +
    `(>= v${matrix.supportedFloor}); refetching latest`);
  rmSync(assetRoot, { recursive: true, force: true });
  await downloadAndExtractAssets(getCacheDir(config.assetPath), log);

  const after = await readCachedDrawioVersion(assetRoot);
  if (!after || !versionInWindow(after, matrix)) {
    log.log("error",
      `drawio latest v${after ?? "?"} is still outside supported window; ` +
      `tools may misbehave`);
  }
  return { version: after, refetched: true };
}
```

`ensureAssets` (Editor entry point) chains into `ensureSupportedAssets` when
running in Editor mode. No CLI opt-out flag: the user already opted into us
managing the cache by choosing Editor mode.

### Plugin handshake

Existing WS handshake gains:

```ts
{ type: "hello", drawioVersion: "30.2.6" | null }
```

`log-report.ts` compares the reported version against the server's matrix
mirror:

- below floor → `log.log("error", ...)`
- above window → `log.log("warning", ...)`
- in range → `log.log("info", ...)` once per connection

In extension mode, the server can only ever know what the plugin reports. No
auto-refresh runs there.

## Extension popup banner

`packages/drawio-mcp-extension/entrypoints/popup/App.tsx` already tracks
connection state. Extend the background script with compat state:

```ts
type CompatState =
  | { kind: "unknown" }
  | { kind: "ok"; version: string }
  | { kind: "below-floor"; version: string; floor: string }
  | { kind: "above-window"; version: string; lastSupportedMin: string }
  | { kind: "no-version"; reason: "missing" | "unparseable" };
```

`background.ts` subscribes to plugin reports on the existing content-script
bridge, stores last `CompatState`, re-emits to popup on `GET_COMPAT_STATE` and
on change.

`CompatBanner.tsx` renders three variants (`ok` is no banner):

- `below-floor` → red. *"drawio vX is below the supported floor (vY). MCP tools
  needing vY+ will return errors. → Reload drawio with cache cleared, or upgrade
  your self-hosted drawio."*
- `above-window` → amber. *"drawio vX is newer than the tested window
  (last tested: vY). Tools run on the closest impl; please report issues."*
- `no-version` / `unknown` → grey. *"cannot detect drawio version
  (`<reason>`)."*

Banner sits above the existing logo in `App.tsx`. Dismissable per-version
(banner reappears when the detected version changes).

## Testing

New test files:

- `drawio-compat/matrix.test.ts` (plugin) — ranges contiguous, non-overlapping,
  `supportedFloor` matches the oldest entry's `min`.
- `drawio-compat/detect.test.ts` — `EditorUi.VERSION` missing, malformed,
  `30.2.6`, pre-release `30.2.6-beta`.
- `drawio-compat/dispatch.test.ts` — matched / below-floor / above-window /
  no-version outcomes.
- `assets/version.test.ts` (server) — `readCachedDrawioVersion` with a fixture
  `app.min.js`.
- `assets/auto-refresh.test.ts` — mocked downloader; refetch fires when cached
  is out of window, skipped when in range, error logged when refetched is still
  out of window.
- `tools/import-mermaid/v29.test.ts` — exercises the legacy
  `parseMermaidDiagram(..., enableParser)` shape against a v29-style mock `ui`.
- `tools/import-mermaid/v30.test.ts` — exercises `parseMermaidImage` against a
  v30-style mock `ui`.
- `real-environment/import-mermaid.test.ts` — unchanged; both modes keep
  passing on v30.
- `CompatBanner.test.tsx` (extension) — three variants render correctly.

## Migration

1. Move the current fixed `import_mermaid` from
   `packages/drawio-mcp-plugin/src/drawio-tools.ts` into
   `tools/import-mermaid/v30.ts`.
2. Add `tools/import-mermaid/v29.ts` with the pre-fix legacy
   `parseMermaidDiagram(..., enableParser)` path (recovered from commit
   history, last seen before `1a49827`).
3. Create `tools/import-mermaid/index.ts` as the dispatch shell.
4. Add `drawio-compat/` and `packages/drawio-mcp-compat/`.
5. Rewire `packages/drawio-mcp-plugin/src/tool-registry.ts:367` to use
   `tools/import-mermaid/index.ts`.
6. Drop the now-orphaned `import_mermaid` from `drawio-tools.ts`.
7. Add `ensureSupportedAssets` call to `ensureAssets` in
   `packages/drawio-mcp-server/src/assets/downloader.ts`.
8. Extend WS handshake handler (server) and plugin bootstrap to carry
   `drawioVersion`.
9. Add `CompatBanner` to the popup; extend background state and message bridge.

The v29 impl stays in tree for one release cycle. It gets removed when
`supportedFloor` bumps to v30.

## Out of scope

- Auto-update for extension users (their drawio install, their problem — banner
  only).
- Pinning a specific drawio version in `downloader.ts`. Current "latest"
  behavior stays.
- New logger output channels beyond the existing `--logger console` /
  `--logger mcp-server` modes.
- CI: keeping draw.io asset cache key tied to `pnpm-lock.yaml` is unchanged.
  Auto-refresh handles the consequence; the cache key itself is left alone.
