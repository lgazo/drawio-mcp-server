# Release Pipeline with Limited Human Involvement — Design

Date: 2026-10-11 (revised 2026-10-12)
Status: implemented (see docs/release.md); awaiting supervised patch release
Scope: release automation for the whole monorepo; design only, no implementation yet.

## Problem

`docs/release.md` describes a 9-step, fully manual release procedure: hand-edit
version bumps across coupled files, hand-write release notes into README
"Key Highlights", hand-run `pnpm pack` + fresh-install smoke test, hand-tag,
hand-create the GitHub Release, then hand-verify the extension zips. Every
step is a place to forget a coupled file (the `VERSION` fallback constant,
`marketplace.json` parity, the server README copy) or to release an untested
package.

Goal: reduce human involvement to **one form**: a release entry point in the
GitHub UI where the version is typed in (or auto-computed) and a scope picked.
Everything else — coupled-file bumps, changelog, tag, Release, npm publish
with provenance, extension zips, store submissions — runs without branches,
release PRs, or local git work.

## Non-goals

- No change to what gets published or where (npm for the server, zips + store
  upload for the extension, marketplace served from `main` for the Claude
  plugin).
- No new versioning scheme for the server: server tags stay flat `vX.Y.Z`.
  The extension moves to its own tag line (`drawio-mcp-extension-vX.Y.Z`) —
  it is `private`, not on npm, and its version only names the zips and the
  store submissions.
- No replacement of the regular CI workflows; the release workflow composes
  with them.
- The pipeline submits new extension versions to the stores; the stores' own
  review queues (CWS review, AMO automated review) are external and cannot be
  automated away — "limited human involvement" ends at submission.

## Constraints (from the current repo)

1. **Version coupling** (`docs/release.md`): server, plugin, and compat bump
   in lockstep (server build embeds their `dist/`); extension `package.json`
   version names the CI-produced zips;
   `packages/drawio-mcp-server/src/index.ts` has a literal `VERSION` fallback
   that must match; `plugin.json` and `.claude-plugin/marketplace.json` share
   a version that is independent of the server.
2. **Conventional commits are the house style** (`feat:`, `fix(security):`,
   `docs:`, …) — the changelog generator relies on them.
3. **README "Key Highlights" is release-note prose**. Automation generates the
   Release body from commits; highlight prose stays a human edit, pushed to
   `main` any time before running the release workflow.
4. **GitHub quirk**: releases created with the default `GITHUB_TOKEN` do not
   fire `release:` events, so a release workflow that creates the Release
   cannot rely on the existing `release: created` publish workflows to react.
   The pipeline therefore invokes publishing directly (below).

## Approaches considered

### A. Release workflow with a GitHub UI form (recommended)

A new `release.yml` triggered by `workflow_dispatch` with typed inputs —
GitHub renders a native form under the Actions tab → "Release" → "Run
workflow". The workflow validates the request, applies all coupled-file
bumps, generates the changelog, commits, tags, creates the Release, and runs
the publishing jobs. Human involvement: fill two fields, click Run, watch the
run. No branches, no PRs, no local commands.

- The version is **chosen** in the UI (or left blank for auto-compute), which
  is the explicit owner requirement.
- The three release situations (server only / extension only / both together)
  are a **dropdown**, not emergent behavior.
- "Both together" takes one version for both components — aligned versions
  by construction.
- Weakness: no pre-merge review of the release commit; mitigated by running
  the full build/test gates inside the workflow before anything is tagged,
  and by the version-parity gate before publish.

### B. release-please bot (rejected after review)

The bot maintains release PRs from conventional commits; merging one is the
release. Rejected on owner feedback: the release-PR + branch mechanics
(`release-please--branches--…`, bot-regenerated PRs, manual in-PR version
edits to align components) are exactly the "messing around with branches" the
owner does not want, and the version comes out computed rather than chosen.
Its changelog generation is still worth borrowing as a concept (see A).

### C. changesets / D. semantic-release (rejected)

changesets adds a per-PR changeset ritual — more human involvement, not less.
semantic-release publishes on every conventional commit landing on `main`:
no batching point, no reviewable artifact, highest blast radius per mistake.

## Design

### The release form — `release.yml`

```yaml
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
```

GitHub renders these as a dropdown + text field on the workflow's Run page.
The form accepts the two decisions only a human should make: **what ships**
and **what number it carries**.

### Release run, step by step

One job sequence on `ubuntu-latest` (checkout of `main`; the dispatch form's
branch picker is left on `main` — releasing anything else is out of scope):

1. **Resolve the version** per scope: from the `version` input if given,
   else computed from conventional commits since the component's last tag
   (`feat:` → minor, `fix:` → patch, `feat!:`/`BREAKING CHANGE:` → major; a
   small script under `scripts/`, jest-tested, no new dependency). Scope
   `both` uses a single version for both components.
2. **Validate**: semver syntax; no existing tag with that version; strictly
   greater than the current version of every component in scope; for scope
   `both`, both components take the same number.
3. **Apply coupled-file bumps** (same script):
   - server scope: `drawio-mcp-server` + `drawio-mcp-plugin` +
     `drawio-mcp-compat` `package.json`, the `VERSION` fallback literal in
     `src/index.ts`, and `cp README.md packages/drawio-mcp-server/README.md`
     (the npm README sync).
   - extension scope: `drawio-mcp-extension/package.json`.
   - both: the union.
   - `plugin.json` + `.claude-plugin/marketplace.json` are NOT bumped — the
     Claude plugin keeps its independent, manual versioning.
4. **Generate the changelog** from conventional commits since the component's
   last tag (same script), grouped feat/fix/docs.
5. **Gates before anything is tagged**: `pnpm install`, full lint + typecheck
   - tests, blocking `pnpm audit --audit-level=moderate` (a release with a
     new advisory fails here, not on `main`), and for server scope the pack
     smoke test — `pnpm pack` the server, `npm install` the tarball into a temp
     dir, `npx drawio-mcp-server --editor` must report the new version
     (automates manual procedure steps 6a–6c).
6. **Commit** the bumps as `chore(release): <version> [<scope>]` to `main`
   (github-script with `GITHUB_TOKEN`; author `github-actions[bot]`).
7. **Tag + GitHub Release**: `vX.Y.Z` (server), `drawio-mcp-extension-vX.Y.Z`
   (extension), or both; Release body = generated changelog. Tags/releases
   are for record, history, and downloads — publishing does not hang off
   them (constraint 4).
8. **Publish** by invoking the publishing directly as jobs of the same
   workflow run, via `workflow_call` refactors of the existing workflows:
   - **server job** (`server-publish.yml` becomes reusable): build compat →
     plugin → dev-proxy → server, **version-parity gate** (fail unless the
     checked-out tree's versions match the chosen version and the coupling
     rules hold — a plain `set -euo pipefail` script under `scripts/`, same
     home as `check-audit-overrides.sh`), then `pnpm --filter
drawio-mcp-server publish --provenance --access public`
     (`id-token: write` for provenance, `NPM_TOKEN` as today).
   - **extension job** (`extension-publish.yml` becomes reusable): build,
     zip chrome + firefox, `gh release upload` the zips as Release assets
     (single download point), then submit to the stores:
     - **Chrome Web Store** (`chrome-webstore-upload`): secrets
       `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`, app ID.
       Upload the new version as a **draft only** — no auto-publish. The
       release goes live when a human clicks "Submit for review" in the
       dashboard (decision from review).
     - **Mozilla Add-ons**: no draft state exists in the AMO signing API
       (`web-ext sign --channel listed` publishes after automated review),
       so v1 does not auto-upload to AMO at all — the zips on the Release
       page are the manual submission path. Revisit once the CWS draft flow
       has proven itself.
     - A failed store submission does not fail the job — the zips on the
       Release page remain the manual fallback. A failed store upload also
       does not lose anything: re-run the job.
   - Only the jobs for the chosen scope run. Server-only releases never
     touch the extension, its zips, or the stores.

### The three release situations

| Situation      | Form input                  | Result                                                                                         |
| -------------- | --------------------------- | ---------------------------------------------------------------------------------------------- |
| Server only    | scope=`server`              | Server bump + `vX.Y.Z` → npm. Extension untouched.                                             |
| Extension only | scope=`extension`           | Extension bump + `drawio-mcp-extension-vX.Y.Z` → zips + stores. npm untouched.                 |
| Both together  | scope=`both`, one `version` | One version applied to both; both tags; npm + zips + stores. Aligned versions by construction. |

### Failure and retry behavior

- Any failed step fails the run before tagging (steps 1–5) or before its
  downstream effect (publish jobs run after tag/Release creation, so a failed
  publish leaves a tag + Release with unpublished artifacts — re-run the
  failed job; npm rejects duplicate versions, and the parity gate confirms
  the tree matches the tag, so a retry is safe and idempotent).
- A bad release after publish is fixed by a new `fix:` commit + a new patch
  release through the same form. `main` stays releasable at all times
  (trunk-based, current practice).
- The invalid `paths:` filter on the old `server-publish.yml` release
  trigger disappears with the refactor — the trigger becomes `workflow_call`
  (+ `workflow_dispatch` for manual archive builds), no longer a `release:`
  event.

## Testing

- Version-resolution and coupled-bump script: jest tests with fixture trees
  (resolve, validate, bump, changelog grouping; lockstep and parity rules).
- Version-parity gate script: exercised in CI against fixture trees
  (matching versions pass, drifted versions fail).
- First real release under the pipeline: a supervised server-only patch
  release, then a supervised extension release, validating the whole path
  with `docs/release.md` updated in the same change.

## Migration

1. **Secrets (owner setup, one-time)**: `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`,
   `CWS_REFRESH_TOKEN` (Google Cloud OAuth for the Chrome Web Store API);
   `NPM_TOKEN` already exists. (AMO keys are not needed in v1 — no
   auto-upload.) Until the CWS secrets exist, the store-upload step runs
   behind a "skip if secrets absent" guard and the zips on the Release page
   serve as the manual path.
2. Add `release.yml`; write the version/changelog script + tests; add the
   parity-gate script; refactor `server-publish.yml` /
   `extension-publish.yml` into `workflow_call` form.
3. Update `docs/release.md` to the new procedure (human steps: optionally
   update README Highlights, open Actions → Release, fill the form, re-run
   failed jobs).
4. Supervised patch releases for both components validate end-to-end.
5. (Optional, later) Claude-plugin releases through the same form as a third
   scope if its version bumps get frequent.

## Decisions (settled in review)

1. **Version input**: keep auto-compute when the `version` field is left
   empty, with explicit override when filled. (As designed.)
2. **Store submission**: draft mode. CWS versions are auto-uploaded as
   drafts only; a human clicks "Submit for review" in the store dashboard to
   go live. AMO has no draft state in its API, so AMO submission stays
   manual from the Release-page zips in v1.
3. **Who may run the form**: anyone with write access to the repo (GitHub's
   default for `workflow_dispatch`). No additional approval gate.

## Corrections — no release branch by design

There is no release branch in this pipeline; `main` is the only integration
point. Corrections work as ordinary commits:

- **Before running the form** (e.g. a README.md fix or a Highlights edit):
  push the correction to `main` as a normal commit/PR — the workflow reads
  whatever `main` HEAD is at run time, so the fix is included in the release
  (and the generated server-README sync picks it up).
- **After a release**: the correction lands on `main` the same way and ships
  with the next release. The one wrinkle is the npm-displayed server README:
  the registry shows the copy from the published version, so a post-release
  README fix only reaches npm with the next server release. GitHub's copy is
  correct immediately (it reads the repo root README).
- **Nothing is ever committed to a branch other than `main`** — the workflow's
  release commit is bot-authored directly on `main`, and there is no
  post-merge cleanup to forget.
