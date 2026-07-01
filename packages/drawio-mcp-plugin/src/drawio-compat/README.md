# drawio-compat

Runtime version detection + per-tool version dispatch for the Draw.io MCP plugin.

## When drawio ships a breaking change

Add a new impl next to the existing ones, then update the matrix.

1. Create `src/tools/<tool>/vNN.ts` (mirror the newest sibling's shape).
2. Add a new `ToolVersionEntry` to `src/drawio-compat/matrix.ts` under the
   tool's array. The new entry's `range.min` MUST equal the previous newest
   entry's `range.maxExclusive` (contiguity is enforced by `matrix.test.ts`).
3. Set the previous newest entry's `maxExclusive` to the same value.
4. Only two entries per tool at any time — when adding a third, drop the
   oldest (delete its file, bump `COMPAT_MATRIX.supportedFloor`).

## Detecting version at runtime

`detectDrawioVersion(ui?)` reads `globalThis.EditorUi.VERSION`, falling back
to `ui.constructor.VERSION`. It returns a `DetectedVersion` tagged union.

`getDetectedDrawioVersion()` memoizes the successful result — the drawio page
does not change version mid-session.

## Dispatch outcomes

`dispatchTool(name, detected, matrix)` returns one of:

- `matched` — call `impl(ui, options)`.
- `below-floor` — return a structured tool error.
- `above-window` — call the newest range's impl; log a warning via `report.ts`.
- `no-version` — return a structured tool error.
- `null` — the tool has no matrix entries; caller uses its single-source impl.

## Reporting to the server

`sendCompatReport(send, log)` sends `{ __control: "compat-report", ... }` over
the existing WS channel and logs a summary line. The `__control` prefix
follows the same convention as `document-state` — see `bootstrap.ts` for
the call site. The server's `handleCompatReport` turns the payload into
`AppLogger` calls; the extension background intercepts the same message in
its `SEND_WS_MESSAGE` bridge and stores it as `CompatState` for the popup
banner.
