# Draw.io Version Compatibility Matrix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a per-tool drawio-version compatibility matrix (two adjacent eras supported at any time), runtime detection + dispatch in the plugin, server-side asset auto-refresh in Editor mode, WS handshake carrying the detected version, structured tool errors + logger lines + extension popup banner when drawio falls outside the window.

**Architecture:** Small shared `drawio-mcp-compat` package (pure types + helpers). Plugin gains `drawio-compat/` (detect + dispatch + matrix + report) and splits `import-mermaid` into per-version impls under `tools/import-mermaid/{v29,v30,shared,index}.ts`. Server gains `assets/version.ts` + `assets/auto-refresh.ts` + `drawio-compat/log-report.ts`. Extension gains a `CompatBanner` and a `CompatState` in the background bridge.

**Tech Stack:** TypeScript, pnpm workspace, esbuild (plugin bundle), Vite/WXT (extension), Jest (server + shared tests), Playwright (real-environment), Biome + Prettier (lint/format).

## Global Constraints

- Server logging discipline (`AGENTS.md`): `console.log`, `console.info`, `console.dir`, `process.stdout.write` are banned in `packages/drawio-mcp-server/src/**` outside the allowlist. Every function that emits a diagnostic MUST receive an `AppLogger`/`Logger` via DI or `Context.log`. Constructing a logger inside a function is forbidden except in entry-point files.
- Plugin and extension packages execute in a browser context and may use `console.*` freely.
- Biome runs `noConsole` on the server (`pnpm --filter drawio-mcp-server lint`); the plan must not add violating console calls under `packages/drawio-mcp-server/src/**`.
- Every commit passes `pnpm --filter drawio-mcp-plugin run build`, `pnpm --filter drawio-mcp-server run build`, `pnpm --filter drawio-mcp-server run lint`, and (task-scoped) `pnpm test` from the touched package.
- Commit style: matches existing history — Conventional Commits, no Claude co-author trailer; author = `claude-code-anthropic-<model>@opencode.ai`, `Co-Authored-By:` = the human (per repo memory `feedback_no_coauthor`).
- Draw.io downloader keeps fetching GitHub `latest`. No pinned version.
- Two adjacent drawio eras supported at any time. `supportedFloor` = oldest range's `min` = `"29.0.0"` on landing.

---

## File Structure

**New files:**

```
packages/drawio-mcp-compat/
  package.json
  tsconfig.json
  src/index.ts                 # VersionRange, DetectedVersion, parseVersion,
                               # compareVersion, isBelowFloor, isInRange
  src/index.test.ts            # unit tests for helpers

packages/drawio-mcp-plugin/src/drawio-compat/
  detect.ts                    # detectDrawioVersion(ui), memoized
  detect.test.ts
  matrix.ts                    # COMPAT_MATRIX + versionedTools table
  matrix.test.ts               # contiguity + supportedFloor invariants
  dispatch.ts                  # dispatchTool()
  dispatch.test.ts
  report.ts                    # reportCompatState() — WS + console.log

packages/drawio-mcp-plugin/src/tools/import-mermaid/
  shared.ts                    # shared option validation + settle/onXml factory
  v29.ts                       # legacy parseMermaidDiagram(...enableParser) impl
  v30.ts                       # current parseMermaidImage / parseMermaidDiagram impl
  index.ts                     # dispatch shell exposing import_mermaid()
  v29.test.ts
  v30.test.ts

packages/drawio-mcp-server/src/assets/
  version.ts                   # readCachedDrawioVersion(assetRoot)
  version.test.ts
  auto-refresh.ts              # ensureSupportedAssets()
  auto-refresh.test.ts

packages/drawio-mcp-server/src/drawio-compat/
  matrix.ts                    # server mirror of supportedFloor + ranges (no impls)
  log-report.ts                # consumes plugin handshake, emits Logger lines
  log-report.test.ts

packages/drawio-mcp-extension/entrypoints/popup/
  CompatBanner.tsx
  CompatBanner.test.tsx
```

**Modified files:**

```
pnpm-workspace.yaml                                           # add new package
packages/drawio-mcp-plugin/src/drawio-tools.ts                # drop import_mermaid
packages/drawio-mcp-plugin/src/tool-registry.ts               # import from tools/import-mermaid
packages/drawio-mcp-plugin/src/plugin.ts (or ws bootstrap)    # send drawioVersion in hello
packages/drawio-mcp-server/src/assets/index.ts                # chain ensureSupportedAssets
packages/drawio-mcp-server/src/index.ts                       # register log-report handler
packages/drawio-mcp-extension/entrypoints/background.ts       # store CompatState, bridge
packages/drawio-mcp-extension/entrypoints/popup/App.tsx       # render <CompatBanner/>
```

---

## Task 1: Shared `drawio-mcp-compat` package

**Files:**
- Create: `packages/drawio-mcp-compat/package.json`
- Create: `packages/drawio-mcp-compat/tsconfig.json`
- Create: `packages/drawio-mcp-compat/src/index.ts`
- Create: `packages/drawio-mcp-compat/src/index.test.ts`
- Modify: `pnpm-workspace.yaml` — add `packages/drawio-mcp-compat` if the workspace uses per-package listing (check `pnpm-workspace.yaml` — if it uses `packages/*` glob, no change needed)

**Interfaces:**
- Produces:
  - `type Semver = readonly [number, number, number]`
  - `type VersionRange = { readonly min: string; readonly maxExclusive: string | null }`
  - `type DetectedVersion = { ok: true; raw: string; semver: Semver } | { ok: false; reason: "missing" | "unparseable"; raw: string | null }`
  - `parseVersion(raw: string): Semver | null` — strips any suffix after the first three dotted numbers (matches `30.2.6`, `30.2.6-beta`, `30.2.6+build`)
  - `compareVersion(a: Semver, b: Semver): -1 | 0 | 1`
  - `isBelowFloor(v: Semver, floor: string): boolean` — returns true iff `v < parseVersion(floor)`; false if `floor` is unparseable (defensive)
  - `isInRange(v: Semver, r: VersionRange): boolean` — `v >= r.min` AND (`r.maxExclusive === null` OR `v < r.maxExclusive`)

- [ ] **Step 1: Confirm workspace layout**

Run:
```bash
cat pnpm-workspace.yaml
```
Expected: some form of `packages:` block. If it lists globs (`packages/*`), no edit needed later. If it lists individual paths, remember to add `packages/drawio-mcp-compat` in a later step.

- [ ] **Step 2: Create `packages/drawio-mcp-compat/package.json`**

Write:
```json
{
  "name": "drawio-mcp-compat",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "test": "NODE_OPTIONS=--experimental-vm-modules jest",
    "lint": "biome check src/ && tsc --noEmit"
  },
  "devDependencies": {
    "@biomejs/biome": "catalog:",
    "@jest/globals": "catalog:",
    "@types/jest": "catalog:",
    "jest": "catalog:",
    "ts-jest": "catalog:",
    "typescript": "catalog:"
  }
}
```
Note: if any of those `catalog:` names don't exist in `pnpm-workspace.yaml`'s catalog block, pin the version directly by mirroring the version used in `packages/drawio-mcp-server/package.json`.

- [ ] **Step 3: Create `packages/drawio-mcp-compat/tsconfig.json`**

Write:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts", "dist"]
}
```

- [ ] **Step 4: Write the failing test**

Create `packages/drawio-mcp-compat/src/index.test.ts`:
```ts
import { describe, expect, it } from "@jest/globals";
import {
  compareVersion,
  isBelowFloor,
  isInRange,
  parseVersion,
} from "./index.js";

describe("parseVersion", () => {
  it("parses `X.Y.Z`", () => {
    expect(parseVersion("30.2.6")).toEqual([30, 2, 6]);
  });
  it("parses with pre-release/build suffix", () => {
    expect(parseVersion("30.2.6-beta.1")).toEqual([30, 2, 6]);
    expect(parseVersion("30.2.6+build.42")).toEqual([30, 2, 6]);
  });
  it("returns null on garbage", () => {
    expect(parseVersion("nope")).toBeNull();
    expect(parseVersion("30.2")).toBeNull();
  });
});

describe("compareVersion", () => {
  it("compares major then minor then patch", () => {
    expect(compareVersion([1, 0, 0], [2, 0, 0])).toBe(-1);
    expect(compareVersion([2, 0, 0], [2, 0, 0])).toBe(0);
    expect(compareVersion([2, 1, 0], [2, 0, 9])).toBe(1);
    expect(compareVersion([2, 1, 5], [2, 1, 6])).toBe(-1);
  });
});

describe("isBelowFloor", () => {
  it("returns true when version < floor", () => {
    expect(isBelowFloor([29, 6, 7], "30.0.0")).toBe(true);
    expect(isBelowFloor([30, 0, 0], "30.0.0")).toBe(false);
    expect(isBelowFloor([30, 2, 6], "30.0.0")).toBe(false);
  });
  it("returns false when floor is unparseable", () => {
    expect(isBelowFloor([29, 6, 7], "garbage")).toBe(false);
  });
});

describe("isInRange", () => {
  it("respects inclusive min + exclusive max", () => {
    const r = { min: "30.0.0", maxExclusive: "31.0.0" };
    expect(isInRange([29, 6, 7], r)).toBe(false);
    expect(isInRange([30, 0, 0], r)).toBe(true);
    expect(isInRange([30, 2, 6], r)).toBe(true);
    expect(isInRange([31, 0, 0], r)).toBe(false);
  });
  it("treats null maxExclusive as open-ended", () => {
    const r = { min: "30.0.0", maxExclusive: null };
    expect(isInRange([30, 0, 0], r)).toBe(true);
    expect(isInRange([99, 99, 99], r)).toBe(true);
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run:
```bash
cd packages/drawio-mcp-compat && pnpm test
```
Expected: FAIL with "Cannot find module './index.js'" or similar.

- [ ] **Step 6: Implement `src/index.ts`**

Write:
```ts
export type Semver = readonly [number, number, number];

export type VersionRange = {
  readonly min: string;
  readonly maxExclusive: string | null;
};

export type DetectedVersion =
  | { readonly ok: true; readonly raw: string; readonly semver: Semver }
  | {
      readonly ok: false;
      readonly reason: "missing" | "unparseable";
      readonly raw: string | null;
    };

const SEMVER_HEAD = /^(\d+)\.(\d+)\.(\d+)/;

export function parseVersion(raw: string): Semver | null {
  const m = SEMVER_HEAD.exec(raw);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function compareVersion(a: Semver, b: Semver): -1 | 0 | 1 {
  for (let i = 0; i < 3; i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
}

export function isBelowFloor(v: Semver, floor: string): boolean {
  const parsed = parseVersion(floor);
  if (!parsed) return false;
  return compareVersion(v, parsed) < 0;
}

export function isInRange(v: Semver, r: VersionRange): boolean {
  const min = parseVersion(r.min);
  if (!min) return false;
  if (compareVersion(v, min) < 0) return false;
  if (r.maxExclusive === null) return true;
  const max = parseVersion(r.maxExclusive);
  if (!max) return true;
  return compareVersion(v, max) < 0;
}
```

- [ ] **Step 7: Add Jest config**

Create `packages/drawio-mcp-compat/jest.config.js`:
```js
export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
  testMatch: ["**/*.test.ts"],
};
```

- [ ] **Step 8: Run tests to verify they pass**

Run:
```bash
pnpm install
cd packages/drawio-mcp-compat && pnpm test
```
Expected: PASS 4 test suites (parseVersion, compareVersion, isBelowFloor, isInRange).

- [ ] **Step 9: Build**

Run:
```bash
pnpm --filter drawio-mcp-compat run build
```
Expected: `dist/index.js` and `dist/index.d.ts` produced. No TS errors.

- [ ] **Step 10: Commit**

```bash
git add packages/drawio-mcp-compat pnpm-workspace.yaml
git commit -m "feat(compat): add drawio-mcp-compat shared package"
```

---

## Task 2: Plugin version detection

**Files:**
- Create: `packages/drawio-mcp-plugin/src/drawio-compat/detect.ts`
- Create: `packages/drawio-mcp-plugin/src/drawio-compat/detect.test.ts`
- Modify: `packages/drawio-mcp-plugin/package.json` — add `drawio-mcp-compat` as workspace dep

**Interfaces:**
- Consumes: `DetectedVersion`, `parseVersion` from `drawio-mcp-compat`.
- Produces:
  - `detectDrawioVersion(ui?: unknown): DetectedVersion` — reads `globalThis.EditorUi?.VERSION`, falls back to `(ui as any)?.constructor?.VERSION`.
  - `getDetectedDrawioVersion(ui?: unknown): DetectedVersion` — memoized wrapper: computes once, caches per plugin lifetime; exposed `resetDetectedDrawioVersionCache()` for tests.

- [ ] **Step 1: Add workspace dep**

Edit `packages/drawio-mcp-plugin/package.json` to add under `dependencies`:
```json
"drawio-mcp-compat": "workspace:*"
```
Then run:
```bash
pnpm install
```
Expected: dep resolved, no version conflicts.

- [ ] **Step 2: Write the failing test**

Create `packages/drawio-mcp-plugin/src/drawio-compat/detect.test.ts`:
```ts
import { describe, expect, it, beforeEach } from "@jest/globals";
import {
  detectDrawioVersion,
  getDetectedDrawioVersion,
  resetDetectedDrawioVersionCache,
} from "./detect.js";

const g = globalThis as any;

describe("detectDrawioVersion", () => {
  beforeEach(() => {
    delete g.EditorUi;
    resetDetectedDrawioVersionCache();
  });

  it("reads globalThis.EditorUi.VERSION", () => {
    g.EditorUi = { VERSION: "30.2.6" };
    expect(detectDrawioVersion()).toEqual({
      ok: true,
      raw: "30.2.6",
      semver: [30, 2, 6],
    });
  });

  it("falls back to ui.constructor.VERSION", () => {
    const ui = { constructor: { VERSION: "29.6.7" } };
    expect(detectDrawioVersion(ui)).toEqual({
      ok: true,
      raw: "29.6.7",
      semver: [29, 6, 7],
    });
  });

  it("reports `missing` when nothing is present", () => {
    expect(detectDrawioVersion()).toEqual({
      ok: false,
      reason: "missing",
      raw: null,
    });
  });

  it("reports `unparseable` when VERSION is not a semver head", () => {
    g.EditorUi = { VERSION: "nightly" };
    expect(detectDrawioVersion()).toEqual({
      ok: false,
      reason: "unparseable",
      raw: "nightly",
    });
  });
});

describe("getDetectedDrawioVersion (memoized)", () => {
  beforeEach(() => {
    delete g.EditorUi;
    resetDetectedDrawioVersionCache();
  });

  it("caches the first successful result", () => {
    g.EditorUi = { VERSION: "30.2.6" };
    const first = getDetectedDrawioVersion();
    g.EditorUi = { VERSION: "99.0.0" };
    const second = getDetectedDrawioVersion();
    expect(second).toBe(first);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run from `packages/drawio-mcp-plugin`:
```bash
NODE_OPTIONS=--experimental-vm-modules npx jest src/drawio-compat/detect.test.ts
```
Expected: FAIL with "Cannot find module './detect.js'".

- [ ] **Step 4: Implement `detect.ts`**

Create `packages/drawio-mcp-plugin/src/drawio-compat/detect.ts`:
```ts
import { parseVersion, type DetectedVersion } from "drawio-mcp-compat";

export function detectDrawioVersion(ui?: unknown): DetectedVersion {
  const raw =
    (globalThis as { EditorUi?: { VERSION?: unknown } }).EditorUi?.VERSION ??
    (ui as { constructor?: { VERSION?: unknown } })?.constructor?.VERSION;
  if (typeof raw !== "string") {
    return { ok: false, reason: "missing", raw: null };
  }
  const semver = parseVersion(raw);
  if (!semver) return { ok: false, reason: "unparseable", raw };
  return { ok: true, raw, semver };
}

let cached: DetectedVersion | null = null;

export function getDetectedDrawioVersion(ui?: unknown): DetectedVersion {
  if (cached !== null) return cached;
  const result = detectDrawioVersion(ui);
  if (result.ok) cached = result;
  return result;
}

export function resetDetectedDrawioVersionCache(): void {
  cached = null;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run:
```bash
NODE_OPTIONS=--experimental-vm-modules npx jest src/drawio-compat/detect.test.ts
```
Expected: PASS 5 tests.

- [ ] **Step 6: Build the plugin**

Run:
```bash
pnpm --filter drawio-mcp-plugin run build
```
Expected: no TS errors, `dist/mcp-plugin.js` built.

- [ ] **Step 7: Commit**

```bash
git add packages/drawio-mcp-plugin
git commit -m "feat(plugin): detect drawio version via EditorUi.VERSION"
```

---

## Task 3: Plugin matrix + dispatch

**Files:**
- Create: `packages/drawio-mcp-plugin/src/drawio-compat/matrix.ts`
- Create: `packages/drawio-mcp-plugin/src/drawio-compat/matrix.test.ts`
- Create: `packages/drawio-mcp-plugin/src/drawio-compat/dispatch.ts`
- Create: `packages/drawio-mcp-plugin/src/drawio-compat/dispatch.test.ts`

**Interfaces:**
- Consumes: `Semver`, `VersionRange`, `DetectedVersion`, `isBelowFloor`, `isInRange` from `drawio-mcp-compat`. `getDetectedDrawioVersion` from Task 2.
- Produces:
  - `type ToolImpl = (ui: any, options: Record<string, unknown>) => unknown`
  - `type ToolVersionEntry = { range: VersionRange; impl: ToolImpl }`
  - `type CompatMatrix = { supportedFloor: string; versionedTools: Readonly<Record<string, readonly ToolVersionEntry[]>> }`
  - `COMPAT_MATRIX: CompatMatrix` — empty `versionedTools` initially; Task 4 wires `import-mermaid` in.
  - `type DispatchOutcome = { kind: "matched"; impl: ToolImpl } | { kind: "below-floor"; floor: string; detected: string } | { kind: "above-window"; lastRangeMin: string; detected: string } | { kind: "no-version"; reason: "missing" | "unparseable" }`
  - `dispatchTool(toolName: string, detected: DetectedVersion, matrix: CompatMatrix): DispatchOutcome | null` — returns `null` when `toolName` has no entries in `versionedTools` (caller falls back to the version-agnostic path).

- [ ] **Step 1: Write the failing dispatch test**

Create `packages/drawio-mcp-plugin/src/drawio-compat/dispatch.test.ts`:
```ts
import { describe, expect, it } from "@jest/globals";
import type { CompatMatrix, ToolImpl } from "./matrix.js";
import { dispatchTool } from "./dispatch.js";

const implV29: ToolImpl = () => "v29";
const implV30: ToolImpl = () => "v30";

const matrix: CompatMatrix = {
  supportedFloor: "29.0.0",
  versionedTools: {
    "import-mermaid": [
      { range: { min: "29.0.0", maxExclusive: "30.0.0" }, impl: implV29 },
      { range: { min: "30.0.0", maxExclusive: null }, impl: implV30 },
    ],
  },
};

describe("dispatchTool", () => {
  it("returns matched impl when version is in a range", () => {
    const outcome = dispatchTool(
      "import-mermaid",
      { ok: true, raw: "30.2.6", semver: [30, 2, 6] },
      matrix,
    );
    expect(outcome).toEqual({ kind: "matched", impl: implV30 });
  });

  it("returns below-floor when version predates all ranges", () => {
    const outcome = dispatchTool(
      "import-mermaid",
      { ok: true, raw: "28.0.0", semver: [28, 0, 0] },
      matrix,
    );
    expect(outcome).toEqual({
      kind: "below-floor",
      floor: "29.0.0",
      detected: "28.0.0",
    });
  });

  it("returns above-window when version is past the open-ended range and no range matches", () => {
    // With maxExclusive: null on the newest range, "above-window" only occurs
    // when the newest range's max is bounded. Construct a bounded matrix.
    const bounded: CompatMatrix = {
      supportedFloor: "29.0.0",
      versionedTools: {
        "import-mermaid": [
          { range: { min: "29.0.0", maxExclusive: "30.0.0" }, impl: implV29 },
          { range: { min: "30.0.0", maxExclusive: "31.0.0" }, impl: implV30 },
        ],
      },
    };
    const outcome = dispatchTool(
      "import-mermaid",
      { ok: true, raw: "31.5.0", semver: [31, 5, 0] },
      bounded,
    );
    expect(outcome).toEqual({
      kind: "above-window",
      lastRangeMin: "30.0.0",
      detected: "31.5.0",
    });
  });

  it("returns no-version when detection failed", () => {
    const outcome = dispatchTool(
      "import-mermaid",
      { ok: false, reason: "missing", raw: null },
      matrix,
    );
    expect(outcome).toEqual({ kind: "no-version", reason: "missing" });
  });

  it("returns null when the tool has no matrix entries", () => {
    const outcome = dispatchTool(
      "add-edge",
      { ok: true, raw: "30.2.6", semver: [30, 2, 6] },
      matrix,
    );
    expect(outcome).toBeNull();
  });
});
```

- [ ] **Step 2: Write the failing matrix invariants test**

Create `packages/drawio-mcp-plugin/src/drawio-compat/matrix.test.ts`:
```ts
import { describe, expect, it } from "@jest/globals";
import { compareVersion, parseVersion } from "drawio-mcp-compat";
import { COMPAT_MATRIX } from "./matrix.js";

describe("COMPAT_MATRIX invariants", () => {
  it("supportedFloor is a parseable version", () => {
    expect(parseVersion(COMPAT_MATRIX.supportedFloor)).not.toBeNull();
  });

  it("supportedFloor equals the smallest range min across all versioned tools", () => {
    const parsedFloor = parseVersion(COMPAT_MATRIX.supportedFloor);
    if (!parsedFloor) throw new Error("supportedFloor unparseable");
    for (const entries of Object.values(COMPAT_MATRIX.versionedTools)) {
      for (const entry of entries) {
        const min = parseVersion(entry.range.min);
        if (!min) throw new Error(`unparseable min: ${entry.range.min}`);
        expect(compareVersion(min, parsedFloor)).not.toBe(-1);
      }
    }
  });

  it("per-tool ranges are contiguous and non-overlapping", () => {
    for (const [tool, entries] of Object.entries(
      COMPAT_MATRIX.versionedTools,
    )) {
      const sorted = [...entries].sort((a, b) => {
        const am = parseVersion(a.range.min);
        const bm = parseVersion(b.range.min);
        if (!am || !bm) throw new Error(`unparseable min in ${tool}`);
        return compareVersion(am, bm);
      });
      for (let i = 0; i < sorted.length - 1; i++) {
        expect(sorted[i].range.maxExclusive).toBe(sorted[i + 1].range.min);
      }
      expect(sorted.at(-1)!.range.maxExclusive).toBeNull();
    }
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:
```bash
NODE_OPTIONS=--experimental-vm-modules npx jest src/drawio-compat/
```
Expected: FAIL with missing modules.

- [ ] **Step 4: Implement `matrix.ts` (empty entries for now)**

Create `packages/drawio-mcp-plugin/src/drawio-compat/matrix.ts`:
```ts
import type { VersionRange } from "drawio-mcp-compat";

export type ToolImpl = (
  ui: any,
  options: Record<string, unknown>,
) => unknown;

export type ToolVersionEntry = {
  readonly range: VersionRange;
  readonly impl: ToolImpl;
};

export type CompatMatrix = {
  readonly supportedFloor: string;
  readonly versionedTools: Readonly<
    Record<string, readonly ToolVersionEntry[]>
  >;
};

export const COMPAT_MATRIX: CompatMatrix = {
  supportedFloor: "29.0.0",
  versionedTools: {
    // populated by Task 4 (import-mermaid)
  },
};
```

- [ ] **Step 5: Implement `dispatch.ts`**

Create `packages/drawio-mcp-plugin/src/drawio-compat/dispatch.ts`:
```ts
import {
  compareVersion,
  isBelowFloor,
  isInRange,
  parseVersion,
  type DetectedVersion,
} from "drawio-mcp-compat";
import type { CompatMatrix, ToolImpl } from "./matrix.js";

export type DispatchOutcome =
  | { kind: "matched"; impl: ToolImpl }
  | { kind: "below-floor"; floor: string; detected: string }
  | { kind: "above-window"; lastRangeMin: string; detected: string }
  | { kind: "no-version"; reason: "missing" | "unparseable" };

export function dispatchTool(
  toolName: string,
  detected: DetectedVersion,
  matrix: CompatMatrix,
): DispatchOutcome | null {
  const entries = matrix.versionedTools[toolName];
  if (!entries || entries.length === 0) return null;

  if (!detected.ok) {
    return { kind: "no-version", reason: detected.reason };
  }

  if (isBelowFloor(detected.semver, matrix.supportedFloor)) {
    return {
      kind: "below-floor",
      floor: matrix.supportedFloor,
      detected: detected.raw,
    };
  }

  for (const entry of entries) {
    if (isInRange(detected.semver, entry.range)) {
      return { kind: "matched", impl: entry.impl };
    }
  }

  const sorted = [...entries].sort((a, b) => {
    const am = parseVersion(a.range.min)!;
    const bm = parseVersion(b.range.min)!;
    return compareVersion(am, bm);
  });
  return {
    kind: "above-window",
    lastRangeMin: sorted.at(-1)!.range.min,
    detected: detected.raw,
  };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run:
```bash
NODE_OPTIONS=--experimental-vm-modules npx jest src/drawio-compat/
```
Expected: PASS all matrix + dispatch tests.

- [ ] **Step 7: Build**

Run:
```bash
pnpm --filter drawio-mcp-plugin run build
```
Expected: no TS errors.

- [ ] **Step 8: Commit**

```bash
git add packages/drawio-mcp-plugin
git commit -m "feat(plugin): add version compat matrix + dispatch"
```

---

## Task 4: Split `import-mermaid` into per-version impls

**Files:**
- Create: `packages/drawio-mcp-plugin/src/tools/import-mermaid/shared.ts`
- Create: `packages/drawio-mcp-plugin/src/tools/import-mermaid/v29.ts`
- Create: `packages/drawio-mcp-plugin/src/tools/import-mermaid/v30.ts`
- Create: `packages/drawio-mcp-plugin/src/tools/import-mermaid/index.ts`
- Create: `packages/drawio-mcp-plugin/src/tools/import-mermaid/v29.test.ts`
- Create: `packages/drawio-mcp-plugin/src/tools/import-mermaid/v30.test.ts`
- Modify: `packages/drawio-mcp-plugin/src/drawio-compat/matrix.ts` — register both entries
- Modify: `packages/drawio-mcp-plugin/src/drawio-tools.ts:153-252` — remove the current `import_mermaid` function and the two `ImportMermaid*` types (kept in `shared.ts` from now on)
- Modify: `packages/drawio-mcp-plugin/src/tool-registry.ts:21` — import `import_mermaid` from `./tools/import-mermaid/index.js` instead of `./drawio-tools.js`

**Interfaces:**
- Consumes: `import_diagram` from `drawio-tools.ts`, `COMPAT_MATRIX` + `dispatchTool` + `getDetectedDrawioVersion` from Task 2/3.
- Produces:
  - `type ImportMermaidOptions` (moved to `shared.ts`)
  - `type ImportMermaidResult` (moved to `shared.ts`)
  - `import_mermaid` from `tools/import-mermaid/index.ts` — exported symbol name unchanged; signature `(ui: any, options: Record<string, unknown>) => Promise<ImportMermaidResult>`.
  - `import_mermaid` from `tools/import-mermaid/v29.ts` and `v30.ts` — same signature.

- [ ] **Step 1: Create `shared.ts` (option types + settle helpers)**

Create `packages/drawio-mcp-plugin/src/tools/import-mermaid/shared.ts`:
```ts
import { import_diagram } from "../../drawio-tools.js";

export type ImportMermaidOptions = {
  mermaid_source: string;
  mode?: "native" | "embed";
  insert_mode?: "replace" | "add" | "new-page";
};

export type ImportMermaidResult =
  | {
      success: true;
      mode: "native" | "embed";
      message: string;
      cells?: number;
      xml?: string;
    }
  | { success: false; message: string };

export function validateOptions(
  options: Record<string, unknown>,
): { source: string; mode: "native" | "embed"; insertMode: "replace" | "add" | "new-page" } | ImportMermaidResult {
  const opts = options as unknown as ImportMermaidOptions;
  const source = opts.mermaid_source;
  if (!source || typeof source !== "string") {
    return {
      success: false,
      message: "mermaid_source must be a non-empty string",
    };
  }
  return {
    source,
    mode: opts.mode ?? "native",
    insertMode: opts.insert_mode ?? "add",
  };
}

export function runInsertFlow(
  ui: any,
  mode: "native" | "embed",
  insertMode: "replace" | "add" | "new-page",
  resolve: (result: ImportMermaidResult) => void,
): {
  onXml: (xml: string) => void;
  onError: (err: any) => void;
} {
  let settled = false;
  const settle = (result: ImportMermaidResult) => {
    if (settled) return;
    settled = true;
    resolve(result);
  };

  const onXml = (xml: string) => {
    if (!xml || typeof xml !== "string") {
      settle({ success: false, message: "Mermaid parser returned empty XML" });
      return;
    }
    try {
      const importResult = import_diagram(ui, {
        data: xml,
        format: "xml",
        mode: insertMode,
      });
      if (!importResult.success) {
        settle({
          success: false,
          message: `Mermaid converted, but inserting into the diagram failed: ${importResult.message}`,
        });
        return;
      }
      settle({
        success: true,
        mode,
        message: importResult.message,
        cells: importResult.cells,
        xml,
      });
    } catch (err) {
      settle({
        success: false,
        message: `Insert after Mermaid conversion failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  };

  const onError = (err: any) => {
    settle({
      success: false,
      message: `Mermaid render failed: ${err?.message ?? String(err)}`,
    });
  };

  return { onXml, onError };
}
```

- [ ] **Step 2: Write the failing v30 test**

Create `packages/drawio-mcp-plugin/src/tools/import-mermaid/v30.test.ts`:
```ts
import { describe, expect, it, jest } from "@jest/globals";
import { import_mermaid } from "./v30.js";

const FLOWCHART = "graph TD\nA[Start] --> B[Stop]";

function makeUi(overrides: Partial<Record<string, any>> = {}) {
  return {
    parseMermaidDiagram: overrides.parseMermaidDiagram,
    parseMermaidImage: overrides.parseMermaidImage,
    editor: {
      graph: {
        model: {
          beginUpdate: () => {},
          endUpdate: () => {},
          getRoot: () => ({}),
          getChildAt: () => null,
        },
      },
    },
  };
}

describe("import_mermaid v30", () => {
  it("uses parseMermaidImage for embed mode", async () => {
    const parseMermaidImage = jest.fn(
      (_source: string, success: (xml: string) => void) => {
        success("<mxGraphModel><root><UserObject mermaidData=\"{}\"/><mxCell style=\"shape=image\"/></root></mxGraphModel>");
      },
    );
    const ui = makeUi({ parseMermaidImage });
    const result = (await import_mermaid(ui, {
      mermaid_source: FLOWCHART,
      mode: "embed",
      insert_mode: "add",
    })) as any;
    expect(parseMermaidImage).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.mode).toBe("embed");
    expect(result.xml).toContain("mermaidData");
  });

  it("uses parseMermaidDiagram with 5 args for native mode", async () => {
    const parseMermaidDiagram = jest.fn(
      (
        _source: string,
        _config: unknown,
        success: (xml: string) => void,
      ) => {
        success("<mxGraphModel><root/></mxGraphModel>");
      },
    );
    const ui = makeUi({ parseMermaidDiagram });
    const result = (await import_mermaid(ui, {
      mermaid_source: FLOWCHART,
      mode: "native",
      insert_mode: "add",
    })) as any;
    expect(parseMermaidDiagram).toHaveBeenCalled();
    expect(result.mode).toBe("native");
  });
});
```

Note: the tests replace `import_diagram` behavior via a mock of `ui.editor.graph.model` — the real `import_diagram` calls into these. If the test fails because `import_diagram` needs more of the graph API, mock the missing methods with no-op stubs; do not rewrite the tool code.

- [ ] **Step 3: Implement `v30.ts`**

Create `packages/drawio-mcp-plugin/src/tools/import-mermaid/v30.ts`:
```ts
import type { ImportMermaidResult } from "./shared.js";
import { runInsertFlow, validateOptions } from "./shared.js";

export function import_mermaid(
  ui: any,
  options: Record<string, unknown>,
): Promise<ImportMermaidResult> {
  const validated = validateOptions(options);
  if ("success" in validated) return Promise.resolve(validated);

  const { source, mode, insertMode } = validated;

  if (typeof ui?.parseMermaidDiagram !== "function") {
    return Promise.resolve({
      success: false,
      message:
        "ui.parseMermaidDiagram is not available; this Draw.io build does not expose Mermaid support.",
    });
  }

  return new Promise((resolve) => {
    const { onXml, onError } = runInsertFlow(ui, mode, insertMode, resolve);
    try {
      if (mode === "embed" && typeof ui.parseMermaidImage === "function") {
        ui.parseMermaidImage(source, onXml, onError);
      } else {
        ui.parseMermaidDiagram(source, undefined, onXml, onError, onError);
      }
    } catch (err) {
      resolve({
        success: false,
        message: `parseMermaidDiagram threw: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  });
}
```

- [ ] **Step 4: Write the failing v29 test**

Create `packages/drawio-mcp-plugin/src/tools/import-mermaid/v29.test.ts`:
```ts
import { describe, expect, it, jest } from "@jest/globals";
import { import_mermaid } from "./v29.js";

const FLOWCHART = "graph TD\nA[Start] --> B[Stop]";

describe("import_mermaid v29", () => {
  it("passes enableParser=true for native mode", async () => {
    const parseMermaidDiagram = jest.fn(
      (
        _s: string,
        _cfg: unknown,
        success: (xml: string) => void,
        _err: unknown,
        _perr: unknown,
        enableParser: boolean,
      ) => {
        expect(enableParser).toBe(true);
        success("<mxGraphModel/>");
      },
    );
    const ui = {
      parseMermaidDiagram,
      editor: { graph: { model: { beginUpdate() {}, endUpdate() {}, getRoot: () => ({}), getChildAt: () => null } } },
    };
    const result = (await import_mermaid(ui, {
      mermaid_source: FLOWCHART,
      mode: "native",
      insert_mode: "add",
    })) as any;
    expect(parseMermaidDiagram).toHaveBeenCalled();
    expect(result.mode).toBe("native");
  });

  it("passes enableParser=false for embed mode", async () => {
    const parseMermaidDiagram = jest.fn(
      (
        _s: string,
        _cfg: unknown,
        success: (xml: string) => void,
        _err: unknown,
        _perr: unknown,
        enableParser: boolean,
      ) => {
        expect(enableParser).toBe(false);
        success("<mxGraphModel><UserObject mermaidData=\"{}\"/></mxGraphModel>");
      },
    );
    const ui = {
      parseMermaidDiagram,
      editor: { graph: { model: { beginUpdate() {}, endUpdate() {}, getRoot: () => ({}), getChildAt: () => null } } },
    };
    const result = (await import_mermaid(ui, {
      mermaid_source: FLOWCHART,
      mode: "embed",
      insert_mode: "add",
    })) as any;
    expect(result.mode).toBe("embed");
    expect(result.xml).toContain("mermaidData");
  });
});
```

- [ ] **Step 5: Implement `v29.ts`**

Create `packages/drawio-mcp-plugin/src/tools/import-mermaid/v29.ts`:
```ts
import type { ImportMermaidResult } from "./shared.js";
import { runInsertFlow, validateOptions } from "./shared.js";

export function import_mermaid(
  ui: any,
  options: Record<string, unknown>,
): Promise<ImportMermaidResult> {
  const validated = validateOptions(options);
  if ("success" in validated) return Promise.resolve(validated);

  const { source, mode, insertMode } = validated;
  if (typeof ui?.parseMermaidDiagram !== "function") {
    return Promise.resolve({
      success: false,
      message:
        "ui.parseMermaidDiagram is not available; this Draw.io build does not expose Mermaid support.",
    });
  }

  const enableParser = mode === "native";
  return new Promise((resolve) => {
    const { onXml, onError } = runInsertFlow(ui, mode, insertMode, resolve);
    try {
      ui.parseMermaidDiagram(
        source,
        undefined,
        onXml,
        onError,
        onError,
        enableParser,
      );
    } catch (err) {
      resolve({
        success: false,
        message: `parseMermaidDiagram threw: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  });
}
```

- [ ] **Step 6: Write dispatch shell**

Create `packages/drawio-mcp-plugin/src/tools/import-mermaid/index.ts`:
```ts
import { getDetectedDrawioVersion } from "../../drawio-compat/detect.js";
import { dispatchTool } from "../../drawio-compat/dispatch.js";
import { COMPAT_MATRIX } from "../../drawio-compat/matrix.js";
import type { ImportMermaidResult } from "./shared.js";

const TOOL_NAME = "import-mermaid";

export function import_mermaid(
  ui: any,
  options: Record<string, unknown>,
): Promise<ImportMermaidResult> {
  const detected = getDetectedDrawioVersion(ui);
  const outcome = dispatchTool(TOOL_NAME, detected, COMPAT_MATRIX);

  if (outcome === null) {
    // Should not happen — matrix.ts registers this tool. Defensive fallback:
    return Promise.resolve({
      success: false,
      message: `import-mermaid has no matrix entry; refusing to guess.`,
    });
  }

  switch (outcome.kind) {
    case "matched":
      return outcome.impl(ui, options) as Promise<ImportMermaidResult>;
    case "above-window": {
      const entries = COMPAT_MATRIX.versionedTools[TOOL_NAME] ?? [];
      const fallback = entries.at(-1);
      if (!fallback) {
        return Promise.resolve({
          success: false,
          message: `no impl available for drawio v${outcome.detected}`,
        });
      }
      return fallback.impl(ui, options) as Promise<ImportMermaidResult>;
    }
    case "below-floor":
      return Promise.resolve({
        success: false,
        message: `drawio v${outcome.detected} predates supported floor v${outcome.floor}. Upgrade drawio.`,
      });
    case "no-version":
      return Promise.resolve({
        success: false,
        message: `cannot detect drawio version (${outcome.reason}); pin a supported drawio build.`,
      });
  }
}
```

- [ ] **Step 7: Register the entries in `matrix.ts`**

Edit `packages/drawio-mcp-plugin/src/drawio-compat/matrix.ts`, replace the empty `versionedTools: {}` block with:
```ts
import { import_mermaid as importMermaidV29 } from "../tools/import-mermaid/v29.js";
import { import_mermaid as importMermaidV30 } from "../tools/import-mermaid/v30.js";
```
and:
```ts
versionedTools: {
  "import-mermaid": [
    {
      range: { min: "29.0.0", maxExclusive: "30.0.0" },
      impl: importMermaidV29,
    },
    {
      range: { min: "30.0.0", maxExclusive: null },
      impl: importMermaidV30,
    },
  ],
},
```

- [ ] **Step 8: Rewire `tool-registry.ts`**

Edit `packages/drawio-mcp-plugin/src/tool-registry.ts`. Change:
```ts
import {
  ...
  import_mermaid,
  ...
} from "./drawio-tools.js";
```
to remove `import_mermaid` from that import group, and add:
```ts
import { import_mermaid } from "./tools/import-mermaid/index.js";
```

- [ ] **Step 9: Delete old `import_mermaid` from `drawio-tools.ts`**

Edit `packages/drawio-mcp-plugin/src/drawio-tools.ts`. Remove:
- the `import_mermaid` function (currently around lines 153-252)
- the `ImportMermaidOptions` and `ImportMermaidResult` type aliases (moved to `shared.ts`)

Leave `import_diagram` intact — `shared.ts` imports it.

- [ ] **Step 10: Run unit tests**

```bash
cd packages/drawio-mcp-plugin && NODE_OPTIONS=--experimental-vm-modules npx jest src/tools/import-mermaid src/drawio-compat
```
Expected: PASS all v29, v30, matrix, dispatch tests.

- [ ] **Step 11: Build plugin and server**

```bash
pnpm --filter drawio-mcp-plugin run build
pnpm --filter drawio-mcp-server run build
```
Expected: no TS errors. `packages/drawio-mcp-server/build/plugin/mcp-plugin.js` refreshed.

- [ ] **Step 12: Run real-environment mermaid test**

```bash
cd packages/drawio-mcp-server && NODE_OPTIONS=--experimental-vm-modules npx jest build/real-environment/import-mermaid.test.js
```
Expected: PASS all 4 sub-tests.

- [ ] **Step 13: Commit**

```bash
git add packages/drawio-mcp-plugin packages/drawio-mcp-server/build
git reset packages/drawio-mcp-server/build
git commit -m "refactor(plugin): split import-mermaid into per-drawio-version impls"
```
(The reset step skips the build/ artefact if the repo does not commit it. Confirm via `git status` before committing.)

---

## Task 5: WS handshake carries `drawioVersion` + plugin reports mismatches

**Files:**
- Create: `packages/drawio-mcp-plugin/src/drawio-compat/report.ts`
- Create: `packages/drawio-mcp-plugin/src/drawio-compat/report.test.ts`
- Modify: `packages/drawio-mcp-plugin/src/plugin.ts` (or wherever the plugin sends its first WS payload) — call `reportCompatState` once on plugin bootstrap.
- Modify: `packages/drawio-mcp-plugin/src/types.ts` (if a message-type union exists) to add `compat_report`.

**Interfaces:**
- Consumes: `getDetectedDrawioVersion`, `dispatchTool`, `COMPAT_MATRIX`, `isBelowFloor`.
- Produces:
  - `type CompatReport = { drawioVersion: string | null; state: "ok" | "below-floor" | "above-window" | "no-version"; floor: string; detail?: string }`
  - `computeCompatReport(): CompatReport` — pure function returning the state from the current detection + matrix.
  - `sendCompatReport(send: (payload: unknown) => void, log: (msg: string) => void): CompatReport` — computes, sends `{ type: "compat_report", ...report }` via `send`, `console.log`s a summary, returns the report.

- [ ] **Step 1: Write the failing test**

Create `packages/drawio-mcp-plugin/src/drawio-compat/report.test.ts`:
```ts
import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { computeCompatReport, sendCompatReport } from "./report.js";
import { resetDetectedDrawioVersionCache } from "./detect.js";

const g = globalThis as any;

describe("computeCompatReport", () => {
  beforeEach(() => {
    delete g.EditorUi;
    resetDetectedDrawioVersionCache();
  });

  it("reports ok for supported version", () => {
    g.EditorUi = { VERSION: "30.2.6" };
    const r = computeCompatReport();
    expect(r.state).toBe("ok");
    expect(r.drawioVersion).toBe("30.2.6");
  });

  it("reports below-floor for old drawio", () => {
    g.EditorUi = { VERSION: "28.0.0" };
    const r = computeCompatReport();
    expect(r.state).toBe("below-floor");
    expect(r.floor).toBe("29.0.0");
  });

  it("reports no-version when detection fails", () => {
    const r = computeCompatReport();
    expect(r.state).toBe("no-version");
    expect(r.drawioVersion).toBeNull();
  });
});

describe("sendCompatReport", () => {
  beforeEach(() => {
    delete g.EditorUi;
    resetDetectedDrawioVersionCache();
  });

  it("emits a `compat_report` message", () => {
    g.EditorUi = { VERSION: "30.2.6" };
    const send = jest.fn();
    const log = jest.fn();
    const report = sendCompatReport(send, log);
    expect(send).toHaveBeenCalledWith({
      type: "compat_report",
      ...report,
    });
    expect(log).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
NODE_OPTIONS=--experimental-vm-modules npx jest src/drawio-compat/report.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement `report.ts`**

Create `packages/drawio-mcp-plugin/src/drawio-compat/report.ts`:
```ts
import { isBelowFloor, parseVersion } from "drawio-mcp-compat";
import { COMPAT_MATRIX } from "./matrix.js";
import { getDetectedDrawioVersion } from "./detect.js";

export type CompatReport = {
  readonly drawioVersion: string | null;
  readonly state: "ok" | "below-floor" | "above-window" | "no-version";
  readonly floor: string;
  readonly detail?: string;
};

export function computeCompatReport(): CompatReport {
  const detected = getDetectedDrawioVersion();
  if (!detected.ok) {
    return {
      drawioVersion: detected.raw,
      state: "no-version",
      floor: COMPAT_MATRIX.supportedFloor,
      detail: detected.reason,
    };
  }
  if (isBelowFloor(detected.semver, COMPAT_MATRIX.supportedFloor)) {
    return {
      drawioVersion: detected.raw,
      state: "below-floor",
      floor: COMPAT_MATRIX.supportedFloor,
    };
  }
  // "above-window" only fires for tools whose newest range is bounded. When
  // every tool ships an open-ended newest range, "ok" covers everything above
  // the floor.
  const anyBounded = Object.values(COMPAT_MATRIX.versionedTools).some(
    (entries) => entries.at(-1)?.range.maxExclusive !== null,
  );
  if (anyBounded) {
    // If any tool is bounded and detected version exceeds every tool's newest
    // range, mark above-window. Otherwise ok.
    const boundedFor = Object.entries(COMPAT_MATRIX.versionedTools).filter(
      ([, entries]) => entries.at(-1)?.range.maxExclusive !== null,
    );
    for (const [, entries] of boundedFor) {
      const newest = entries.at(-1)!;
      const max = parseVersion(newest.range.maxExclusive!);
      if (max) {
        // if detected.semver >= max we're above that tool's window
        if (
          detected.semver[0] > max[0] ||
          (detected.semver[0] === max[0] && detected.semver[1] > max[1]) ||
          (detected.semver[0] === max[0] &&
            detected.semver[1] === max[1] &&
            detected.semver[2] >= max[2])
        ) {
          return {
            drawioVersion: detected.raw,
            state: "above-window",
            floor: COMPAT_MATRIX.supportedFloor,
            detail: newest.range.min,
          };
        }
      }
    }
  }
  return {
    drawioVersion: detected.raw,
    state: "ok",
    floor: COMPAT_MATRIX.supportedFloor,
  };
}

export function sendCompatReport(
  send: (payload: unknown) => void,
  log: (message: string) => void = console.log.bind(console),
): CompatReport {
  const report = computeCompatReport();
  send({ type: "compat_report", ...report });
  log(
    `[drawio-mcp] drawio version: ${report.drawioVersion ?? "unknown"} — compat state: ${report.state} (floor: ${report.floor})`,
  );
  return report;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
NODE_OPTIONS=--experimental-vm-modules npx jest src/drawio-compat/report.test.ts
```
Expected: PASS.

- [ ] **Step 5: Wire into plugin bootstrap**

Locate the plugin bootstrap. Run:
```bash
grep -n 'websocket\|WebSocket\|send.*hello\|type.*hello' packages/drawio-mcp-plugin/src/plugin.ts packages/drawio-mcp-plugin/src/websocket.ts packages/drawio-mcp-plugin/src/bootstrap.ts 2>/dev/null | head
```
Expected: reveals where the WS `send()` is available. Add the following right after the WS `open` handler fires (or immediately after the plugin registers tools):

```ts
import { sendCompatReport } from "./drawio-compat/report.js";
// ...
sendCompatReport((payload) => ws.send(JSON.stringify(payload)));
```

Adjust exact call shape to the existing send function's API (some codebases use `bus.emit("...")`).

- [ ] **Step 6: Build**

```bash
pnpm --filter drawio-mcp-plugin run build
pnpm --filter drawio-mcp-server run build
```
Expected: clean.

- [ ] **Step 7: Real-environment sanity**

Run the mermaid test again to make sure the handshake addition did not break anything:
```bash
cd packages/drawio-mcp-server && NODE_OPTIONS=--experimental-vm-modules npx jest build/real-environment/import-mermaid.test.js
```
Expected: PASS all 4.

- [ ] **Step 8: Commit**

```bash
git add packages/drawio-mcp-plugin
git commit -m "feat(plugin): report drawio version + compat state on WS bootstrap"
```

---

## Task 6: Server reads cached drawio version

**Files:**
- Create: `packages/drawio-mcp-server/src/assets/version.ts`
- Create: `packages/drawio-mcp-server/src/assets/version.test.ts`

**Interfaces:**
- Produces: `readCachedDrawioVersion(assetRoot: string): Promise<string | null>` — reads `${assetRoot}/js/app.min.js`, greps first 200 KB for `EditorUi.VERSION="X.Y.Z"`, returns the semver head string.

- [ ] **Step 1: Write the failing test**

Create `packages/drawio-mcp-server/src/assets/version.test.ts`:
```ts
import { describe, expect, it } from "@jest/globals";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readCachedDrawioVersion } from "./version.js";

function makeFixture(contents: string): string {
  const root = mkdtempSync(join(tmpdir(), "drawio-version-"));
  const jsDir = join(root, "js");
  mkdirSync(jsDir, { recursive: true });
  writeFileSync(join(jsDir, "app.min.js"), contents);
  return root;
}

describe("readCachedDrawioVersion", () => {
  it("returns the version parsed from app.min.js", async () => {
    const root = makeFixture(`prefix;EditorUi.VERSION="30.2.6";suffix`);
    await expect(readCachedDrawioVersion(root)).resolves.toBe("30.2.6");
  });

  it("returns null when app.min.js is missing", async () => {
    const root = mkdtempSync(join(tmpdir(), "drawio-version-"));
    await expect(readCachedDrawioVersion(root)).resolves.toBeNull();
  });

  it("returns null when VERSION assignment is absent", async () => {
    const root = makeFixture("no version marker here");
    await expect(readCachedDrawioVersion(root)).resolves.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/drawio-mcp-server && pnpm run build
NODE_OPTIONS=--experimental-vm-modules npx jest build/assets/version.test.js
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `version.ts`**

Create `packages/drawio-mcp-server/src/assets/version.ts`:
```ts
import { existsSync } from "node:fs";
import { open } from "node:fs/promises";
import { join } from "node:path";

const HEAD_BYTES = 200_000;
const VERSION_RE = /EditorUi\.VERSION\s*=\s*"(\d+\.\d+\.\d+)"/;

export async function readCachedDrawioVersion(
  assetRoot: string,
): Promise<string | null> {
  const path = join(assetRoot, "js", "app.min.js");
  if (!existsSync(path)) return null;
  const handle = await open(path, "r");
  try {
    const buf = Buffer.alloc(HEAD_BYTES);
    const { bytesRead } = await handle.read(buf, 0, HEAD_BYTES, 0);
    const text = buf.subarray(0, bytesRead).toString("utf8");
    const match = VERSION_RE.exec(text);
    return match?.[1] ?? null;
  } finally {
    await handle.close();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm run build
NODE_OPTIONS=--experimental-vm-modules npx jest build/assets/version.test.js
```
Expected: PASS 3 tests.

- [ ] **Step 5: Lint**

```bash
pnpm run lint
```
Expected: no violations (no console usage added).

- [ ] **Step 6: Commit**

```bash
git add packages/drawio-mcp-server
git commit -m "feat(server): parse cached drawio EditorUi.VERSION from app.min.js"
```

---

## Task 7: Server-side auto-refresh + matrix mirror

**Files:**
- Create: `packages/drawio-mcp-server/src/drawio-compat/matrix.ts`
- Create: `packages/drawio-mcp-server/src/assets/auto-refresh.ts`
- Create: `packages/drawio-mcp-server/src/assets/auto-refresh.test.ts`
- Modify: `packages/drawio-mcp-server/src/assets/index.ts` (or wherever `ensureAssets` lives) — chain into `ensureSupportedAssets` when Editor mode is on.
- Modify: `packages/drawio-mcp-server/package.json` — add `drawio-mcp-compat` as workspace dep.

**Interfaces:**
- Consumes: `Semver`, `VersionRange`, `parseVersion`, `isBelowFloor`, `isInRange` from `drawio-mcp-compat`; `readCachedDrawioVersion` from Task 6; existing `downloadAndExtractAssets`, `getCacheDir`, `getAssetRoot`.
- Produces:
  - `SERVER_COMPAT_MATRIX: { supportedFloor: string; supportedRanges: readonly VersionRange[] }` — single union range list (server does not know per-tool splits).
  - `versionInWindow(v: string): boolean` — true iff `v` parses AND any range contains it.
  - `ensureSupportedAssets(config, matrix, log, downloader): Promise<{ version: string | null; refetched: boolean }>` — injectable `downloader` so tests do not hit the network.

- [ ] **Step 1: Write server matrix mirror**

Create `packages/drawio-mcp-server/src/drawio-compat/matrix.ts`:
```ts
import { isInRange, parseVersion, type VersionRange } from "drawio-mcp-compat";

export type ServerCompatMatrix = {
  readonly supportedFloor: string;
  readonly supportedRanges: readonly VersionRange[];
};

export const SERVER_COMPAT_MATRIX: ServerCompatMatrix = {
  supportedFloor: "29.0.0",
  supportedRanges: [
    { min: "29.0.0", maxExclusive: "30.0.0" },
    { min: "30.0.0", maxExclusive: null },
  ],
};

export function versionInWindow(
  version: string,
  matrix: ServerCompatMatrix,
): boolean {
  const parsed = parseVersion(version);
  if (!parsed) return false;
  return matrix.supportedRanges.some((r) => isInRange(parsed, r));
}
```

- [ ] **Step 2: Add workspace dep**

Edit `packages/drawio-mcp-server/package.json` to add:
```json
"drawio-mcp-compat": "workspace:*"
```
Then:
```bash
pnpm install
```
Expected: dep resolved.

- [ ] **Step 3: Write the failing auto-refresh test**

Create `packages/drawio-mcp-server/src/assets/auto-refresh.test.ts`:
```ts
import { describe, expect, it, jest } from "@jest/globals";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureSupportedAssets } from "./auto-refresh.js";
import { SERVER_COMPAT_MATRIX } from "../drawio-compat/matrix.js";

function makeCachedVersion(version: string): string {
  const root = mkdtempSync(join(tmpdir(), "auto-refresh-"));
  const webapp = join(root, "webapp");
  const jsDir = join(webapp, "js");
  mkdirSync(jsDir, { recursive: true });
  writeFileSync(
    join(jsDir, "app.min.js"),
    `pre;EditorUi.VERSION="${version}";post`,
  );
  return root;
}

const logger = {
  log: jest.fn(),
} as any;

describe("ensureSupportedAssets", () => {
  it("returns cached version without refetch when in range", async () => {
    const cacheDir = makeCachedVersion("30.2.6");
    const download = jest.fn();
    const result = await ensureSupportedAssets(
      { assetPath: cacheDir },
      SERVER_COMPAT_MATRIX,
      logger,
      { downloadAndExtract: download },
    );
    expect(download).not.toHaveBeenCalled();
    expect(result).toEqual({ version: "30.2.6", refetched: false });
  });

  it("wipes cache and re-downloads when cached is out of window", async () => {
    const cacheDir = makeCachedVersion("28.0.0");
    const download = jest.fn(async (target: string) => {
      const jsDir = join(target, "webapp", "js");
      mkdirSync(jsDir, { recursive: true });
      writeFileSync(
        join(jsDir, "app.min.js"),
        `pre;EditorUi.VERSION="30.2.6";post`,
      );
    });
    const result = await ensureSupportedAssets(
      { assetPath: cacheDir },
      SERVER_COMPAT_MATRIX,
      logger,
      { downloadAndExtract: download },
    );
    expect(download).toHaveBeenCalled();
    expect(result).toEqual({ version: "30.2.6", refetched: true });
  });

  it("logs error when refetched version is still out of window", async () => {
    const cacheDir = makeCachedVersion("28.0.0");
    const download = jest.fn(async (target: string) => {
      const jsDir = join(target, "webapp", "js");
      mkdirSync(jsDir, { recursive: true });
      writeFileSync(
        join(jsDir, "app.min.js"),
        `pre;EditorUi.VERSION="28.5.0";post`,
      );
    });
    const errorLogs: unknown[] = [];
    const trackingLogger = {
      log: (level: string, ...args: unknown[]) => {
        if (level === "error") errorLogs.push(args);
      },
    } as any;
    await ensureSupportedAssets(
      { assetPath: cacheDir },
      SERVER_COMPAT_MATRIX,
      trackingLogger,
      { downloadAndExtract: download },
    );
    expect(errorLogs.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

```bash
pnpm run build
NODE_OPTIONS=--experimental-vm-modules npx jest build/assets/auto-refresh.test.js
```
Expected: FAIL — module missing.

- [ ] **Step 5: Implement `auto-refresh.ts`**

Create `packages/drawio-mcp-server/src/assets/auto-refresh.ts`:
```ts
import { rmSync } from "node:fs";
import { join } from "node:path";
import type { Logger } from "../types.js";
import {
  SERVER_COMPAT_MATRIX,
  versionInWindow,
  type ServerCompatMatrix,
} from "../drawio-compat/matrix.js";
import { getAssetRoot, getCacheDir, type AssetConfig } from "./manager.js";
import { readCachedDrawioVersion } from "./version.js";

export type DownloaderPort = {
  downloadAndExtract: (targetDir: string, log?: Logger) => Promise<void>;
};

export async function ensureSupportedAssets(
  config: AssetConfig,
  matrix: ServerCompatMatrix,
  log: Logger,
  ports: DownloaderPort,
): Promise<{ version: string | null; refetched: boolean }> {
  const cacheDir = getCacheDir(config.assetPath);
  const assetRoot = getAssetRoot(config);
  const cached = await readCachedDrawioVersion(assetRoot);

  if (cached && versionInWindow(cached, matrix)) {
    return { version: cached, refetched: false };
  }

  log.log(
    "warning",
    `cached drawio v${cached ?? "?"} is outside supported window (>= v${matrix.supportedFloor}); refetching latest`,
  );
  rmSync(assetRoot, { recursive: true, force: true });
  await ports.downloadAndExtract(cacheDir, log);

  const after = await readCachedDrawioVersion(assetRoot);
  if (!after || !versionInWindow(after, matrix)) {
    log.log(
      "error",
      `drawio latest v${after ?? "?"} is still outside supported window; tools may misbehave`,
    );
  }
  return { version: after, refetched: true };
}

export { SERVER_COMPAT_MATRIX };
```

- [ ] **Step 6: Chain into `ensureAssets`**

Open `packages/drawio-mcp-server/src/assets/downloader.ts` (`ensureAssets` currently at lines 131-149). Wrap the return with the auto-refresh check for Editor mode. Change:
```ts
export async function ensureAssets(
  config: { readonly assetPath?: string },
  log: Logger,
): Promise<{ readonly assetRoot: string; readonly isLocal: boolean }> {
  const { getCacheDir, getAssetRoot, assetsExist } =
    await import("./manager.js");

  const cacheDir = getCacheDir(config.assetPath);
  const assetRoot = getAssetRoot(config);

  if (!assetsExist(config)) {
    log.log("info", `Assets not found in ${assetRoot}. Downloading...`);
    await downloadAndExtractAssets(cacheDir, log);
  }

  return { assetRoot, isLocal: true };
}
```
to also call `ensureSupportedAssets`:
```ts
export async function ensureAssets(
  config: { readonly assetPath?: string },
  log: Logger,
): Promise<{ readonly assetRoot: string; readonly isLocal: boolean }> {
  const { getCacheDir, getAssetRoot, assetsExist } =
    await import("./manager.js");
  const { ensureSupportedAssets, SERVER_COMPAT_MATRIX } = await import(
    "./auto-refresh.js"
  );

  const cacheDir = getCacheDir(config.assetPath);
  const assetRoot = getAssetRoot(config);

  if (!assetsExist(config)) {
    log.log("info", `Assets not found in ${assetRoot}. Downloading...`);
    await downloadAndExtractAssets(cacheDir, log);
  }

  await ensureSupportedAssets(config, SERVER_COMPAT_MATRIX, log, {
    downloadAndExtract: downloadAndExtractAssets,
  });

  return { assetRoot, isLocal: true };
}
```

- [ ] **Step 7: Run tests + lint**

```bash
pnpm run build
NODE_OPTIONS=--experimental-vm-modules npx jest build/assets/
pnpm run lint
```
Expected: PASS. No new console violations.

- [ ] **Step 8: Prefetch smoke check**

```bash
rm -rf ~/.cache/drawio-mcp-server
pnpm run prefetch-assets
```
Expected: downloads latest, warns/no-warns depending on version, exits 0.

- [ ] **Step 9: Commit**

```bash
git add packages/drawio-mcp-server
git commit -m "feat(server): auto-refresh drawio assets when out of supported window"
```

---

## Task 8: Server logs plugin's compat report

**Files:**
- Create: `packages/drawio-mcp-server/src/drawio-compat/log-report.ts`
- Create: `packages/drawio-mcp-server/src/drawio-compat/log-report.test.ts`
- Modify: `packages/drawio-mcp-server/src/index.ts` (or wherever WS message routing lives — find via `grep -n 'type.*hello\|drawioVersion\|onMessage' packages/drawio-mcp-server/src/**/*.ts`) — wire `handleCompatReport` into the WS message dispatch.

**Interfaces:**
- Consumes: `SERVER_COMPAT_MATRIX`, `versionInWindow`, `Logger`.
- Produces: `handleCompatReport(payload: { drawioVersion: string | null; state: string; floor: string; detail?: string }, log: Logger): void` — emits `error` / `warning` / `info` per state.

- [ ] **Step 1: Write the failing test**

Create `packages/drawio-mcp-server/src/drawio-compat/log-report.test.ts`:
```ts
import { describe, expect, it, jest } from "@jest/globals";
import { handleCompatReport } from "./log-report.js";

function makeLogger() {
  const calls: Array<[string, string]> = [];
  return {
    calls,
    logger: { log: (lvl: string, msg: string) => calls.push([lvl, msg]) } as any,
  };
}

describe("handleCompatReport", () => {
  it("emits info for ok state", () => {
    const { calls, logger } = makeLogger();
    handleCompatReport(
      { drawioVersion: "30.2.6", state: "ok", floor: "29.0.0" },
      logger,
    );
    expect(calls.some(([lvl]) => lvl === "info")).toBe(true);
  });

  it("emits error for below-floor state", () => {
    const { calls, logger } = makeLogger();
    handleCompatReport(
      { drawioVersion: "28.0.0", state: "below-floor", floor: "29.0.0" },
      logger,
    );
    expect(calls.some(([lvl]) => lvl === "error")).toBe(true);
  });

  it("emits warning for above-window state", () => {
    const { calls, logger } = makeLogger();
    handleCompatReport(
      {
        drawioVersion: "31.0.0",
        state: "above-window",
        floor: "29.0.0",
        detail: "30.0.0",
      },
      logger,
    );
    expect(calls.some(([lvl]) => lvl === "warning")).toBe(true);
  });

  it("emits warning for no-version state", () => {
    const { calls, logger } = makeLogger();
    handleCompatReport(
      { drawioVersion: null, state: "no-version", floor: "29.0.0", detail: "missing" },
      logger,
    );
    expect(calls.some(([lvl]) => lvl === "warning")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm run build
NODE_OPTIONS=--experimental-vm-modules npx jest build/drawio-compat/log-report.test.js
```
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `log-report.ts`**

Create `packages/drawio-mcp-server/src/drawio-compat/log-report.ts`:
```ts
import type { Logger } from "../types.js";

export type CompatReportPayload = {
  readonly drawioVersion: string | null;
  readonly state: "ok" | "below-floor" | "above-window" | "no-version" | string;
  readonly floor: string;
  readonly detail?: string;
};

export function handleCompatReport(
  payload: CompatReportPayload,
  log: Logger,
): void {
  const v = payload.drawioVersion ?? "unknown";
  switch (payload.state) {
    case "ok":
      log.log("info", `drawio v${v} is within supported window`);
      return;
    case "below-floor":
      log.log(
        "error",
        `drawio v${v} predates supported floor v${payload.floor}; ` +
          `version-gated tools will return errors`,
      );
      return;
    case "above-window":
      log.log(
        "warning",
        `drawio v${v} is newer than the tested window ` +
          `(last tested min: v${payload.detail ?? "?"}); running on newest impl`,
      );
      return;
    case "no-version":
      log.log(
        "warning",
        `plugin could not detect drawio version (${payload.detail ?? "?"})`,
      );
      return;
    default:
      log.log(
        "warning",
        `unknown compat state \`${payload.state}\` (drawio v${v})`,
      );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm run build
NODE_OPTIONS=--experimental-vm-modules npx jest build/drawio-compat/log-report.test.js
```
Expected: PASS.

- [ ] **Step 5: Wire into WS message dispatch**

Run:
```bash
grep -rn 'onMessage\|handleMessage\|ws.on(.message.\|type === ' packages/drawio-mcp-server/src/ | head -10
```
Locate the WS message handler. Add the case:
```ts
case "compat_report":
  handleCompatReport(payload as any, log);
  return;
```
Where `log` is the injected `AppLogger`/`Logger` already in scope. Do not add `console.*`.

- [ ] **Step 6: Lint**

```bash
pnpm run lint
```
Expected: no `noConsole` violations (`log-report.ts` uses only `Logger.log`).

- [ ] **Step 7: Real-environment run**

```bash
NODE_OPTIONS=--experimental-vm-modules npx jest build/real-environment/import-mermaid.test.js
```
Expected: PASS. The extra WS message is a no-op unless the server side wires it in — which it now does.

- [ ] **Step 8: Commit**

```bash
git add packages/drawio-mcp-server
git commit -m "feat(server): log compat report from plugin handshake"
```

---

## Task 9: Extension background stores `CompatState`

**Files:**
- Modify: `packages/drawio-mcp-extension/entrypoints/background.ts` (or wherever the background bridge lives — locate via `grep -rn 'CONNECTION_STATE\|onMessage' packages/drawio-mcp-extension/entrypoints/`)

**Interfaces:**
- Produces:
  - `type CompatState = { kind: "unknown" } | { kind: "ok"; version: string } | { kind: "below-floor"; version: string; floor: string } | { kind: "above-window"; version: string; lastSupportedMin: string } | { kind: "no-version"; reason: "missing" | "unparseable" }`
  - `GET_COMPAT_STATE` message returning current `CompatState`.
  - `COMPAT_STATE_UPDATE` broadcast to popup on change.

- [ ] **Step 1: Locate connection-state pattern**

Run:
```bash
grep -n 'CONNECTION_STATE\|connectionState' packages/drawio-mcp-extension/entrypoints/background.ts
```
Expected: shows the exact shape of the existing connection-state bridge. Mirror it for compat state.

- [ ] **Step 2: Add `CompatState` alongside connection state**

Edit `packages/drawio-mcp-extension/entrypoints/background.ts`. Add:
```ts
type CompatState =
  | { kind: "unknown" }
  | { kind: "ok"; version: string }
  | { kind: "below-floor"; version: string; floor: string }
  | { kind: "above-window"; version: string; lastSupportedMin: string }
  | { kind: "no-version"; reason: "missing" | "unparseable" };

let compatState: CompatState = { kind: "unknown" };

function updateCompatState(next: CompatState) {
  compatState = next;
  browser.runtime.sendMessage({ type: "COMPAT_STATE_UPDATE", state: next }).catch(() => {
    // popup not open — ignored
  });
}
```

- [ ] **Step 3: Handle `compat_report` from the injected plugin bridge**

Find where the background receives WS or content-script messages from the plugin. Add a case that translates `type: "compat_report"` into a `CompatState`:
```ts
if (message.type === "compat_report") {
  const { drawioVersion, state, floor, detail } = message;
  switch (state) {
    case "ok":
      updateCompatState({ kind: "ok", version: drawioVersion });
      break;
    case "below-floor":
      updateCompatState({ kind: "below-floor", version: drawioVersion, floor });
      break;
    case "above-window":
      updateCompatState({
        kind: "above-window",
        version: drawioVersion,
        lastSupportedMin: detail ?? "",
      });
      break;
    case "no-version":
      updateCompatState({ kind: "no-version", reason: detail ?? "missing" });
      break;
  }
  return;
}
```

- [ ] **Step 4: Handle `GET_COMPAT_STATE` from the popup**

Add:
```ts
if (message.type === "GET_COMPAT_STATE") {
  return Promise.resolve({ state: compatState });
}
```
(Match the exact `browser.runtime.onMessage` signature already used by `GET_CONNECTION_STATE`.)

- [ ] **Step 5: Build extension**

```bash
pnpm --filter drawio-mcp-extension run build
```
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add packages/drawio-mcp-extension
git commit -m "feat(extension): track drawio compat state in background"
```

---

## Task 10: Extension popup `CompatBanner`

**Files:**
- Create: `packages/drawio-mcp-extension/entrypoints/popup/CompatBanner.tsx`
- Create: `packages/drawio-mcp-extension/entrypoints/popup/CompatBanner.test.tsx`
- Modify: `packages/drawio-mcp-extension/entrypoints/popup/App.tsx` — render `<CompatBanner state={compatState} />` above the logo; subscribe to updates via `GET_COMPAT_STATE` + `COMPAT_STATE_UPDATE`.

**Interfaces:**
- Consumes: same `CompatState` type from Task 9.
- Produces: `<CompatBanner state={CompatState} />` renders nothing for `ok`/`unknown`; a coloured strip for the other three variants.

- [ ] **Step 1: Write the failing render tests**

Create `packages/drawio-mcp-extension/entrypoints/popup/CompatBanner.test.tsx`:
```tsx
import { describe, expect, it } from "@jest/globals";
import { render } from "@testing-library/react";
import { CompatBanner } from "./CompatBanner.js";

describe("CompatBanner", () => {
  it("renders nothing for ok state", () => {
    const { container } = render(
      <CompatBanner state={{ kind: "ok", version: "30.2.6" }} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders red banner for below-floor", () => {
    const { getByText, container } = render(
      <CompatBanner
        state={{ kind: "below-floor", version: "28.0.0", floor: "29.0.0" }}
      />,
    );
    expect(getByText(/predates the supported floor/i)).toBeTruthy();
    const banner = container.querySelector("[data-variant='error']");
    expect(banner).not.toBeNull();
  });

  it("renders amber banner for above-window", () => {
    const { container } = render(
      <CompatBanner
        state={{ kind: "above-window", version: "31.5.0", lastSupportedMin: "30.0.0" }}
      />,
    );
    expect(container.querySelector("[data-variant='warning']")).not.toBeNull();
  });

  it("renders grey banner for no-version", () => {
    const { container } = render(
      <CompatBanner state={{ kind: "no-version", reason: "missing" }} />,
    );
    expect(container.querySelector("[data-variant='info']")).not.toBeNull();
  });
});
```

- [ ] **Step 2: Confirm testing-library is available**

Run:
```bash
grep -E 'testing-library' packages/drawio-mcp-extension/package.json
```
If not present, add to `devDependencies`:
```json
"@testing-library/react": "catalog:",
"jest-environment-jsdom": "catalog:"
```
and set `testEnvironment: "jsdom"` in the extension's Jest config. If the extension has no Jest config yet, colocate the test with the component and add a minimal `jest.config.js` at package root. If the extension does not use Jest at all, skip the .test.tsx and add a lightweight snapshot check via WXT's built-in framework — but that changes tooling scope; prefer the Jest path.

- [ ] **Step 3: Run test to verify it fails**

Run the extension test suite. Expected: FAIL — `CompatBanner` module missing.

- [ ] **Step 4: Implement `CompatBanner.tsx`**

Create:
```tsx
type CompatState =
  | { kind: "unknown" }
  | { kind: "ok"; version: string }
  | { kind: "below-floor"; version: string; floor: string }
  | { kind: "above-window"; version: string; lastSupportedMin: string }
  | { kind: "no-version"; reason: "missing" | "unparseable" };

const BASE_STYLE: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 4,
  marginBottom: 12,
  fontSize: 12,
  lineHeight: 1.4,
};

const VARIANTS = {
  error: { background: "#f8d7da", color: "#842029", border: "1px solid #f5c2c7" },
  warning: { background: "#fff3cd", color: "#664d03", border: "1px solid #ffecb5" },
  info: { background: "#e9ecef", color: "#495057", border: "1px solid #ced4da" },
} as const;

export function CompatBanner({ state }: { state: CompatState }) {
  if (state.kind === "ok" || state.kind === "unknown") return null;

  if (state.kind === "below-floor") {
    return (
      <div style={{ ...BASE_STYLE, ...VARIANTS.error }} data-variant="error">
        <strong>drawio v{state.version}</strong> predates the supported floor
        v{state.floor}. MCP tools that need v{state.floor}+ will return errors.
        Reload drawio with cache cleared, or upgrade your self-hosted drawio.
      </div>
    );
  }

  if (state.kind === "above-window") {
    return (
      <div style={{ ...BASE_STYLE, ...VARIANTS.warning }} data-variant="warning">
        <strong>drawio v{state.version}</strong> is newer than the tested window
        (last tested min: v{state.lastSupportedMin}). Tools run on the closest
        impl; please report issues.
      </div>
    );
  }

  return (
    <div style={{ ...BASE_STYLE, ...VARIANTS.info }} data-variant="info">
      Cannot detect drawio version (<code>{state.reason}</code>).
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run the extension test suite. Expected: PASS.

- [ ] **Step 6: Wire into `App.tsx`**

Edit `packages/drawio-mcp-extension/entrypoints/popup/App.tsx`. Add near the existing `useState<ConnectionState>` block:
```tsx
const [compatState, setCompatState] = useState<CompatState>({ kind: "unknown" });

useEffect(() => {
  browser.runtime.sendMessage({ type: "GET_COMPAT_STATE" })
    .then((response) => { if (response?.state) setCompatState(response.state); })
    .catch((error) => console.error("compat state fetch failed:", error));

  const listener = (message: any) => {
    if (message.type === "COMPAT_STATE_UPDATE") setCompatState(message.state);
    return true;
  };
  browser.runtime.onMessage.addListener(listener);
  return () => browser.runtime.onMessage.removeListener(listener);
}, []);
```
Render `<CompatBanner state={compatState} />` at the top of the returned JSX, above the logo.

Import: `import { CompatBanner } from "./CompatBanner.js";`

- [ ] **Step 7: Build the extension**

```bash
pnpm --filter drawio-mcp-extension run build
```
Expected: clean.

- [ ] **Step 8: Manual smoke test (optional but recommended)**

Load the built extension into a browser, open drawio, open the popup — banner should say "ok" (nothing visible) if drawio is v30.x. Downgrade drawio (or override `EditorUi.VERSION` via devtools) to a v28 string, reopen the popup — red banner appears.

- [ ] **Step 9: Commit**

```bash
git add packages/drawio-mcp-extension
git commit -m "feat(extension): compat banner in popup when drawio out of window"
```

---

## Task 11: End-to-end sanity + docs

**Files:**
- Modify: `packages/drawio-mcp-plugin/src/drawio-compat/README.md` (new) — one-page how-to for "add a new versioned tool".
- Modify: `AGENTS.md` — mention the compat matrix under "Codebase navigation".

**Interfaces:** none (docs only).

- [ ] **Step 1: Write `drawio-compat/README.md`**

Create `packages/drawio-mcp-plugin/src/drawio-compat/README.md`:
```markdown
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

`sendCompatReport(send, log)` sends `{ type: "compat_report", ... }` over the
existing WS channel and logs a summary line. The server's `handleCompatReport`
turns it into `AppLogger` calls; the extension background stores it as
`CompatState` for the popup banner.
```

- [ ] **Step 2: Add mention in `AGENTS.md`**

Append under "Codebase navigation":
```markdown
## drawio version compatibility

Plugin-side runtime version detection + per-tool dispatch lives in
`packages/drawio-mcp-plugin/src/drawio-compat/`. Add per-version tool impls
under `packages/drawio-mcp-plugin/src/tools/<tool>/{v29,v30,...}.ts` and
register them in `drawio-compat/matrix.ts`. See
`packages/drawio-mcp-plugin/src/drawio-compat/README.md`.
```

- [ ] **Step 3: Full test sweep**

```bash
pnpm --filter drawio-mcp-compat run test
pnpm --filter drawio-mcp-plugin run build
pnpm --filter drawio-mcp-server run build
pnpm --filter drawio-mcp-server run lint
cd packages/drawio-mcp-server && pnpm test
```
Expected: all suites green, no lint violations.

- [ ] **Step 4: Commit**

```bash
git add packages/drawio-mcp-plugin/src/drawio-compat/README.md AGENTS.md
git commit -m "docs(compat): how-to for adding versioned tools"
```

---

## Verification checklist (spec coverage)

- Section 1 (spec): shared `drawio-mcp-compat` package → Task 1.
- Section 2 (matrix shape + invariants) → Task 3 (matrix.ts + matrix.test.ts).
- Section 3 (detection + dispatch + wrapper) → Tasks 2, 3, 4.
- Section 4 (server auto-refresh + handshake mirror) → Tasks 6, 7, 8.
- Section 5 (extension banner) → Tasks 9, 10.
- Section 6 (tests + migration + docs) → all tasks + Task 11.

## Out of scope (per spec)

- Pinning a specific drawio version in `downloader.ts`.
- Extension-mode automatic drawio cache clearing (browser policy stops us).
- New logger output channels.
