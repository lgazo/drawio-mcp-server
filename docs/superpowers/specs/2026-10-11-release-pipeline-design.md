# Release Pipeline with Limited Human Involvement — Design

Date: 2026-10-11
Status: proposed (awaiting review)
Scope: release automation for the whole monorepo; design only, no implementation yet.

## Problem

`docs/release.md` describes a 9-step, fully manual release procedure: hand-edit
version bumps across coupled files, hand-write release notes into README
"Key Highlights", hand-run `pnpm pack` + fresh-install smoke test, hand-tag,
hand-create the GitHub Release, then hand-verify the extension zips. Every
step is a place to forget a coupled file (the `VERSION` fallback constant,
`marketplace.json` parity, the server README copy) or to release an untested
package. The repo already has the publishing half automated
(`server-publish.yml`, `extension-publish.yml` fire on `release: created`) —
what is missing is the **preparation half**: versioning, changelog, tagging,
release creation, and pre-publish validation.

Goal: reduce human involvement to **one decision point** — merging a
release PR — with everything before it (version math, coupled-file bumps,
changelog, smoke tests) and everything after it (tag, GitHub Release, npm
publish with provenance, extension zips) automated.

## Non-goals

- No change to what gets published or where (npm for the server, zips for the
  extension, marketplace served from `main` for the Claude plugin).
- No auto-publish to Chrome Web Store / AMO in v1 (kept as a phase-2 option;
  store-side human review cannot be removed anyway).
- No new versioning scheme. Tags stay flat `vX.Y.Z`; version-coupling rules in
  `docs/release.md` stay exactly as they are — the pipeline enforces them
  instead of a human remembering them.
- No replacement of the existing CI workflows; the pipeline composes with them.

## Constraints (from the current repo)

1. **Version coupling** (`docs/release.md`): server, plugin, and compat bump
   in lockstep; extension `package.json` version names the CI-produced zips;
   `packages/drawio-mcp-server/src/index.ts` has a literal `VERSION` fallback
   that must match; `plugin.json` and `.claude-plugin/marketplace.json` share
   a version that is independent of the server.
2. **npm publish requires a GitHub Release to exist** (provenance uses the
   release OIDC flow with `id-token: write`), so the pipeline must create the
   Release itself for the publish workflows to fire.
3. **Conventional commits are already the house style** (history:
   `feat:`, `fix(security):`, `docs:`, `chore(release):`, …).
4. **Known bug**: `server-publish.yml`'s `release: created` trigger carries a
   `paths:` filter, which release events ignore. Noted in two prior specs;
   fixed as part of this work since the pipeline leans on that trigger.
5. **Release notes are prose** (README "Key Highlights" section). Automation
   can generate a changelog from commits, but user-facing highlight prose
   stays a human edit — made **in the release PR**, not on `main` after tag.

## Approaches considered

### A. release-please (recommended)

Google's release-please bot watches `main`, collects conventional commits, and
maintains a single **release PR** containing: version bumps, generated
changelog, and — via `extra-files` / custom updater config — the coupled-file
edits (VERSION fallback constant, server README copy). When the PR merges,
the bot tags `vX.Y.Z` and creates the GitHub Release, which fires the existing
publish workflows.

- Human involvement: review + merge the release PR (one click), optionally
  editing the Highlights prose inside it first.
- Fits an already-conventional-commit repo with zero contributor overhead —
  no per-PR ritual.
- Lockstep bumps are configuration, not code: one release component with
  `extra-files`.
- Weakness: version intent is inferred from commit types; a badly typed commit
  produces a wrong bump. Mitigated by reviewing the release PR before merge
  (the human gate) and by commit-lint discipline already in place culturally.

### B. changesets

Contributors add a changeset file per PR declaring the bump intent; the bot
aggregates them into a "Version Packages" PR.

- More explicit intent, first-class pnpm monorepo support.
- But it adds human involvement on **every** feature/fix PR (the opposite of
  the issue's goal), and the coupling rules (lockstep plugin/compat, VERSION
  constant, marketplace parity) still need custom post-processing anyway.

### C. semantic-release, fully automatic

Publishes on every conventional commit landing on `main`. Zero human
involvement — but: no batching point, releases every `feat:` immediately,
gives up the release PR as the single reviewable artifact, and couples release
cadence to merge cadence in a repo where a release also produces
store-facing extension artifacts. Highest blast radius per mistake; rejected.

**Choice: A.** It keeps exactly one human gate, reuses conventional commits
the repo already writes, and the merge of the release PR is a natural place
for a human to sanity-check the version delta before it becomes immutable.

## Design

### New workflow: `release-please.yml`

```yaml
on:
  push:
    branches: [main]

permissions:
  contents: write        # maintain release PR, create tag + Release
  pull-requests: write   # release PR management

# release-please with a single root component:
#   "release-type": "node"
#   "packages": { ".": { "component": "drawio-mcp" } }
#   extra-files:
#     - packages/drawio-mcp-plugin/package.json
#     - packages/drawio-mcp-compat/package.json
#     - packages/drawio-mcp-extension/package.json
#     - packages/drawio-mcp-server/src/index.ts   (VERSION fallback literal)
```

- Action and bootstrap pinned to a commit SHA, matching the repo's existing
  supply-chain policy (`security-scan.yml` already pins all Actions).
- **Lockstep bumping**: server, plugin, compat, extension all get the same
  `X.Y.Z` in the release PR, mirroring the "repo-wide release" intent
  documented in `docs/release.md` (one Release produces npm publish *and*
  extension zips).
- **Claude plugin stays decoupled**: not part of the root release. Its
  version bumps continue to be manual commits (they are rare, metadata-only,
  and the marketplace reads from `main`). If they become a chore, add a second
  release-please component with tag `drawio-mcp-claude-plugin-vX.Y.Z` later —
  `docs/release.md` already reserves that tag name.

### Release PR as the single human gate

The release PR contains, generated:

1. `package.json` version bumps (server, plugin, compat, extension; root
   package untouched — it is `private`).
2. The `VERSION` fallback literal in
   `packages/drawio-mcp-server/src/index.ts`, updated in lockstep via a
   targeted custom updater (JSON-string literal replacement, not a regex over
   the whole file).
3. Changelog generated from conventional commits.
4. `cp README.md packages/drawio-mcp-server/README.md` — the npm README sync,
   executed as a workflow step, so the copy is never stale.

The human's job in the PR (all optional except the merge):

- Update README "Key Highlights" prose + version chips (release notes stay
  human prose, per constraint 5).
- Sanity-check the proposed version delta.
- Merge. That is the entire ceremony.

CI runs on the release PR branch like any other PR, so the exact tree that
will be tagged is what CI validated.

### Post-merge: tag → Release → existing publish workflows

release-please tags `vX.Y.Z` and creates the GitHub Release with the generated
changelog. Existing workflows then fire unchanged in content, with these
edits:

- **`server-publish.yml`**: drop the invalid `paths:` filter on the
  `release: created` trigger (constraint 4). Insert two steps between build
  and publish:
  1. **Version-parity gate** — fail if `packages/drawio-mcp-server` version ≠
     release tag, `plugin.json` vs `marketplace.json` parity, `VERSION`
     fallback constant matches `package.json`. A plain `set -euo pipefail`
     shell script under `scripts/`, same home as
     `check-audit-overrides.sh`.
  2. **Pack smoke test** — `pnpm pack` in a clean job, `npm install` the
     tarball into a temp dir, run `npx drawio-mcp-server --editor`
     expecting the new version string. Automates manual procedure steps
     6a–6c so the release PR's tree is proven installable *before* the npm
     publish step in the same job (blocking audit already runs there).
- **`extension-publish.yml`**: after zipping, upload the chrome/firefox zips
  as Release assets so the Release page is the single artifact download
  point, and attach the smoke-test receipt (zip contains
  `manifest.json` with the released version) to the job summary.

The blocking `pnpm audit --audit-level=moderate` stays in both publish
workflows — a release with a new advisory fails there rather than on `main`
(deliberate: regular CI keeps its non-blocking audit).

### Failure and retry behavior

- Publishing is tag-driven and idempotent-shaped: if a publish job fails
  (transient network, audit gate), re-run the failed workflow from the
  Release page; npm rejects duplicate versions, so a half-completed publish
  is safe to retry.
- If the release PR merges but a publish is found broken, the fix is a new
  `fix:` commit + a fresh patch release through the same pipeline — no
  special hotfix lane. `main` is expected releasable at all times
  (trunk-based, already the current practice).
- Failed release-please bootstrap or config errors surface as check failures
  on the release PR — the human sees them at the gate, not after tagging.

## Testing

- Config-as-code review: the release-please manifest lives in-repo; a
  `workflow_dispatch`-triggered **dry-run check** (plan mode — bot computes
  the would-be release PR contents and writes them to the job summary without
  opening it) can be run manually before first real use.
- Version-parity gate script is plain shell; test it in CI against fixture
  trees (matching versions pass, drifted versions fail).
- First real release under the pipeline should be a patch release, executed
  as a supervised run, with `docs/release.md` updated in the same PR to
  describe the new procedure.

## Migration

1. Add `release-please.yml` + config; fix `server-publish.yml` trigger; add
   parity script + smoke-test steps; attach zips to the Release.
2. Update `docs/release.md` to the new procedure (human steps: keep writing
  Highlights, merge the release PR, re-run failed publish workflows).
3. Supervised patch release validates end-to-end.
4. (Optional, later) Phase 2: CWS API upload + AMO `web-ext sign` with stored
   credentials; second component for the Claude plugin if its bumps get
   frequent.

## Open questions for review

1. Release **cadence**: does release-please open a PR per `feat`/`fix` batch
   (immediate) or should it be throttled (e.g. weekly) so one release PR
   accumulates? Default proposal: immediate, merge when you want to ship.
2. Should the **extension zips' version** stay lockstep-bumped with the
   server, or is a silent-extension release (server-only bump) acceptable
   when only the server changed? Lockstep proposed for v1 (matches current
   behavior); can split into a component later.
3. Phase-2 store upload: wanted at all, or is "zips on the Release page +
   manual store upload" the steady state?