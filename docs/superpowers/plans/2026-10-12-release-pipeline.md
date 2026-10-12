# Release Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `workflow_dispatch` "Release" form in the GitHub Actions UI (scope dropdown + optional version) that runs the whole release: coupled-file bumps, changelog, gates, bot commit to `main`, tags, GitHub Releases, npm publish, extension zips, CWS draft upload.

**Architecture:** One orchestrating `release.yml` (form → release job → reusable publish jobs) plus a `node --test`-driven `scripts/release/` module set (version resolution, changelog, coupled bumps, parity gate) exposed through a `scripts/release.mjs` CLI. Existing `server-publish.yml` / `extension-publish.yml` become `workflow_call`-invoked publish jobs called directly by `release.yml` (GITHUB_TOKEN-created releases do not fire `release:` events, so there is no event dependency).

**Tech Stack:** GitHub Actions (workflow_dispatch, workflow_call, pinned SHAs for actions, `GITHUB_TOKEN` for commit/tag/release), Node 24 ESM + `node:test`, `chrome-webstore-upload-cli` (pinned devDependency of the extension package), pnpm workspace.

**Spec:** `docs/superpowers/specs/2026-10-11-release-pipeline-design.md` — the plan argues from it; read it before executing.

## Global Constraints

- Server tags stay flat `vX.Y.Z`; extension tags are `drawio-mcp-extension-vX.Y.Z`. Root package (`private`) is never versioned.
- Version coupling: `drawio-mcp-server` and `drawio-mcp-plugin` bump in lockstep on every server release; the `VERSION` fallback literal in `packages/drawio-mcp-server/src/index.ts` matches the server version; `packages/drawio-mcp-compat` gets a patch bump on its own line only when its files changed since the last server tag; `packages/drawio-mcp-claude-plugin/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` share an independent version and are NOT touched by the pipeline.
- Scope `both` applies ONE version to both components; version must be strictly greater than every in-scope component's current version; must not collide with an existing tag.
- Store submission: CWS upload as draft only (no publish call); AMO not automated in v1 (zips on the Release page are the manual path).
- CWS upload guarded: skip when `CWS_*` secrets are absent; a failed CWS upload does not fail the publish job.
- All third-party actions pinned to full commit SHAs — reuse the existing repo pins, never introduce `@v5` refs.
- Conventional commits drive changelog + auto-version: `feat` → minor, `fix` → patch, `!` suffix (`feat!:`) → major, everything else → patch.
- The release commit is `chore(release): <version> [<scope>]`, author `github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>`, pushed to `main` directly.
- Before every commit: `npx prettier --check` (or `--write` then check) on the touched files must pass. Commit author `claude-code-zai-glm-5.3 <noreply@anthropic.com>`, Co-Authored-By `Ladislav Gazo <ladislav.gazo@gmail.com>`, conventional commit type, never mention "multica".

---

### Task 1: Version resolution module

**Files:**
- Create: `scripts/release/version.mjs`
- Create: `scripts/release/version.test.mjs`

**Interfaces:**
- Produces (ESM exports, consumed by `scripts/release.mjs` in Task 5):
  - `parseSemver(str) → {major, minor, patch} | null`
  - `cmpSemver(a, b) → -1 | 0 | 1` — `a`/`b` are parsed objects
  - `bumpLevel(commits) → "major" | "minor" | "patch"` — `commits` is `Array<{subject: string}>`
  - `bumpVersion(parsed, level) → string` — `parsed` is a parsed object, `level` a bump level
  - `resolveVersion({ scope, explicit, current, commits }) → { version, level, source }` — throws `Error` with a human message on validation failure. `scope` is `"server" | "extension" | "both"`; `explicit` is `string | null`; `current` is `{ server: string, extension: string }` (semver strings); `commits` is `Array<{subject, files}>` (already filtered to the scope's paths by the caller). Result: `version` is `X.Y.Z` string, `level` a bump level, `source` is `"explicit" | "computed"`.
  - `validateTags({ scope, version, existingTags }) → void` — throws if tags this scope would create already exist: `v<version>` for server/both, `drawio-mcp-extension-v<version>` for extension/both.

- [ ] **Step 1: Write the failing test** — `scripts/release/version.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  parseSemver,
  cmpSemver,
  bumpLevel,
  bumpVersion,
  resolveVersion,
  validateTags,
} from "./version.mjs";

test("parseSemver accepts strict X.Y.Z and rejects the rest", () => {
  assert.deepEqual(parseSemver("2.3.0"), { major: 2, minor: 3, patch: 0 });
  assert.equal(parseSemver("v2.3.0"), null);
  assert.equal(parseSemver("2.3"), null);
  assert.equal(parseSemver("2.3.0-beta"), null);
});

test("cmpSemver orders versions", () => {
  const a = parseSemver("2.9.0");
  const b = parseSemver("2.10.0");
  assert.equal(cmpSemver(a, b), -1);
  assert.equal(cmpSemver(b, a), 1);
  assert.equal(cmpSemver(a, parseSemver("2.9.0")), 0);
});

test("bumpLevel reads conventional commit subjects", () => {
  assert.equal(bumpLevel([{ subject: "feat: x" }]), "minor");
  assert.equal(bumpLevel([{ subject: "fix(server): y" }]), "patch");
  assert.equal(bumpLevel([{ subject: "feat!: breaking" }]), "major");
  assert.equal(bumpLevel([{ subject: "feat: a" }, { subject: "fix: b" }]), "minor");
  assert.equal(bumpLevel([{ subject: "feat!: a" }, { subject: "fix: b" }]), "major");
  assert.equal(bumpLevel([{ subject: "docs: a" }]), "patch");
  assert.equal(bumpLevel([]), "patch");
});

test("bumpVersion increments the right digit", () => {
  const base = parseSemver("2.3.4");
  assert.equal(bumpVersion(base, "patch"), "2.3.5");
  assert.equal(bumpVersion(base, "minor"), "2.4.0");
  assert.equal(bumpVersion(base, "major"), "3.0.0");
});

test("resolveVersion computed for server scope bumps the server line", () => {
  const r = resolveVersion({
    scope: "server",
    explicit: null,
    current: { server: "2.3.0", extension: "2.3.0" },
    commits: [
      { subject: "feat: new tool", files: ["packages/drawio-mcp-server/src/x.ts"] },
    ],
  });
  assert.deepEqual(r, { version: "2.4.0", level: "minor", source: "computed" });
});

test("resolveVersion computed for extension scope bumps the extension line", () => {
  const r = resolveVersion({
    scope: "extension",
    explicit: null,
    current: { server: "2.4.0", extension: "2.3.0" },
    commits: [
      { subject: "feat: ui", files: ["packages/drawio-mcp-extension/x.ts"] },
    ],
  });
  assert.deepEqual(r, { version: "2.4.0", level: "minor", source: "computed" });
});

test("resolveVersion both scope computes from the server line", () => {
  const r = resolveVersion({
    scope: "both",
    explicit: null,
    current: { server: "2.4.0", extension: "2.3.0" },
    commits: [
      { subject: "feat: shared", files: ["packages/drawio-mcp-plugin/src/x.ts"] },
    ],
  });
  assert.equal(r.version, "2.5.0");
});

test("resolveVersion explicit override wins and validates monotonicity", () => {
  const ok = resolveVersion({
    scope: "both",
    explicit: "3.0.0",
    current: { server: "2.4.0", extension: "2.3.0" },
    commits: [],
  });
  assert.deepEqual(ok, { version: "3.0.0", level: "major", source: "explicit" });

  assert.throws(() =>
    resolveVersion({
      scope: "both",
      explicit: "2.3.0",
      current: { server: "2.4.0", extension: "2.3.0" },
      commits: [],
    }),
  );
  assert.throws(() =>
    resolveVersion({
      scope: "both",
      explicit: "not-semver",
      current: { server: "2.4.0", extension: "2.3.0" },
      commits: [],
    }),
  );
});

test("resolveVersion computed with zero relevant commits fails", () => {
  assert.throws(() =>
    resolveVersion({
      scope: "server",
      explicit: null,
      current: { server: "2.3.0", extension: "2.3.0" },
      commits: [],
    }),
  );
});

test("validateTags rejects existing tags for the scope", () => {
  assert.throws(() =>
    validateTags({ scope: "both", version: "2.4.0", existingTags: ["v2.4.0"] }),
  );
  assert.throws(() =>
    validateTags({
      scope: "extension",
      version: "2.4.0",
      existingTags: ["drawio-mcp-extension-v2.4.0"],
    }),
  );
  validateTags({ scope: "server", version: "2.4.0", existingTags: ["v2.3.0"] });
  validateTags({ scope: "extension", version: "2.4.0", existingTags: ["v2.4.0"] });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/release/version.test.mjs`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `scripts/release/version.mjs`**

```js
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

export function parseSemver(str) {
  const m = SEMVER.exec(String(str ?? ""));
  return m
    ? { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) }
    : null;
}

export function cmpSemver(a, b) {
  for (const part of ["major", "minor", "patch"]) {
    if (a[part] !== b[part]) return a[part] < b[part] ? -1 : 1;
  }
  return 0;
}

export function bumpLevel(commits) {
  let level = "patch";
  for (const { subject } of commits) {
    const m = /^(\w+)!?:/.exec(subject);
    if (!m) continue;
    if (subject.includes("!")) return "major";
    if (m[1] === "feat") level = "minor";
  }
  return level;
}

export function bumpVersion(parsed, level) {
  if (level === "major") return `${parsed.major + 1}.0.0`;
  if (level === "minor") return `${parsed.major}.${parsed.minor + 1}.0`;
  return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
}

export function resolveVersion({ scope, explicit, current, commits }) {
  const level = bumpLevel(commits);
  let version;
  let source;
  if (explicit) {
    const parsed = parseSemver(explicit);
    if (!parsed) throw new Error(`invalid semver: "${explicit}" (expected X.Y.Z)`);
    version = `${parsed.major}.${parsed.minor}.${parsed.patch}`;
    source = "explicit";
  } else {
    if (commits.length === 0) {
      throw new Error(
        `no commits found for scope "${scope}" since the last release; pass an explicit --version if you really want to release`,
      );
    }
    const base =
      scope === "extension"
        ? parseSemver(current.extension)
        : parseSemver(current.server);
    version = bumpVersion(base, level);
    source = "computed";
  }

  const parsed = parseSemver(version);
  const floors = [];
  if (scope !== "extension") floors.push(["drawio-mcp-server", current.server]);
  if (scope !== "server") floors.push(["drawio-mcp-extension", current.extension]);
  for (const [name, cur] of floors) {
    if (cmpSemver(parsed, parseSemver(cur)) <= 0) {
      throw new Error(`version ${version} is not greater than ${name}'s current ${cur}`);
    }
  }
  return { version, level, source };
}

export function validateTags({ scope, version, existingTags }) {
  const wanted = [];
  if (scope !== "extension") wanted.push(`v${version}`);
  if (scope !== "server") wanted.push(`drawio-mcp-extension-v${version}`);
  for (const tag of wanted) {
    if (existingTags.includes(tag)) throw new Error(`tag ${tag} already exists`);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test scripts/release/version.test.mjs`
Expected: PASS (all tests).

- [ ] **Step 5: Prettier + commit**

```bash
npx prettier --write scripts/release/version.mjs scripts/release/version.test.mjs
node --test scripts/release/version.test.mjs   # still green after formatting
git add scripts/release/version.mjs scripts/release/version.test.mjs
git commit --author="claude-code-zai-glm-5.3 <noreply@anthropic.com>" -m "feat(scripts): version resolution for the release pipeline

Co-Authored-By: Ladislav Gazo <ladislav.gazo@gmail.com>"
```

---

### Task 2: Changelog module

**Files:**
- Create: `scripts/release/changelog.mjs`
- Create: `scripts/release/changelog.test.mjs`

**Interfaces:**
- Produces: `generateChangelog({ version, commits }) → string` — `commits` is `Array<{subject: string, hash: string}>` already filtered to the scope. Output: `## <version>` heading, then one `### <Group>` section per non-empty group in the fixed order Features / Bug Fixes / Documentation / Chores, entries `- <subject> (<hash>)` in commit order. Empty groups omitted. Trailing newline.

- [ ] **Step 1: Write the failing test** — `scripts/release/changelog.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { generateChangelog } from "./changelog.mjs";

test("groups conventional commits and omits empty groups", () => {
  const md = generateChangelog({
    version: "2.4.0",
    commits: [
      { subject: "feat: new tool", hash: "abc1234" },
      { subject: "feat!: breaking change", hash: "777aaa1" },
      { subject: "fix(server): crash on close", hash: "def5678" },
      { subject: "docs: readme", hash: "9ab0123" },
      { subject: "chore: deps", hash: "bbb2222" },
    ],
  });
  assert.equal(
    md,
    `## 2.4.0

### Features

- feat: new tool (abc1234)
- feat!: breaking change (777aaa1)

### Bug Fixes

- fix(server): crash on close (def5678)

### Documentation

- docs: readme (9ab0123)

### Chores

- chore: deps (bbb2222)
`,
  );
});

test("non-conventional subjects land under Chores", () => {
  const md = generateChangelog({
    version: "1.0.1",
    commits: [{ subject: "Merge pull request #1", hash: "aaa1111" }],
  });
  assert.doesNotMatch(md, /### Features/);
  assert.match(md, /### Chores\n\n- Merge pull request #1 \(aaa1111\)/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/release/changelog.test.mjs`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `scripts/release/changelog.mjs`**

```js
const GROUPS = [
  ["Features", (type) => type === "feat"],
  ["Bug Fixes", (type) => type === "fix"],
  ["Documentation", (type) => type === "docs"],
];

function bucketOf(subject) {
  const m = /^(\w+)(\(!\))?:/.exec(subject);
  if (m) {
    const group = GROUPS.find(([, matches]) => matches(m[1]));
    if (group) return group[0];
  }
  return "Chores";
}

export function generateChangelog({ version, commits }) {
  const buckets = new Map();
  const seen = new Set();
  for (const commit of commits) {
    if (seen.has(commit.hash)) continue;
    seen.add(commit.hash);
    const bucket = bucketOf(commit.subject);
    if (!buckets.has(bucket)) buckets.set(bucket, []);
    buckets.get(bucket).push(`- ${commit.subject} (${commit.hash})`);
  }
  const order = [...GROUPS.map(([name]) => name), "Chores"];
  const lines = [`## ${version}`];
  for (const name of order) {
    const entries = buckets.get(name);
    if (!entries || entries.length === 0) continue;
    lines.push("", `### ${name}`, "", ...entries);
  }
  return lines.join("\n") + "\n";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test scripts/release/changelog.test.mjs`
Expected: PASS.

- [ ] **Step 5: Prettier + commit**

```bash
npx prettier --write scripts/release/changelog.mjs scripts/release/changelog.test.mjs
node --test scripts/release/changelog.test.mjs
git add scripts/release/changelog.mjs scripts/release/changelog.test.mjs
git commit --author="claude-code-zai-glm-5.3 <noreply@anthropic.com>" -m "feat(scripts): changelog generation for the release pipeline

Co-Authored-By: Ladislav Gazo <ladislav.gazo@gmail.com>"
```

---

### Task 3: Coupled-file bump module

**Files:**
- Create: `scripts/release/bump.mjs`
- Create: `scripts/release/bump.test.mjs`

**Interfaces:**
- Produces:
  - `getPackageVersion(file) → string`
  - `setPackageVersion(file, version) → void` — reads JSON, sets `version`, writes back `JSON.stringify(obj, null, 2) + "\n"`.
  - `getVersionConst(file) → string` — the quoted literal from `const VERSION = process.env.npm_package_version ?? "<literal>";`; throws if not found.
  - `setVersionConst(file, version) → void` — rewrites the literal; throws if the pattern does not appear exactly once.
  - `applyBumps({ root, scope, version, compatChanged }) → { changed: string[] }` — mutates files under `root`:
    - `scope` `"server"` or `"both"`: `packages/drawio-mcp-server/package.json` → version; `packages/drawio-mcp-plugin/package.json` → version (lockstep); `packages/drawio-mcp-server/src/index.ts` VERSION const → version; copy `README.md` → `packages/drawio-mcp-server/README.md`; if `compatChanged`, `packages/drawio-mcp-compat/package.json` gets a **patch bump on its own line** (`cur.patch + 1`), not the release version.
    - `scope` `"extension"` or `"both"`: `packages/drawio-mcp-extension/package.json` → version.
    - `changed` lists repo-relative paths of everything written.

- [ ] **Step 1: Write the failing test** — `scripts/release/bump.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyBumps, getPackageVersion, getVersionConst } from "./bump.mjs";

function fixture({ compatVersion = "2.3.0" } = {}) {
  const root = mkdtempSync(join(tmpdir(), "release-bump-"));
  const pkg = (dir, version) =>
    writeFileSync(
      join(root, dir, "package.json"),
      JSON.stringify({ name: dir, version }, null, 2) + "\n",
    );
  mkdirSync(join(root, "packages/drawio-mcp-server/src"), { recursive: true });
  mkdirSync(join(root, "packages/drawio-mcp-plugin"), { recursive: true });
  mkdirSync(join(root, "packages/drawio-mcp-compat"), { recursive: true });
  mkdirSync(join(root, "packages/drawio-mcp-extension"), { recursive: true });
  pkg("packages/drawio-mcp-server", "2.3.0");
  pkg("packages/drawio-mcp-plugin", "2.3.0");
  pkg("packages/drawio-mcp-compat", compatVersion);
  pkg("packages/drawio-mcp-extension", "2.3.0");
  writeFileSync(join(root, "README.md"), "# repo readme\n");
  writeFileSync(
    join(root, "packages/drawio-mcp-server/src/index.ts"),
    'const VERSION = process.env.npm_package_version ?? "2.3.0";\n',
  );
  return root;
}

test("server scope bumps server+plugin+VERSION const and syncs the README", () => {
  const root = fixture();
  const { changed } = applyBumps({
    root,
    scope: "server",
    version: "2.4.0",
    compatChanged: false,
  });
  assert.equal(
    getPackageVersion(join(root, "packages/drawio-mcp-server/package.json")),
    "2.4.0",
  );
  assert.equal(
    getPackageVersion(join(root, "packages/drawio-mcp-plugin/package.json")),
    "2.4.0",
  );
  assert.equal(
    getVersionConst(join(root, "packages/drawio-mcp-server/src/index.ts")),
    "2.4.0",
  );
  assert.equal(
    readFileSync(join(root, "packages/drawio-mcp-server/README.md"), "utf8"),
    "# repo readme\n",
  );
  assert.ok(!changed.includes("packages/drawio-mcp-extension/package.json"));
  assert.ok(!changed.includes("packages/drawio-mcp-compat/package.json"));
});

test("compat bumps on its own line only when changed", () => {
  const root = fixture({ compatVersion: "0.1.0" });
  applyBumps({ root, scope: "server", version: "2.4.0", compatChanged: true });
  assert.equal(
    getPackageVersion(join(root, "packages/drawio-mcp-compat/package.json")),
    "0.1.1",
  );

  const root2 = fixture({ compatVersion: "0.1.0" });
  applyBumps({ root2, scope: "server", version: "2.4.0", compatChanged: false });
  assert.equal(
    getPackageVersion(join(root2, "packages/drawio-mcp-compat/package.json")),
    "0.1.0",
  );
});

test("extension scope only touches the extension package", () => {
  const root = fixture();
  applyBumps({ root, scope: "extension", version: "2.4.0", compatChanged: false });
  assert.equal(
    getPackageVersion(join(root, "packages/drawio-mcp-extension/package.json")),
    "2.4.0",
  );
  assert.equal(
    getPackageVersion(join(root, "packages/drawio-mcp-server/package.json")),
    "2.3.0",
  );
});

test("both scope applies the single version everywhere", () => {
  const root = fixture();
  applyBumps({ root, scope: "both", version: "2.4.0", compatChanged: false });
  assert.equal(
    getPackageVersion(join(root, "packages/drawio-mcp-server/package.json")),
    "2.4.0",
  );
  assert.equal(
    getPackageVersion(join(root, "packages/drawio-mcp-extension/package.json")),
    "2.4.0",
  );
  assert.equal(
    getVersionConst(join(root, "packages/drawio-mcp-server/src/index.ts")),
    "2.4.0",
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/release/bump.test.mjs`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `scripts/release/bump.mjs`**

```js
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const VERSION_CONST =
  /const VERSION = process\.env\.npm_package_version \?\? "([^"]+)";/;

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

export function getPackageVersion(file) {
  return readJson(file).version;
}

export function setPackageVersion(file, version) {
  const obj = readJson(file);
  obj.version = version;
  writeFileSync(file, JSON.stringify(obj, null, 2) + "\n");
}

export function getVersionConst(file) {
  const m = VERSION_CONST.exec(readFileSync(file, "utf8"));
  if (!m) throw new Error(`VERSION fallback constant not found in ${file}`);
  return m[1];
}

export function setVersionConst(file, version) {
  const src = readFileSync(file, "utf8");
  const matches = src.match(new RegExp(VERSION_CONST.source, "g"));
  if (!matches || matches.length !== 1) {
    throw new Error(`VERSION fallback constant not found exactly once in ${file}`);
  }
  writeFileSync(
    file,
    src.replace(
      VERSION_CONST,
      `const VERSION = process.env.npm_package_version ?? "${version}";`,
    ),
  );
}

export function applyBumps({ root, scope, version, compatChanged }) {
  const changed = [];
  const write = (rel, fn) => {
    fn(join(root, rel));
    changed.push(rel);
  };

  if (scope === "server" || scope === "both") {
    write("packages/drawio-mcp-server/package.json", (f) =>
      setPackageVersion(f, version),
    );
    write("packages/drawio-mcp-plugin/package.json", (f) =>
      setPackageVersion(f, version),
    );
    write("packages/drawio-mcp-server/src/index.ts", (f) => setVersionConst(f, version));
    copyFileSync(join(root, "README.md"), join(root, "packages/drawio-mcp-server/README.md"));
    changed.push("packages/drawio-mcp-server/README.md");
    if (compatChanged) {
      const compatFile = join(root, "packages/drawio-mcp-compat/package.json");
      const cur = getPackageVersion(compatFile);
      const parts = cur.split(".");
      setPackageVersion(compatFile, `${parts[0]}.${parts[1]}.${Number(parts[2]) + 1}`);
      changed.push("packages/drawio-mcp-compat/package.json");
    }
  }
  if (scope === "extension" || scope === "both") {
    write("packages/drawio-mcp-extension/package.json", (f) =>
      setPackageVersion(f, version),
    );
  }
  return { changed };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test scripts/release/bump.test.mjs`
Expected: PASS.

- [ ] **Step 5: Prettier + commit**

```bash
npx prettier --write scripts/release/bump.mjs scripts/release/bump.test.mjs
node --test scripts/release/bump.test.mjs
git add scripts/release/bump.mjs scripts/release/bump.test.mjs
git commit --author="claude-code-zai-glm-5.3 <noreply@anthropic.com>" -m "feat(scripts): coupled-file version bumps for the release pipeline

Co-Authored-By: Ladislav Gazo <ladislav.gazo@gmail.com>"
```

---

### Task 4: Parity gate module

**Files:**
- Create: `scripts/release/parity.mjs`
- Create: `scripts/release/parity.test.mjs`

**Interfaces:**
- Consumes: `getPackageVersion`, `getVersionConst` from Task 3.
- Produces: `checkParity({ root, version }) → { ok: boolean, errors: string[] }` — checks, under `root`:
  - `packages/drawio-mcp-server/package.json`.version === `version`
  - VERSION const in `packages/drawio-mcp-server/src/index.ts` === `version`
  - `packages/drawio-mcp-plugin/package.json`.version === server package version (lockstep)
  - `packages/drawio-mcp-claude-plugin/.claude-plugin/plugin.json`.version === `.claude-plugin/marketplace.json`.plugins[0].version (independent of `version`, but equal to each other)

- [ ] **Step 1: Write the failing test** — `scripts/release/parity.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkParity } from "./parity.mjs";

function fixture({
  serverVersion = "2.4.0",
  constVersion = serverVersion,
  pluginPkgVersion = serverVersion,
  pluginJsonVersion = "0.2.0",
  marketplaceVersion = "0.2.0",
} = {}) {
  const root = mkdtempSync(join(tmpdir(), "parity-"));
  const pkg = (dir, v) =>
    writeFileSync(
      join(root, dir, "package.json"),
      JSON.stringify({ name: dir, version: v }, null, 2),
    );
  mkdirSync(join(root, "packages/drawio-mcp-server/src"), { recursive: true });
  mkdirSync(join(root, "packages/drawio-mcp-plugin"), { recursive: true });
  mkdirSync(join(root, "packages/drawio-mcp-claude-plugin/.claude-plugin"), {
    recursive: true,
  });
  mkdirSync(join(root, ".claude-plugin"), { recursive: true });
  pkg("packages/drawio-mcp-server", serverVersion);
  pkg("packages/drawio-mcp-plugin", pluginPkgVersion);
  writeFileSync(
    join(root, "packages/drawio-mcp-server/src/index.ts"),
    `const VERSION = process.env.npm_package_version ?? "${constVersion}";\n`,
  );
  writeFileSync(
    join(root, "packages/drawio-mcp-claude-plugin/.claude-plugin/plugin.json"),
    JSON.stringify({ name: "drawio", version: pluginJsonVersion }, null, 2),
  );
  writeFileSync(
    join(root, ".claude-plugin/marketplace.json"),
    JSON.stringify(
      { plugins: [{ name: "drawio", version: marketplaceVersion }] },
      null,
      2,
    ),
  );
  return root;
}

test("consistent tree passes", () => {
  const r = checkParity({ root: fixture(), version: "2.4.0" });
  assert.deepEqual(r, { ok: true, errors: [] });
});

test("mismatched server version, const, lockstep, and marketplace are reported", () => {
  const r = checkParity({
    root: fixture({
      serverVersion: "2.3.0",
      constVersion: "2.3.0",
      pluginPkgVersion: "2.3.0",
      marketplaceVersion: "0.3.0",
    }),
    version: "2.4.0",
  });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes("drawio-mcp-server/package.json")));
  assert.ok(r.errors.some((e) => e.includes("VERSION")));
  assert.ok(r.errors.some((e) => e.includes("drawio-mcp-plugin/package.json")));
  assert.ok(r.errors.some((e) => e.includes("plugin.json")));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/release/parity.test.mjs`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `scripts/release/parity.mjs`**

```js
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getPackageVersion, getVersionConst } from "./bump.mjs";

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

export function checkParity({ root, version }) {
  const errors = [];
  const serverVersion = getPackageVersion(
    join(root, "packages/drawio-mcp-server/package.json"),
  );
  if (serverVersion !== version) {
    errors.push(
      `packages/drawio-mcp-server/package.json is ${serverVersion}, expected ${version}`,
    );
  }
  const constVersion = getVersionConst(
    join(root, "packages/drawio-mcp-server/src/index.ts"),
  );
  if (constVersion !== version) {
    errors.push(`VERSION fallback constant is ${constVersion}, expected ${version}`);
  }
  const pluginVersion = getPackageVersion(
    join(root, "packages/drawio-mcp-plugin/package.json"),
  );
  if (pluginVersion !== serverVersion) {
    errors.push(
      `packages/drawio-mcp-plugin/package.json is ${pluginVersion}, expected lockstep ${serverVersion}`,
    );
  }
  const pluginJsonVersion = readJson(
    join(root, "packages/drawio-mcp-claude-plugin/.claude-plugin/plugin.json"),
  ).version;
  const marketplaceVersion = readJson(join(root, ".claude-plugin/marketplace.json"))
    .plugins[0].version;
  if (pluginJsonVersion !== marketplaceVersion) {
    errors.push(
      `claude plugin version drift: plugin.json ${pluginJsonVersion} != marketplace.json ${marketplaceVersion}`,
    );
  }
  return { ok: errors.length === 0, errors };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test scripts/release/parity.test.mjs`
Expected: PASS.

- [ ] **Step 5: Prettier + commit**

```bash
npx prettier --write scripts/release/parity.mjs scripts/release/parity.test.mjs
node --test scripts/release/parity.test.mjs
git add scripts/release/parity.mjs scripts/release/parity.test.mjs
git commit --author="claude-code-zai-glm-5.3 <noreply@anthropic.com>" -m "feat(scripts): version parity gate for the release pipeline

Co-Authored-By: Ladislav Gazo <ladislav.gazo@gmail.com>"
```

---

### Task 5: Release CLI wiring (git plumbing) + root test script

**Files:**
- Create: `scripts/release.mjs`
- Modify: `package.json` (add one script entry)

**Interfaces:**
- Consumes: Tasks 1–4 exports.
- Produces: CLI `node scripts/release.mjs <subcommand> [flags]` run from the repo root; exit 0 on success, 1 on validation failure (message on stderr). Subcommands:
  - `resolve --scope <server|extension|both> [--version X.Y.Z]` — computes or validates, checks tag collision; prints JSON `{ version, level, source }` to stdout.
  - `bump --scope <...> --version X.Y.Z [--compat-changed <auto|0|1>]` — applies bumps (`--compat-changed` defaults to `auto`: non-empty `git log --oneline <lastServerTag>..HEAD -- packages/drawio-mcp-compat`).
  - `changelog --scope <...> --version X.Y.Z` — prints markdown changelog to stdout.
  - `check-parity --version X.Y.Z` — prints `ok` or the error list; exit 1 on failure.

  Scope→path prefixes (a commit matches a scope when any of its files starts with one of the prefixes):
  - `server`: `packages/drawio-mcp-server/`, `packages/drawio-mcp-plugin/`, `packages/drawio-mcp-compat/`
  - `extension`: `packages/drawio-mcp-extension/`, `packages/drawio-mcp-plugin/`
  - `both`: union of both

  Git facts via `execFileSync("git", [...])`:
  - commits: `git log <range> --name-only --pretty=format:%x1f%x1e%s%x1e%h` → records split on `\x1f`; meta split on `\x1e` into `[, subject, hash]`; file lines until the next `\x1f` record
  - range: `<lastTag>..HEAD` where lastTag = the highest `v<digit>*` tag for server/both, the highest `drawio-mcp-extension-v*` tag for extension; `--max-count=1000000 HEAD` when no tag exists
  - tags: `git tag -l` (all), plus `git tag -l <pattern>` for lastTag (sorted with `localeCompare(..., { numeric: true })`)

- [ ] **Step 1: Write `scripts/release.mjs`**

```js
#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { resolveVersion, validateTags } from "./release/version.mjs";
import { generateChangelog } from "./release/changelog.mjs";
import { applyBumps, getPackageVersion } from "./release/bump.mjs";
import { checkParity } from "./release/parity.mjs";

const SCOPE_PATHS = {
  server: [
    "packages/drawio-mcp-server/",
    "packages/drawio-mcp-plugin/",
    "packages/drawio-mcp-compat/",
  ],
  extension: ["packages/drawio-mcp-extension/", "packages/drawio-mcp-plugin/"],
  both: [
    "packages/drawio-mcp-server/",
    "packages/drawio-mcp-plugin/",
    "packages/drawio-mcp-compat/",
    "packages/drawio-mcp-extension/",
  ],
};

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" });
}

function fail(msg) {
  process.stderr.write(`${msg}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) out[argv[i].slice(2)] = argv[i + 1] ?? true;
    else out._.push(argv[i]);
  }
  return out;
}

function lastTag(pattern) {
  const tags = git("tag", "-l", pattern).trim().split("\n").filter(Boolean);
  if (tags.length === 0) return null;
  tags.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return tags[tags.length - 1];
}

function commitsSince(range, prefixes) {
  const raw = git("log", range, "--name-only", "--pretty=format:%x1f%x1e%s%x1e%h");
  const commits = [];
  for (const record of raw.split("\x1f")) {
    if (!record.trim()) continue;
    const [meta, ...fileLines] = record.split("\n");
    const [, subject, hash] = meta.split("\x1e");
    const files = fileLines.map((l) => l.trim()).filter(Boolean);
    if (files.some((f) => prefixes.some((p) => f.startsWith(p)))) {
      commits.push({ subject, hash, files });
    }
  }
  return commits;
}

const [cmd, ...rest] = process.argv.slice(2);
const args = parseArgs(rest);

if (cmd === "resolve" || cmd === "changelog") {
  const scope = args.scope ?? fail("missing --scope");
  const prefixes = SCOPE_PATHS[scope] ?? fail(`invalid scope: ${scope}`);
  const pattern =
    scope === "extension" ? "drawio-mcp-extension-v*" : "v[0-9]*";
  const tag = lastTag(pattern);
  const range = tag ? `${tag}..HEAD` : "--max-count=1000000 HEAD";
  const commits = commitsSince(range, prefixes);

  if (cmd === "resolve") {
    try {
      const result = resolveVersion({
        scope,
        explicit: args.version === undefined ? null : String(args.version),
        current: {
          server: getPackageVersion("packages/drawio-mcp-server/package.json"),
          extension: getPackageVersion("packages/drawio-mcp-extension/package.json"),
        },
        commits,
      });
      validateTags({
        scope,
        version: result.version,
        existingTags: git("tag", "-l").trim().split("\n").filter(Boolean),
      });
      process.stdout.write(JSON.stringify(result) + "\n");
    } catch (e) {
      fail(e.message);
    }
  } else {
    if (args.version === undefined) fail("missing --version");
    process.stdout.write(generateChangelog({ version: String(args.version), commits }));
  }
} else if (cmd === "bump") {
  const scope = args.scope ?? fail("missing --scope");
  if (args.version === undefined) fail("missing --version");
  let compatChanged = args["compat-changed"] ?? "auto";
  if (compatChanged === "auto") {
    const lt = lastTag("v[0-9]*");
    const range = lt ? `${lt}..HEAD` : "--max-count=1000000 HEAD";
    compatChanged =
      git("log", range, "--oneline", "--", "packages/drawio-mcp-compat").trim()
        .length > 0;
  } else {
    compatChanged = compatChanged === "1";
  }
  const { changed } = applyBumps({
    root: ".",
    scope,
    version: String(args.version),
    compatChanged,
  });
  process.stdout.write(changed.join("\n") + "\n");
} else if (cmd === "check-parity") {
  if (args.version === undefined) fail("missing --version");
  const { ok, errors } = checkParity({ root: ".", version: String(args.version) });
  if (!ok) fail(errors.join("\n"));
  process.stdout.write("ok\n");
} else {
  fail(`unknown or missing subcommand: ${cmd}`);
}
```

- [ ] **Step 2: Add the root test script** — in `package.json` scripts add:

```json
"test:release": "node --test scripts/release/"
```

- [ ] **Step 3: Verify the CLI against the real repo (no mutations)**

```bash
node --test scripts/release/
node scripts/release.mjs resolve --scope server
node scripts/release.mjs resolve --scope extension
node scripts/release.mjs resolve --scope both
node scripts/release.mjs resolve --scope server --version 99.0.0
node scripts/release.mjs resolve --scope server --version 1.0.0   # exit 1, "not greater"
node scripts/release.mjs check-parity --version 2.3.0             # ok (tree is in sync)
git status --porcelain                                              # must be empty
```
Expected: all resolve variants print JSON or fail with the exact expected error; `check-parity` prints `ok`; worktree untouched.

- [ ] **Step 4: Prettier + commit**

```bash
npx prettier --write scripts/release.mjs package.json
node --test scripts/release/
git add scripts/release.mjs package.json
git commit --author="claude-code-zai-glm-5.3 <noreply@anthropic.com>" -m "feat(scripts): release CLI wiring git history to version resolution

Co-Authored-By: Ladislav Gazo <ladislav.gazo@gmail.com>"
```

---

### Task 6: Refactor `server-publish.yml` into a reusable workflow

**Files:**
- Modify: `.github/workflows/server-publish.yml`

**Interfaces:**
- Consumes: `node scripts/release.mjs check-parity` (Task 5).
- Produces: `workflow_call` + `workflow_dispatch` workflow, inputs `version` (string, required) and `ref` (string, required), callable as `uses: ./.github/workflows/server-publish.yml, with: { version, ref }`, `secrets: inherit`. The old `release: created` trigger (and its broken `paths:` filter) is REMOVED. Checks out `ref`, runs parity gate + pack smoke test before npm publish.

- [ ] **Step 1: Verify the pack tarball location locally**

```bash
cd packages/drawio-mcp-server && pnpm pack --pack-destination . && ls -la *.tgz && cd ../..
node packages/drawio-mcp-server/build/index.js --help 2>/dev/null | head -3 || echo "build/index.js needs build first — run pnpm --filter drawio-mcp-server run build, then retry"
```
Confirm (a) the tarball name pattern `drawio-mcp-server-<version>.tgz` and the destination directory the `--pack-destination` argument actually writes to, and (b) that `--help` output contains `Draw.io MCP Server (2.3.0)`. Adjust the workflow's smoke-test glob accordingly before committing.

- [ ] **Step 2: Rewrite the workflow** — replace the whole file with:

```yaml
name: Server Publish

# Reusable publish job invoked by release.yml after the release commit and
# tag exist (GITHUB_TOKEN-created releases do not fire release events, so
# release.yml calls this directly). Also manually dispatchable.
on:
  workflow_call:
    inputs:
      version:
        description: "Released version (X.Y.Z)"
        type: string
        required: true
      ref:
        description: "Tag/ref to build and publish"
        type: string
        required: true
  workflow_dispatch:
    inputs:
      version:
        description: "Released version (X.Y.Z)"
        type: string
        required: true
      ref:
        description: "Tag/ref to build and publish"
        type: string
        required: true

permissions:
  contents: read
  id-token: write

concurrency:
  group: server-publish-${{ inputs.ref }}
  cancel-in-progress: false

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09 # v5
        with:
          ref: ${{ inputs.ref }}
      - name: Install pnpm
        uses: pnpm/action-setup@fc06bc1257f339d1d5d8b3a19a8cae5388b55320 # v5

      - name: Use Node.js
        uses: actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444 # v5
        with:
          node-version: "24.x"
          registry-url: "https://registry.npmjs.org"
          cache: "pnpm"
          cache-dependency-path: pnpm-lock.yaml

      - name: Version parity gate
        run: node scripts/release.mjs check-parity --version "${{ inputs.version }}"

      - name: Install dependencies
        run: pnpm install

      - name: Audit dependencies (blocking on release)
        run: pnpm audit --audit-level=moderate

      - name: Build compat
        run: pnpm --filter drawio-mcp-compat run build

      - name: Build plugin
        run: pnpm --filter drawio-mcp-plugin run build

      - name: Build dev proxy
        run: pnpm --filter drawio-mcp-dev-proxy run build

      - name: Build server
        run: pnpm --filter drawio-mcp-server run build

      - name: Pack smoke test (fresh install from tarball)
        working-directory: packages/drawio-mcp-server
        run: |
          set -euo pipefail
          pnpm pack --pack-destination .
          tarball=$(ls drawio-mcp-server-*.tgz)
          tmp=$(mktemp -d)
          npm install --prefix "$tmp" "$PWD/$tarball"
          "$tmp/node_modules/.bin/drawio-mcp-server" --help | grep -F "Draw.io MCP Server (${{ inputs.version }})"
          rm -rf "$tmp" "$tarball"

      - name: Publish
        run: pnpm --filter drawio-mcp-server publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

- [ ] **Step 3: Validate YAML + commit**

```bash
python -c "import yaml,sys; yaml.safe_load(open('.github/workflows/server-publish.yml'))" && echo YAML_OK
git add .github/workflows/server-publish.yml
git commit --author="claude-code-zai-glm-5.3 <noreply@anthropic.com>" -m "ci(publish): reusable server publish with parity gate and pack smoke test

Co-Authored-By: Ladislav Gazo <ladislav.gazo@gmail.com>"
```

---

### Task 7: Refactor `extension-publish.yml` into a reusable workflow with zip upload + CWS draft

**Files:**
- Modify: `packages/drawio-mcp-extension/package.json` (devDependency)
- Modify: `.github/workflows/extension-publish.yml`
- Modify: `pnpm-lock.yaml` (via `pnpm install`)

**Interfaces:**
- Produces: `workflow_call` + `workflow_dispatch` workflow with inputs `version`, `ref`, callable by `release.yml`. Steps: build compat → plugin → extension chrome/firefox zips, attach the chrome+firefox zips to the GitHub Release for `drawio-mcp-extension-v<version>` (graceful skip when the Release does not exist), then CWS draft upload — skipped when any `CWS_*` secret is missing, never failing the job.

- [ ] **Step 1: Add the pinned devDependency**

In `packages/drawio-mcp-extension/package.json` devDependencies add `"chrome-webstore-upload-cli": "4.0.2"`, then run `pnpm install` (updates `pnpm-lock.yaml`). Verify the binary resolves:

```bash
pnpm --filter drawio-mcp-extension exec chrome-webstore-upload --help | head -20
```

- [ ] **Step 2: Rewrite the workflow** — replace the whole file with:

```yaml
name: Publish Extension

# Reusable publish job invoked by release.yml after the extension tag and
# Release exist. Uploads the CWS zip as a DRAFT only (no auto-publish);
# AMO submission stays manual from the zips on the Release page (v1).
on:
  workflow_call:
    inputs:
      version:
        description: "Released version (X.Y.Z)"
        type: string
        required: true
      ref:
        description: "Tag/ref to build"
        type: string
        required: true
  workflow_dispatch:
    inputs:
      version:
        description: "Released version (X.Y.Z)"
        type: string
        required: true
      ref:
        description: "Tag/ref to build"
        type: string
        required: true

permissions:
  contents: write # attach zips to the GitHub Release

concurrency:
  group: extension-publish-${{ inputs.ref }}
  cancel-in-progress: false

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09 # v5
        with:
          ref: ${{ inputs.ref }}
      - name: Install pnpm
        uses: pnpm/action-setup@fc06bc1257f339d1d5d8b3a19a8cae5388b55320 # v5

      - name: Use Node.js
        uses: actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444 # v5
        with:
          node-version: "24.x"
          registry-url: "https://registry.npmjs.org"
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install

      - name: Audit dependencies (blocking on release)
        run: pnpm audit --audit-level=moderate

      - name: Build compat
        run: pnpm --filter drawio-mcp-compat run build

      - name: Build plugin
        run: pnpm --filter drawio-mcp-plugin run build

      - name: Build extension (chrome)
        run: pnpm run build
        working-directory: packages/drawio-mcp-extension

      - name: Package extension (chrome)
        run: pnpm run zip
        working-directory: packages/drawio-mcp-extension

      - name: Package extension (firefox)
        run: pnpm run zip:firefox
        working-directory: packages/drawio-mcp-extension

      - name: Attach zips to the GitHub Release
        env:
          GH_TOKEN: ${{ github.token }}
          TAG: drawio-mcp-extension-v${{ inputs.version }}
        run: |
          if gh release view "$TAG" >/dev/null 2>&1; then
            gh release upload "$TAG" \
              "packages/drawio-mcp-extension/.output/drawio-mcp-extension-${{ inputs.version }}-chrome.zip" \
              "packages/drawio-mcp-extension/.output/drawio-mcp-extension-${{ inputs.version }}-firefox.zip" \
              --clobber
          else
            echo "Release $TAG not found; zips stay as build outputs:"
            ls -la packages/drawio-mcp-extension/.output
          fi

      - name: Upload CWS draft (skipped without store credentials)
        id: cws
        continue-on-error: true
        env:
          CWS_CLIENT_ID: ${{ secrets.CWS_CLIENT_ID }}
          CWS_CLIENT_SECRET: ${{ secrets.CWS_CLIENT_SECRET }}
          CWS_REFRESH_TOKEN: ${{ secrets.CWS_REFRESH_TOKEN }}
          CWS_EXTENSION_ID: ${{ secrets.CWS_EXTENSION_ID }}
        working-directory: packages/drawio-mcp-extension
        run: |
          if [ -z "$CWS_CLIENT_ID" ] || [ -z "$CWS_CLIENT_SECRET" ] || [ -z "$CWS_REFRESH_TOKEN" ] || [ -z "$CWS_EXTENSION_ID" ]; then
            echo "CWS_* secrets not configured; skipping draft upload (manual submission from the Release page zips)."
            exit 0
          fi
          pnpm exec chrome-webstore-upload upload \
            --extension-id "$CWS_EXTENSION_ID" \
            --client-id "$CWS_CLIENT_ID" \
            --client-secret "$CWS_CLIENT_SECRET" \
            --refresh-token "$CWS_REFRESH_TOKEN" \
            --source ".output/drawio-mcp-extension-${{ inputs.version }}-chrome.zip"

      - name: Report CWS upload result
        if: ${{ always() && steps.cws.conclusion == 'failure' }}
        run: echo "CWS draft upload failed (non-fatal); submit manually from the Release page zips."
```

- [ ] **Step 3: Validate YAML + commit**

```bash
python -c "import yaml; yaml.safe_load(open('.github/workflows/extension-publish.yml'))" && echo YAML_OK
git add .github/workflows/extension-publish.yml packages/drawio-mcp-extension/package.json pnpm-lock.yaml
git commit --author="claude-code-zai-glm-5.3 <noreply@anthropic.com>" -m "ci(publish): reusable extension publish with release assets and CWS draft upload

Co-Authored-By: Ladislav Gazo <ladislav.gazo@gmail.com>"
```

---

### Task 8: The release workflow `release.yml`

**Files:**
- Create: `.github/workflows/release.yml`

**Interfaces:**
- Consumes: `scripts/release.mjs` (`resolve`, `bump`, `changelog`), reusable workflows from Tasks 6–7, cache/action SHAs already used in `.github/workflows/server-ci.yml`.
- Produces: dispatch form (inputs `scope` choice `server|extension|both`, `version` optional) and the release job sequence, then the two conditional publish jobs.

- [ ] **Step 1: Write `.github/workflows/release.yml`**

```yaml
name: Release

# One human gate: fill the form (scope + optional version), click Run.
# Validates, bumps coupled files, runs gates, commits to main, tags,
# creates GitHub Releases, then invokes the publish jobs directly
# (GITHUB_TOKEN-created releases do not fire release events).
on:
  workflow_dispatch:
    inputs:
      scope:
        description: "What to release"
        type: choice
        options: [server, extension, both]
        default: server
      version:
        description: "X.Y.Z — leave empty to auto-compute from commits"
        type: string
        required: false

permissions:
  contents: write
  id-token: write

concurrency:
  group: release
  cancel-in-progress: false

jobs:
  release:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.resolve.outputs.version }}
    steps:
      - uses: actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09 # v5
        with:
          fetch-depth: 0 # full history for changelog + tag ranges
      - name: Install pnpm
        uses: pnpm/action-setup@fc06bc1257f339d1d5d8b3a19a8cae5388b55320 # v5

      - name: Use Node.js
        uses: actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444 # v5
        with:
          node-version: "24.x"
          cache: "pnpm"
          cache-dependency-path: pnpm-lock.yaml

      - name: Resolve version
        id: resolve
        run: |
          set -euo pipefail
          args=(--scope "${{ inputs.scope }}")
          if [ -n "${{ inputs.version }}" ]; then args+=(--version "${{ inputs.version }}"); fi
          node scripts/release.mjs resolve "${args[@]}" | tee resolve.json
          echo "version=$(node -p "JSON.parse(require('fs').readFileSync('resolve.json','utf8')).version")" >> "$GITHUB_OUTPUT"

      - name: Bump coupled files
        run: |
          set -euo pipefail
          version="${{ steps.resolve.outputs.version }}"
          git status --porcelain
          node scripts/release.mjs bump --scope "${{ inputs.scope }}" --version "$version"

      - name: Install dependencies
        run: pnpm install

      - name: Release script unit tests
        run: pnpm run test:release

      - name: Blocking dependency audit
        run: pnpm audit --audit-level=moderate

      - name: Build all packages
        run: |
          pnpm --filter drawio-mcp-compat run build
          pnpm --filter drawio-mcp-plugin run build
          pnpm --filter drawio-mcp-dev-proxy run build
          pnpm --filter drawio-mcp-server run build
          pnpm --filter drawio-mcp-extension run build

      - name: Lint server
        if: ${{ inputs.scope != 'extension' }}
        run: pnpm --filter drawio-mcp-server run lint

      - name: Cache Playwright browsers
        if: ${{ inputs.scope != 'extension' }}
        uses: actions/cache@caa296126883cff596d87d8935842f9db880ef25 # v5
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}

      - name: Cache draw.io assets
        if: ${{ inputs.scope != 'extension' }}
        uses: actions/cache@caa296126883cff596d87d8935842f9db880ef25 # v5
        with:
          path: ~/.cache/drawio-mcp-server
          key: drawio-assets-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}

      - name: Install Playwright browser
        if: ${{ inputs.scope != 'extension' }}
        run: pnpm --filter drawio-mcp-server exec playwright install --with-deps chromium

      - name: Server tests
        if: ${{ inputs.scope != 'extension' }}
        run: |
          pnpm --filter drawio-mcp-server run prefetch-assets
          pnpm --filter drawio-mcp-server test

      - name: Extension tests
        if: ${{ inputs.scope != 'server' }}
        run: pnpm --filter drawio-mcp-extension test

      - name: Plugin tests
        run: pnpm --filter drawio-mcp-plugin test

      - name: Generate changelog
        run: |
          node scripts/release.mjs changelog \
            --scope "${{ inputs.scope }}" \
            --version "${{ steps.resolve.outputs.version }}" > changelog.md

      - name: Commit version bumps to main
        run: |
          set -euo pipefail
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add packages/drawio-mcp-server/package.json \
                  packages/drawio-mcp-plugin/package.json \
                  packages/drawio-mcp-compat/package.json \
                  packages/drawio-mcp-extension/package.json \
                  packages/drawio-mcp-server/src/index.ts \
                  packages/drawio-mcp-server/README.md
          if git diff --cached --quiet; then
            echo "ERROR: nothing staged for the release commit" >&2
            exit 1
          fi
          git commit -m "chore(release): ${{ steps.resolve.outputs.version }} ${{ inputs.scope }}"
          git push origin HEAD:main

      - name: Tag and create GitHub Releases
        env:
          GH_TOKEN: ${{ github.token }}
          VERSION: ${{ steps.resolve.outputs.version }}
          SCOPE: ${{ inputs.scope }}
        run: |
          set -euo pipefail
          if [ "$SCOPE" != "extension" ]; then
            git tag "v$VERSION"
            git push origin "v$VERSION"
            gh release create "v$VERSION" --title "v$VERSION" --notes-file changelog.md
          fi
          if [ "$SCOPE" != "server" ]; then
            git tag "drawio-mcp-extension-v$VERSION"
            git push origin "drawio-mcp-extension-v$VERSION"
            gh release create "drawio-mcp-extension-v$VERSION" \
              --title "drawio-mcp-extension v$VERSION" --notes-file changelog.md
          fi

  publish-server:
    needs: release
    if: ${{ inputs.scope != 'extension' }}
    uses: ./.github/workflows/server-publish.yml
    with:
      version: ${{ needs.release.outputs.version }}
      ref: v${{ needs.release.outputs.version }}
    secrets: inherit
    permissions:
      contents: read
      id-token: write

  publish-extension:
    needs: release
    if: ${{ inputs.scope != 'server' }}
    uses: ./.github/workflows/extension-publish.yml
    with:
      version: ${{ needs.release.outputs.version }}
      ref: drawio-mcp-extension-v${{ needs.release.outputs.version }}
    secrets: inherit
    permissions:
      contents: write
      id-token: read
```

- [ ] **Step 2: Validate the workflow files**

```bash
python -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml'))" && echo YAML_OK
```
If actionlint is obtainable (`bash <(curl https://raw.githubusercontent.com/rhysd/actionlint/main/scripts/download-actionlint.bash)` — skip silently if no network), also run `./actionlint .github/workflows/*.yml` and fix findings.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release.yml
git commit --author="claude-code-zai-glm-5.3 <noreply@anthropic.com>" -m "ci(release): dispatch-form release workflow

Co-Authored-By: Ladislav Gazo <ladislav.gazo@gmail.com>"
```

---

### Task 9: Update `docs/release.md` and the spec status

**Files:**
- Modify: `docs/release.md`
- Modify: `docs/superpowers/specs/2026-10-11-release-pipeline-design.md` (Status line only)

- [ ] **Step 1: Rewrite `docs/release.md`** with these sections (keep the existing `# Releasing` H1, no other H1):

1. **How to release** — GitHub → Actions → **Release** → *Run workflow*: pick scope (`server` / `extension` / `both`), optionally type `X.Y.Z` (empty = auto-computed from conventional commits since the component's last tag: `feat` → minor, `fix` → patch, `feat!` → major). The workflow then: resolves + validates the version (semver, strictly greater than current, no tag collision), applies the coupled-file bumps (server+plugin lockstep, `VERSION` fallback constant, server README sync, extension package.json; compat patches only if changed), generates the changelog, runs gates (script tests, blocking audit, build, lint, server tests incl. Playwright, extension + plugin tests), commits `chore(release): <version> [<scope>]` to `main` as `github-actions[bot]`, tags (`vX.Y.Z` and/or `drawio-mcp-extension-vX.Y.Z`), creates the GitHub Releases, and calls the publish jobs: npm publish with provenance (server), extension zips attached to the Release + CWS draft upload (extension).
2. **Release scenarios** — the three-situation table: server-only → npm only; extension-only → zips + CWS draft; both → one version on both lines.
3. **What stays manual** — README "Key Highlights" prose (push to `main` before running the form); CWS "Submit for review" click (draft is auto-uploaded; store review is external); AMO submission from the Release-page zips (no draft state in the AMO API); Claude-plugin version bumps (independent; keep `plugin.json` + `marketplace.json` in sync in the same commit).
4. **Coupling rules** — keep the current packages table (update versions if the tree moved) and the coupling rules: server+plugin lockstep, `VERSION` constant, compat bump-on-change, plugin/marketplace parity — noting the pipeline now enforces all of them (parity gate blocks publish on drift).
5. **Failure and retry** — re-run the failed job; a publish that failed after tag/Release creation is safe to retry (npm rejects duplicate versions, parity gate re-verifies the tree); a bad release is fixed by a new `fix:` commit + a new patch release through the same form; `main` must stay releasable (trunk-based).
6. **Workflow inventory** — `release.yml` (the form), `server-publish.yml` (reusable, called by release.yml; also dispatchable), `extension-publish.yml` (reusable, called by release.yml; also dispatchable), `extension-package.yml` (unchanged, manual zip artifacts), `claude-plugin-ci.yml` (unchanged). Note the new tagging convention: extension releases are tagged `drawio-mcp-extension-vX.Y.Z` (the flat `vX.Y.Z` remains server-only).

Do not add the file to `SOURCE_DOCS` in `scripts/translate.mjs` (check first whether it is registered; if it is NOT registered, there is no zh-CN snapshot to maintain — leave it that way unless it already has one).

- [ ] **Step 2: Update the spec status line** in `docs/superpowers/specs/2026-10-11-release-pipeline-design.md` to:

```
Status: implemented (see docs/release.md); awaiting supervised patch release
```

- [ ] **Step 3: Prettier + commit**

```bash
npx prettier --check docs/release.md docs/superpowers/specs/2026-10-11-release-pipeline-design.md
git add docs/release.md docs/superpowers/specs/2026-10-11-release-pipeline-design.md
git commit --author="claude-code-zai-glm-5.3 <noreply@anthropic.com>" -m "docs(release): describe the dispatch-form release pipeline

Co-Authored-By: Ladislav Gazo <ladislav.gazo@gmail.com>"
```

---

### Task 10: Full verification pass

**Files:** none.

- [ ] **Step 1: Run everything**

```bash
pnpm install
pnpm run test:release
node scripts/release.mjs resolve --scope server
node scripts/release.mjs resolve --scope extension
node scripts/release.mjs resolve --scope both
node scripts/release.mjs check-parity --version 2.3.0
npx prettier --check scripts/release.mjs "scripts/release/*.mjs" package.json docs/release.md
python - <<'EOF'
import yaml
for f in ["release", "server-publish", "extension-publish"]:
    yaml.safe_load(open(f".github/workflows/{f}.yml"))
print("YAML_OK")
EOF
git status --porcelain   # must be empty
```

- [ ] **Step 2: Dry-run the bump against a scratch clone (NOT the worktree)**

```bash
tmp=$(mktemp -d)
git clone . "$tmp/scratch" && cd "$tmp/scratch"
node scripts/release.mjs bump --scope both --version 99.0.0
node scripts/release.mjs check-parity --version 99.0.0
git diff --stat
cd - && rm -rf "$tmp"
```
Expected: bump mutates exactly `packages/drawio-mcp-server/package.json`, `packages/drawio-mcp-plugin/package.json`, `packages/drawio-mcp-server/src/index.ts`, `packages/drawio-mcp-server/README.md`, `packages/drawio-mcp-extension/package.json` (+ compat when auto-detect finds compat commits) and nothing else; parity gate prints `ok` in the scratch clone.

- [ ] **Step 3: Report findings** in the run's final issue comment: test output, verification evidence, and what was NOT verifiable locally (live GitHub Actions dispatch, npm publish, CWS upload — those need the owner's secrets and a first real dispatch).